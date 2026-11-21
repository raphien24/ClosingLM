import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ACTIVE_HUB_COOKIE, resolveActiveHubForSession } from "@/lib/activeHub";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { hubName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  const targetHub = String(body.hubName ?? "").trim();
  if (!targetHub) {
    return NextResponse.json({ error: "Nama hub wajib diisi" }, { status: 400 });
  }

  const access = await resolveActiveHubForSession(session, { skipCache: true });
  if (!access) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const matched = access.allowedHubs.find(
    (h) => h.toLowerCase() === targetHub.toLowerCase()
  );
  if (!matched) {
    return NextResponse.json(
      {
        error: `Akun Anda tidak memiliki akses ke "${targetHub}". Hub tersedia: ${access.allowedHubs.join(", ")}`,
      },
      { status: 403 }
    );
  }

  const res = NextResponse.json({
    success: true,
    activeHub: matched,
    hubs: access.allowedHubs,
  });
  res.cookies.set(ACTIVE_HUB_COOKIE, matched, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
  return res;
}
