import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveCourierRecordsBatch, getRawData } from "@/lib/productivityService";
import { CourierRecord } from "@/types/productivity";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as typeof session.user & {
    hubName: string | null;
    isAuthorized: boolean;
  };

  if (!user.isAuthorized || !user.hubName)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: {
    records: Omit<CourierRecord, "nama_hub" | "submitted_at" | "submitted_by">[];
    checkOnly?: boolean;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  // Mode check-only: cek duplikat tanpa simpan
  if (body.checkOnly) {
    try {
      const existing = await getRawData(user.hubName);
      const uploadDates = new Set(
        (body.records || []).map((r) => {
          const parts = r.date.split("/");
          if (parts.length === 3) {
            return `${parts[2]}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}`;
          }
          return r.date;
        })
      );
      const existingOnDate = existing.filter((r) => {
        const parts = r.date.split("/");
        if (parts.length !== 3) return false;
        const key = `${parts[2]}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}`;
        return uploadDates.has(key);
      });
      return NextResponse.json({
        success: true,
        existingOnDateCount: existingOnDate.length,
        willOverwriteCount: existingOnDate.length,
        newCount: (body.records?.length ?? 0),
        overwriteKeys: [],
        courierProfiles: {},
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
    }
  }

  if (!body.records?.length)
    return NextResponse.json({ error: "records array wajib diisi" }, { status: 400 });

  try {
    const result = await saveCourierRecordsBatch(
      body.records,
      user.hubName,
      session.user?.email || "unknown"
    );

    const wasReplace = result.deletedExisting > 0;
    const message = wasReplace
      ? `⚠️ ${result.deletedExisting} data lama dihapus dan diganti dengan ${result.saved} data baru.`
      : `${result.saved} data baru disimpan.`;

    return NextResponse.json({
      success: true,
      message,
      saved:           result.saved,
      deletedExisting: result.deletedExisting,
      wasReplace,
    });
  } catch (err) {
    console.error("Error saving batch:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan data" },
      { status: 500 }
    );
  }
}
