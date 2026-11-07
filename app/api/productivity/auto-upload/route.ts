import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parseFmsRows } from "@/lib/fmsParser";
import { saveCourierRecordsBatch } from "@/lib/productivityService";
import { CourierRecord } from "@/types/productivity";

function parsePercent(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[%,]/g, ""));
  return isNaN(n) ? null : n;
}

// API Key untuk otentikasi script otomatis (Google Apps Script / Python / curl)
const EXPECTED_API_KEY =
  process.env.AUTO_UPLOAD_API_KEY || "spx-soko-jtt08-secure-2026";

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

  let buffer: Buffer | null = null;
  let hubName = req.nextUrl.searchParams.get("hub_name") || "SOKO HUB";
  let manualDate = req.nextUrl.searchParams.get("date") || null;

  const contentType = req.headers.get("content-type") || "";

  try {
    // 2. Ambil file dari request (mendukung Multipart FormData maupun Raw Binary)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | Blob | null;
      if (!file) {
        return NextResponse.json(
          { error: "Field 'file' tidak ditemukan dalam form-data" },
          { status: 400 }
        );
      }
      const fileHub = formData.get("hub_name") as string | null;
      if (fileHub) hubName = fileHub.trim();

      const fileDate = formData.get("date") as string | null;
      if (fileDate) manualDate = fileDate.trim();

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      // Raw binary payload
      const arrayBuffer = await req.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return NextResponse.json(
          { error: "Request body kosong. Kirim file Excel/CSV." },
          { status: 400 }
        );
      }
      buffer = Buffer.from(arrayBuffer);
    }

    // 3. Baca workbook Excel menggunakan library xlsx
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { error: "File Excel tidak memiliki sheet yang valid" },
        { status: 400 }
      );
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];

    // 4. Parse baris data FMS secara aman
    const parseResult = parseFmsRows(rawData, manualDate);

    if (parseResult.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada data kurir valid yang terbaca. Pastikan file adalah hasil export FMS Fleet Productivity.",
          details: parseResult.errors,
        },
        { status: 400 }
      );
    }

    // 5. Konversi ke struktur CourierRecord
    const records: Omit<
      CourierRecord,
      "nama_hub" | "submitted_at" | "submitted_by"
    >[] = parseResult.rows.map((r) => ({
      district: "",
      courier_id: r.courier_id,
      courier_name: r.courier_name,
      date: r.date,
      driver_name: "",
      contract_type: r.contract_type,
      vehicle_type: r.vehicle_type,
      zone_id: r.zone_id,
      assigned: r.assigned,
      assigned_target: r.assigned_target,
      assigned_progress: parsePercent(r.assigned_progress),
      delivery_progress: parsePercent(r.delivery_progress),
      handed_over: r.handed_over,
      delivered: r.delivered,
      delivered_pct: r.delivered_pct,
      delivering_count: r.delivering_count,
      delivering_pct: r.delivering_pct,
      failed_delivery: r.failed_delivery,
      failed_delivery_pct: r.failed_delivery_pct,
      stuck_at_delivering: r.stuck_at_delivering,
      onhold: r.onhold,
    }));

    // 6. Simpan secara aman (NON-DESTRUCTIVE)
    // saveCourierRecordsBatch tidak menghapus sheet; hanya meng-append data baru
    // dan meng-update baris tanggal yang sama berdasarkan kurir_id + tanggal.
    const saveResult = await saveCourierRecordsBatch(
      records,
      hubName.toUpperCase().trim(),
      "auto-fms-script@system"
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil memproses ${records.length} kurir untuk ${hubName}. ${saveResult.saved} data baru ditambahkan, ${saveResult.overwritten} data diperbarui.`,
      hub: hubName.toUpperCase().trim(),
      dateDetected: parseResult.dateDetected,
      totalCouriersProcessed: records.length,
      savedNew: saveResult.saved,
      updatedExisting: saveResult.overwritten,
      parseErrors: parseResult.errors,
      skippedOffCount: parseResult.skippedOffCount || 0,
    });
  } catch (err) {
    console.error("Auto upload FMS error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses file",
      },
      { status: 500 }
    );
  }
}
