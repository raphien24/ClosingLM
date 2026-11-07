import { NextRequest, NextResponse } from "next/server";
import { appendRow, getSheetData, updateRow } from "@/lib/sheets";
import { closingDataToRow, detectAnomalies } from "@/lib/utils";
import { normalizeToYMD, todayWIB } from "@/lib/dateUtils";
import { ClosingData } from "@/types/closing";

const SHEET = "DATA_CLOSING";
const EXPECTED_API_KEY =
  process.env.AUTO_UPLOAD_API_KEY || "spx-soko-jtt08-secure-2026";

interface RawSpxClosingPayload {
  hub_name?: string;
  date?: string;
  progress?: Record<string, any> | null;
  headCounts?: Array<Record<string, any>> | null;
  expedite?: Record<string, any> | null;
  parcel?: Record<string, any> | null;
  backlog?: Record<string, any> | null;
  // Atau langsung pass ClosingData
  closingData?: Partial<ClosingData>;
  overwrite?: boolean;
}

function getHeadCount(
  list: Array<Record<string, any>> | null | undefined,
  contractType: string,
  field: string
): number {
  if (!list || !Array.isArray(list)) return 0;
  for (const item of list) {
    if (item.contract_type === contractType) {
      return Number(item[field]) || 0;
    }
  }
  return 0;
}

export async function POST(req: NextRequest) {
  // 1. Cek API Key
  const apiKey =
    req.headers.get("x-api-key") ||
    req.nextUrl.searchParams.get("api_key") ||
    "";

  if (!apiKey || apiKey !== EXPECTED_API_KEY) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing x-api-key header" },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as RawSpxClosingPayload & Partial<ClosingData>;

    const hubName = (
      body.hub_name ||
      body.nama_hub ||
      "SOKO HUB"
    ).trim();

    const targetDate = normalizeToYMD(body.date || body.tanggal || todayWIB());
    const overwrite = body.overwrite !== false; // default true

    let closing: ClosingData;

    // Jika caller sudah mengirim objek ClosingData lengkap
    if (body.closingData || (body.in_hub_transported !== undefined && body.fleet_delivered !== undefined)) {
      const src = body.closingData || body;
      closing = {
        tanggal: targetDate,
        nama_hub: hubName,
        in_hub_transported: Number(src.in_hub_transported) || 0,
        in_hub_received: Number(src.in_hub_received) || 0,
        in_hub_assigning: Number(src.in_hub_assigning) || 0,
        in_hub_assigned: Number(src.in_hub_assigned) || 0,
        fleet_delivering: Number(src.fleet_delivering) || 0,
        fleet_delivered: Number(src.fleet_delivered) || 0,
        fleet_oh_volume: Number(src.fleet_oh_volume) || 0,
        fleet_oh_total: Number(src.fleet_oh_total) || Number(src.fleet_oh_volume) || 0,
        dedicated_actual_2wh: Number(src.dedicated_actual_2wh) || 0,
        kurir_plus_actual_2wh: Number(src.kurir_plus_actual_2wh) || 0,
        dedicated_actual_4wh: Number(src.dedicated_actual_4wh) || 0,
        mitra_actual_2wh: Number(src.mitra_actual_2wh) || 0,
        mitra_actual_4wh: Number(src.mitra_actual_4wh) || 0,
        backlog_total: Number(src.backlog_total) || 0,
        backlog_to_buyer: Number(src.backlog_to_buyer) || Number(src.backlog_total) || 0,
        backlog_to_seller: Number(src.backlog_to_seller) || 0,
        backlog_to_transfer: Number(src.backlog_to_transfer) || 0,
        total_expedite: Number(src.total_expedite) || 0,
        expedite: Number(src.total_expedite) || 0,
        super_expedite: 0,
        parcel_sweeper_total: Number(src.parcel_sweeper_total) || 0,
        parcel_sweeper_scanned_pct: Number(src.parcel_sweeper_scanned_pct ?? 100),
      };
    } else {
      // Mapping dari payload raw SPX endpoints
      const progress: Record<string, any> = body.progress || {};
      const headCounts: Array<Record<string, any>> = body.headCounts || [];
      const expedite: Record<string, any> = body.expedite || {};
      const parcel: Record<string, any> = body.parcel || {};
      const backlog: Record<string, any> = body.backlog || {};

      const ohVolume = Number(progress.lm_hub_onhold_in_system_inbound_lt_hub_cot_order_qty_td) || 0;
      const ohTotal =
        Number(progress.lm_hub_total_onhold_order_qty_eod) ||
        Number(progress.lm_hub_total_onhold_order_qty_td) ||
        Number(progress.lm_hub_onhold_order_qty_eod) ||
        ohVolume;

      // Parcel Sweeper scanned rate
      let sweeperPct = 100;
      if (parcel.expected_scanned_rate !== undefined && parcel.expected_scanned_rate !== null) {
        sweeperPct = Number(parcel.expected_scanned_rate);
      } else if (parcel.expected_scanned_rate_str) {
        const parsed = parseFloat(String(parcel.expected_scanned_rate_str).replace("%", ""));
        if (!isNaN(parsed)) sweeperPct = parsed;
      }

      // Backlog
      const backlogTotal =
        Number(backlog.lm_hub_backlog_gte_1d_order_qty_td) ||
        Number(backlog.total_backlog) ||
        0;

      // Expedite
      const totalExpedite = Number(expedite.all_expedite_total_order_qty_td) || 0;

      closing = {
        tanggal: targetDate,
        nama_hub: hubName,
        in_hub_transported: Number(progress.lm_hub_transported_to_buyer_in_system_inbound_lt_hub_cot_order_qty_td) || 0,
        in_hub_received: Number(progress.lm_hub_received_to_buyer_in_system_inbound_lt_hub_cot_order_qty_td) || 0,
        in_hub_assigning: Number(progress.lm_hub_assigning_to_fleet_in_system_inbound_lt_hub_cot_order_qty_td) || 0,
        in_hub_assigned: Number(progress.lm_hub_assigned_in_system_inbound_lt_hub_cot_order_qty_td) || 0,
        fleet_delivering: Number(progress.lm_hub_delivering_in_system_inbound_lt_hub_cot_order_qty_td) || 0,
        fleet_delivered: Number(progress.lm_hub_delivered_order_qty_eod) || 0,
        fleet_oh_volume: ohVolume,
        fleet_oh_total: Math.max(ohTotal, ohVolume),
        dedicated_actual_2wh:
          getHeadCount(headCounts, "Dedicated", "lm_hub_fleet_actual_2_wheelers_driver_qty_eod") ||
          getHeadCount(headCounts, "Dedicated", "lm_hub_fleet_schedule_2_wheelers_driver_qty_eod"),
        kurir_plus_actual_2wh:
          getHeadCount(headCounts, "Kurir Plus", "lm_hub_fleet_actual_2_wheelers_driver_qty_eod") ||
          getHeadCount(headCounts, "Kurir Plus", "lm_hub_fleet_schedule_2_wheelers_driver_qty_eod"),
        dedicated_actual_4wh:
          getHeadCount(headCounts, "Dedicated", "lm_hub_fleet_actual_4_wheelers_driver_qty_eod") ||
          getHeadCount(headCounts, "Dedicated", "lm_hub_fleet_schedule_4_wheelers_driver_qty_eod"),
        mitra_actual_2wh:
          getHeadCount(headCounts, "Mitra", "lm_hub_fleet_actual_2_wheelers_driver_qty_eod") ||
          getHeadCount(headCounts, "Mitra", "lm_hub_fleet_schedule_2_wheelers_driver_qty_eod"),
        mitra_actual_4wh:
          getHeadCount(headCounts, "Mitra", "lm_hub_fleet_actual_4_wheelers_driver_qty_eod") ||
          getHeadCount(headCounts, "Mitra", "lm_hub_fleet_schedule_4_wheelers_driver_qty_eod"),
        backlog_total: backlogTotal,
        backlog_to_buyer: Number(backlog.lm_hub_backlog_to_buyer_order_qty_td) || backlogTotal,
        backlog_to_seller: Number(backlog.lm_hub_backlog_to_seller_order_qty_td) || 0,
        backlog_to_transfer: Number(backlog.lm_hub_backlog_to_transfer_order_qty_td) || 0,
        total_expedite: totalExpedite,
        expedite: totalExpedite,
        super_expedite: 0,
        parcel_sweeper_total: Number(parcel.total) || 0,
        parcel_sweeper_scanned_pct: Math.min(100, Math.max(0, sweeperPct)),
      };
    }

    // Pastikan oh_total tidak lebih kecil dari oh_volume
    if ((closing.fleet_oh_total ?? 0) < (closing.fleet_oh_volume ?? 0)) {
      closing.fleet_oh_total = closing.fleet_oh_volume;
    }

    // Validasi anomali
    const anomalies = detectAnomalies(closing);
    if (anomalies.length > 0) {
      console.warn("⚠️ Closing auto-upload detected anomalies:", anomalies);
    }

    // Cek apakah row sudah ada di sheet DATA_CLOSING
    const sheetData = await getSheetData(SHEET, { skipCache: true });
    let existingRowIndex: number | null = null;
    let exactHubNameInSheet = closing.nama_hub;

    for (let i = 1; i < sheetData.length; i++) {
      const r = sheetData[i];
      if (!r) continue;
      if (
        normalizeToYMD(r[0]) === targetDate &&
        r[1]?.toLowerCase().trim() === hubName.toLowerCase().trim()
      ) {
        existingRowIndex = i + 1; // 1-indexed
        if (r[1]?.trim()) {
          exactHubNameInSheet = r[1].trim();
        }
        break;
      }
    }

    closing.nama_hub = exactHubNameInSheet;
    const submittedAt = new Date().toISOString();
    const submittedBy = "Auto Script SPX (GAS)";
    const rowValues = closingDataToRow(closing, submittedAt, submittedBy);

    let isOverwritten = false;
    if (existingRowIndex && overwrite) {
      await updateRow(SHEET, existingRowIndex, rowValues);
      isOverwritten = true;
    } else {
      await appendRow(SHEET, rowValues);
    }

    return NextResponse.json({
      success: true,
      message: `Closing data untuk ${closing.nama_hub} (${targetDate}) berhasil ${
        isOverwritten ? "diperbarui (overwrite)" : "disimpan"
      }!`,
      overwritten: isOverwritten,
      anomalies: anomalies.map((a) => a.reason),
      closing,
    });
  } catch (err) {
    console.error("❌ Error in Closing auto-upload:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
