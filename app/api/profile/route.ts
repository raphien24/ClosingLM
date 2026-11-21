import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveActiveHubForSession } from "@/lib/activeHub";
import { isOwnerAdminEmail } from "@/lib/authConstants";
import {
  getUserProfile,
  updateUserProfile,
  UserMappingError,
} from "@/lib/userMapping";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolveActiveHubForSession(session);
  if (!access) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  const { email, activeHub, allowedHubs, isAdmin } = access;
  const user = session.user as typeof session.user & {
    hubUser?: string | null;
  };

  try {
    const rawProfile = await getUserProfile(email);
    const isOwner = isOwnerAdminEmail(email);
    const profile = rawProfile
      ? { ...rawProfile, nama_hub: activeHub }
      : isAdmin
        ? {
            email,
            nama_hub: activeHub,
            nama_user: user.hubUser || user.name || email.split("@")[0],
            status: "active" as const,
            avatar_url: "",
          }
        : null;
    if (!profile) {
      return NextResponse.json({ error: "Profil tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      profile,
      isAdmin,
      isOwner,
      activeHub,
      hubs: allowedHubs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat profil" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as typeof session.user & {
    isAuthorized: boolean;
  };
  const email = String(user.email ?? "").trim().toLowerCase();
  if (!user.isAuthorized || !email) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  let body: { nama_user?: string; avatar_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  const namaUser = String(body.nama_user ?? "").trim();
  const avatarUrl = typeof body.avatar_url === "string" ? body.avatar_url : "";

  if (namaUser.length < 2 || namaUser.length > 80) {
    return NextResponse.json(
      { error: "Nama pengguna wajib diisi (2–80 karakter)." },
      { status: 400 }
    );
  }

  try {
    const updated = await updateUserProfile({
      email,
      namaUser,
      avatarUrl,
    });
    return NextResponse.json({
      success: true,
      message: "Profil Anda berhasil diperbarui.",
      profile: updated,
    });
  } catch (err) {
    const status = err instanceof UserMappingError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan profil" },
      { status }
    );
  }
}
