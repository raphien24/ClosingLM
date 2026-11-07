import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSheetData } from "@/lib/sheets";
import { getAllHubs } from "@/lib/userMapping";
import { rowToClosingData } from "@/lib/utils";
import { ClosingData, KpiSummary } from "@/types/closing";
import { todayWIB, normalizeToYMD } from "@/lib/dateUtils";
import { getDailyProductivityByHubs, HubDailyProductivity } from "@/lib/productivityService";

const SHEET = "DATA_CLOSING";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const today = todayWIB();
  const dateParam = normalizeToYMD(searchParams.get("date") || today);
  const hubFilter = searchParams.get("hub");

  try {
    const [sheetData, allHubsList] = await Promise.all([
      getSheetData(SHEET),
      getAllHubs(),
    ]);

    let rows = sheetData.slice(1).filter((r) => r && r.length > 1);
    rows = rows.filter((r) => normalizeToYMD(r[0]) === dateParam);
    if (hubFilter) {
      const hubs = hubFilter.split(",").map((h) => h.trim().toLowerCase());
      rows = rows.filter((r) => hubs.includes(r[1]?.toLowerCase().trim() ?? ""));
    }

    // Jika ada duplikat (race condition lama), ambil yang submitted_at terbaru per hub
    const parsedRows = rows.map(rowToClosingData);
    const latestByHub = new Map<string, ClosingData>();
    for (const d of parsedRows) {
      const key = d.nama_hub.toLowerCase().trim();
      const prev = latestByHub.get(key);
      if (!prev || (d.submitted_at || "") >= (prev.submitted_at || "")) {
        latestByHub.set(key, d);
      }
    }
    const closingData: ClosingData[] = Array.from(latestByHub.values());
    const submittedHubs = new Set(closingData.map((d) => d.nama_hub.toLowerCase().trim()));

    const filteredHubs = hubFilter
      ? allHubsList.filter((h) =>
          hubFilter.split(",").map((x) => x.trim().toLowerCase()).includes(h.toLowerCase())
        )
      : allHubsList;

    // Placeholder untuk hub yang belum submit
    const emptyRow = (hub: string): ClosingData => ({
      tanggal: dateParam, nama_hub: hub,
      in_hub_transported: null, in_hub_received: null,
      in_hub_assigning: null, in_hub_assigned: null,
      fleet_delivering: null, fleet_delivered: null,
      fleet_oh_volume: null, fleet_oh_total: null,
      dedicated_actual_2wh: null, kurir_plus_actual_2wh: null,
      dedicated_actual_4wh: null, mitra_actual_2wh: null, mitra_actual_4wh: null,
      backlog_total: null, backlog_to_buyer: null,
      backlog_to_seller: null, backlog_to_transfer: null,
      expedite: null, super_expedite: null, total_expedite: null,
      parcel_sweeper_total: null, parcel_sweeper_scanned_pct: null,
      submitted_at: "", submitted_by: "",
    });

    const missing = filteredHubs
      .filter((h) => !submittedHubs.has(h.toLowerCase().trim()))
      .map(emptyRow);

    const rawAllData = [...closingData, ...missing];

    // Ambil Daily Productivity per Hub dari data yang sudah diupload di menu Productivity
    let prodByHub = new Map<string, HubDailyProductivity>();
    try {
      prodByHub = await getDailyProductivityByHubs(filteredHubs, dateParam);
    } catch (e) {
      console.error("Failed fetching daily productivity for dashboard:", e);
    }

    const allData: ClosingData[] = rawAllData.map((row) => {
      const prod = prodByHub.get(row.nama_hub.toLowerCase().trim());
      const hasAnyVolumeField =
        row.in_hub_transported !== null ||
        row.in_hub_received !== null ||
        row.in_hub_assigning !== null ||
        row.in_hub_assigned !== null ||
        row.fleet_delivering !== null ||
        row.fleet_delivered !== null ||
        row.fleet_oh_volume !== null;

      const totalVolume = hasAnyVolumeField
        ? (row.in_hub_transported || 0) +
          (row.in_hub_received || 0) +
          (row.in_hub_assigning || 0) +
          (row.in_hub_assigned || 0) +
          (row.fleet_delivering || 0) +
          (row.fleet_delivered || 0) +
          (row.fleet_oh_volume || 0)
        : null;

      const backlogPct =
        totalVolume &&
        totalVolume > 0 &&
        row.backlog_total !== null &&
        row.backlog_total !== undefined
          ? Math.round((row.backlog_total / totalVolume) * 1000) / 10
          : null;

      return {
        ...row,
        total_volume: totalVolume,
        backlog_pct: backlogPct,
        prod_2w_dedicated: prod?.prod_2w_dedicated ?? null,
        prod_2w_kurir_plus: prod?.prod_2w_kurir_plus ?? null,
        prod_4w_dedicated: prod?.prod_4w_dedicated ?? null,
        prod_2w_mitra: prod?.prod_2w_mitra ?? null,
        prod_4w_mitra: prod?.prod_4w_mitra ?? null,
        target_2w_dedicated: prod?.target_2w_dedicated ?? null,
        target_2w_kurir_plus: prod?.target_2w_kurir_plus ?? null,
        target_4w_dedicated: prod?.target_4w_dedicated ?? null,
        target_2w_mitra: prod?.target_2w_mitra ?? null,
        target_4w_mitra: prod?.target_4w_mitra ?? null,
      };
    });

    // KPI
    const totalDelivered = closingData.reduce((s, d) => s + (d.fleet_delivered || 0), 0);
    const totalOnhold    = closingData.reduce((s, d) => s + (d.fleet_oh_total  || 0), 0);
    const totalBacklog   = closingData.reduce((s, d) => s + (d.backlog_total   || 0), 0);

    const kpi: KpiSummary = {
      totalDelivered,
      totalOnhold,
      totalBacklog,
      hubUpdated: submittedHubs.size,
      hubTotal: filteredHubs.length,
    };

    return NextResponse.json({
      success: true, date: dateParam,
      closingData: allData, kpi, allHubs: allHubsList,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
