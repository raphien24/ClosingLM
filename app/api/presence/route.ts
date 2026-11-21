import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveActiveHubForSession } from "@/lib/activeHub";
import {
  getActiveUsers,
  markUserPresenceOffline,
  recordUserPresence,
} from "@/lib/presenceService";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolveActiveHubForSession(session);
  if (!access) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const users = await getActiveUsers(access.email);
    return NextResponse.json({ success: true, users });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat user aktif" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolveActiveHubForSession(session);
  if (!access) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let action = searchParams.get("action") || "heartbeat";

  if (action === "heartbeat") {
    try {
      const body = (await req.json().catch(() => null)) as { action?: string } | null;
      if (body?.action === "leave") action = "leave";
    } catch {
      // Abaikan body kosong
    }
  }

  try {
    if (action === "leave") {
      await markUserPresenceOffline(access.email);
      return NextResponse.json({ success: true });
    }

    const sessionUser = session.user as typeof session.user & {
      hubUser?: string | null;
    };
    const namaUser =
      sessionUser.hubUser ||
      sessionUser.name ||
      access.email.split("@")[0];

    await recordUserPresence({
      email: access.email,
      namaUser,
      namaHub: access.activeHub,
      googleImage: sessionUser.image,
    });

    const users = await getActiveUsers(access.email);
    return NextResponse.json({ success: true, users });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memperbarui presence" },
      { status: 500 }
    );
  }
}
