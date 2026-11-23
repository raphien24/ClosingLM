import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { denyIfReadOnlyAdmin, resolveActiveHubForSession } from "@/lib/activeHub";
import { addCourierLeave, removeCourierLeave } from "@/lib/productivityService";

async function getWritableLeaveUser(session: Session | null) {
  const access = await resolveActiveHubForSession(session);
  if (!access) return { error: "Akses ditolak", status: 403 as const };
  const readOnlyErr = denyIfReadOnlyAdmin(access, "mengubah status cuti kurir");
  if (readOnlyErr) return { error: readOnlyErr, status: 403 as const };
  return {
    email: access.email,
    hubName: access.activeHub,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getWritableLeaveUser(session);
  if ("error" in user) return NextResponse.json({ error: user.error }, { status: user.status });

  let body: { courier_id?: string; courier_name?: string; date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  const courierId = String(body.courier_id ?? "").trim();
  const courierName = String(body.courier_name ?? "").trim();
  const date = String(body.date ?? "").trim();

  if (!courierId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "courier_id dan date (YYYY-MM-DD) wajib valid" },
      { status: 400 }
    );
  }

  try {
    const result = await addCourierLeave({
      hubName: user.hubName!,
      courierId,
      courierName,
      date,
      userEmail: session.user?.email || "unknown",
    });
    return NextResponse.json({
      success: true,
      added: result.added,
      message: result.added ? "Status cuti berhasil ditandai." : "Kurir sudah ditandai cuti pada tanggal tersebut.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menandai cuti";
    const status = message.includes("hanya berlaku") || message.includes("tidak valid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getWritableLeaveUser(session);
  if ("error" in user) return NextResponse.json({ error: user.error }, { status: user.status });

  let body: { courier_id?: string; date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  const courierId = String(body.courier_id ?? "").trim();
  const date = String(body.date ?? "").trim();

  if (!courierId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "courier_id dan date (YYYY-MM-DD) wajib valid" },
      { status: 400 }
    );
  }

  try {
    const result = await removeCourierLeave({
      hubName: user.hubName!,
      courierId,
      date,
    });
    return NextResponse.json({
      success: true,
      removed: result.removed,
      message: result.removed ? "Status cuti berhasil dibatalkan." : "Data cuti tidak ditemukan.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membatalkan cuti" },
      { status: 500 }
    );
  }
}
