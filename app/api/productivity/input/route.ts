import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveCourierRecordsBatch, checkExistingCourierRecords } from "@/lib/productivityService";
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

  if (!body.records?.length)
    return NextResponse.json({ error: "records array wajib diisi" }, { status: 400 });

  try {
    if (body.checkOnly) {
      const checkResult = await checkExistingCourierRecords(
        body.records.map((r) => ({ courier_id: r.courier_id, date: r.date })),
        user.hubName
      );
      return NextResponse.json({
        success: true,
        ...checkResult,
      });
    }

    // Batch save — hanya 2 API calls ke Google Sheets (read + write)
    const result = await saveCourierRecordsBatch(
      body.records,
      user.hubName,
      session.user?.email || "unknown"
    );

    return NextResponse.json({
      success: true,
      message: `${result.saved} data baru disimpan, ${result.overwritten} diperbarui.`,
      saved: result.saved,
      overwritten: result.overwritten,
    });
  } catch (err) {
    console.error("Error saving batch:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan data" },
      { status: 500 }
    );
  }
}
