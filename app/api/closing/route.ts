import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendRow, getSheetData, updateRow } from "@/lib/sheets";
import { closingDataToRow, detectAnomalies, rowToClosingData } from "@/lib/utils";
import { normalizeToYMD, todayWIB } from "@/lib/dateUtils";
import { ClosingData } from "@/types/closing";

const SHEET = "DATA_CLOSING";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as typeof session.user & {
    hubName: string | null;
    isAuthorized: boolean;
  };
  if (!sessionUser.isAuthorized || !sessionUser.hubName)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const targetDate = normalizeToYMD(searchParams.get("date") || todayWIB());

  try {
    const sheetData = await getSheetData(SHEET);
    const hubRows = sheetData
      .slice(1)
      .filter((r) => r && r[1]?.toLowerCase().trim() === sessionUser.hubName!.toLowerCase().trim())
      .map(rowToClosingData)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    const current = hubRows.find((r) => r.tanggal === targetDate) || null;
    // Cari data terbaru sebelum targetDate (untuk pembanding kemarin)
    const previous = hubRows.find((r) => r.tanggal < targetDate) || null;

    return NextResponse.json({
      success: true,
      current,
      previous,
      recentHistory: hubRows.slice(0, 7),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat riwayat" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as typeof session.user & {
    hubName: string | null;
    isAuthorized: boolean;
  };

  if (!sessionUser.isAuthorized || !sessionUser.hubName)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: { data: ClosingData; overwrite?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const { data, overwrite = false } = body;

  if (!data?.tanggal || !data?.nama_hub)
    return NextResponse.json({ error: "tanggal dan nama_hub wajib diisi" }, { status: 400 });

  const normalizedDate = normalizeToYMD(data.tanggal);
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)
    ? new Date(`${normalizedDate}T00:00:00Z`)
    : null;
  if (!parsedDate || isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== normalizedDate) {
    return NextResponse.json(
      { error: `Format tanggal closing tidak valid (${data.tanggal}).` },
      { status: 400 }
    );
  }
  const today = todayWIB();
  if (normalizedDate > today) {
    return NextResponse.json(
      { error: `Tanggal closing (${normalizedDate}) tidak boleh melebihi hari ini (${today}).` },
      { status: 400 }
    );
  }
  data.tanggal = normalizedDate;

  const anomalies = detectAnomalies(data);
  if (anomalies.length > 0) {
    return NextResponse.json(
      { error: `Data belum lengkap/valid: ${anomalies[0].reason}` },
      { status: 400 }
    );
  }

  // Otorisasi hub
  if (data.nama_hub.toLowerCase().trim() !== sessionUser.hubName.toLowerCase().trim())
    return NextResponse.json(
      { error: `Tidak bisa isi data hub "${data.nama_hub}". Hub Anda: "${sessionUser.hubName}"` },
      { status: 403 }
    );

  try {
    const sheetData = await getSheetData(SHEET, { skipCache: true });
    const existing: number[] = [];
    for (let i = 1; i < sheetData.length; i++) {
      const r = sheetData[i];
      if (!r) continue;
      if (
        normalizeToYMD(r[0]) === normalizedDate &&
        r[1]?.toLowerCase().trim() === data.nama_hub.toLowerCase().trim()
      ) {
        existing.push(i + 1); // 1-indexed
      }
    }

    if (existing.length > 0 && !overwrite) {
      return NextResponse.json(
        { duplicate: true, rowIndex: existing[0],
          message: `Data ${data.nama_hub} tanggal ${normalizedDate} sudah ada. Timpa?` },
        { status: 409 }
      );
    }

    const submittedAt = new Date().toISOString();
    const submittedBy = session.user?.email || "unknown";
    const rowValues = closingDataToRow(data, submittedAt, submittedBy);

    if (existing.length > 0 && overwrite) {
      await updateRow(SHEET, existing[0], rowValues);
    } else {
      await appendRow(SHEET, rowValues);
    }

    return NextResponse.json({
      success: true,
      message: `Data ${data.nama_hub} berhasil disimpan!`,
      overwritten: existing.length > 0 && overwrite,
    });
  } catch (err) {
    console.error("Error saving:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan" },
      { status: 500 }
    );
  }
}
