import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTargetAppeals, submitTargetAppeal, deleteTargetAppeal } from "@/lib/productivityService";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as typeof session.user & { hubName: string | null; isAuthorized: boolean };
  if (!user.isAuthorized || !user.hubName)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const appeals = await getTargetAppeals(user.hubName);
    return NextResponse.json({ success: true, appeals });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as typeof session.user & { hubName: string | null; isAuthorized: boolean };
  if (!user.isAuthorized || !user.hubName)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: { week_start: string; contract_type: string; vehicle_type: string; target: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  if (!body.week_start || !body.contract_type || !body.vehicle_type || !body.target)
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });

  try {
    await submitTargetAppeal({
      week_start:    body.week_start,
      nama_hub:      user.hubName,
      contract_type: body.contract_type,
      vehicle_type:  body.vehicle_type,
      target:        body.target,
    }, session.user?.email || "unknown");

    return NextResponse.json({ success: true, message: "Target berhasil disimpan!" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as typeof session.user & { hubName: string | null; isAuthorized: boolean };
  if (!user.isAuthorized || !user.hubName)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: { week_start: string; contract_type: string; vehicle_type: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  try {
    await deleteTargetAppeal(user.hubName, body.week_start, body.contract_type, body.vehicle_type);
    return NextResponse.json({ success: true, message: "Target dihapus." });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
