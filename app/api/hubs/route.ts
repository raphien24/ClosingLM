import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import {
  INVALID_HUB_NAME_CHARS,
  isSuperAdminEmail,
  isValidEmail,
} from "@/lib/authConstants";
import {
  createNewHub,
  getAllHubSummaries,
  UserMappingError,
} from "@/lib/userMapping";

function requireSuperAdmin(session: Session | null) {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as typeof session.user & { isAuthorized: boolean };
  if (!user.isAuthorized || !isSuperAdminEmail(user.email)) {
    return NextResponse.json(
      { error: "Akses ditolak. Menu ini khusus Super Admin." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  const session = await auth();
  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  try {
    const hubs = await getAllHubSummaries();
    return NextResponse.json({ success: true, hubs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat daftar hub" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  let body: { nama_hub?: string; pic_email?: string; pic_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  const namaHub = String(body.nama_hub ?? "").trim();
  const picEmail = String(body.pic_email ?? "").trim().toLowerCase();
  const picName = String(body.pic_name ?? "").trim();

  if (namaHub.length < 2 || namaHub.length > 80) {
    return NextResponse.json(
      { error: "Nama Hub wajib diisi (2–80 karakter)." },
      { status: 400 }
    );
  }
  if (INVALID_HUB_NAME_CHARS.test(namaHub)) {
    return NextResponse.json(
      { error: "Nama Hub tidak boleh mengandung karakter \\ / * ? : [ ]." },
      { status: 400 }
    );
  }
  if (!picEmail || !isValidEmail(picEmail)) {
    return NextResponse.json(
      { error: "Format email Google PIC awal tidak valid." },
      { status: 400 }
    );
  }
  if (picName.length < 2 || picName.length > 80) {
    return NextResponse.json(
      { error: "Nama PIC awal wajib diisi (2–80 karakter)." },
      { status: 400 }
    );
  }

  try {
    const created = await createNewHub({ namaHub, picEmail, picName });
    return NextResponse.json({
      success: true,
      message: `Hub "${created.nama_hub}" berhasil ditambahkan dengan PIC awal ${created.nama_user} (${created.email}).`,
      hub: created,
    });
  } catch (err) {
    const status = err instanceof UserMappingError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menambahkan hub baru" },
      { status }
    );
  }
}
