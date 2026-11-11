import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { isValidEmail } from "@/lib/authConstants";
import {
  getHubUsers,
  addUserToHub,
  setUserStatusInHub,
  removeUserFromHub,
  UserMappingError,
} from "@/lib/userMapping";

function getAuthorizedHubUser(session: Session | null) {
  if (!session?.user) return null;
  const user = session.user as typeof session.user & {
    hubName: string | null;
    isAuthorized: boolean;
  };
  if (!user.isAuthorized || !user.hubName) return null;
  return {
    email: String(user.email ?? "").trim().toLowerCase(),
    hubName: user.hubName,
  };
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = getAuthorizedHubUser(session);
  if (!authUser) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const users = await getHubUsers(authUser.hubName);
    return NextResponse.json({ success: true, hubName: authUser.hubName, users });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat daftar pengguna" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = getAuthorizedHubUser(session);
  if (!authUser) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: { email?: string; nama_user?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const namaUser = String(body.nama_user ?? "").trim();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Format email Google tidak valid." }, { status: 400 });
  }
  if (namaUser.length < 2 || namaUser.length > 80) {
    return NextResponse.json(
      { error: "Nama pengguna wajib diisi (minimal 2 karakter, maksimal 80 karakter)." },
      { status: 400 }
    );
  }

  try {
    // Hub selalu dikunci ke hub milik user yang login agar tidak bisa menambah user ke hub lain
    const created = await addUserToHub({
      email,
      namaHub: authUser.hubName,
      namaUser,
    });
    return NextResponse.json({
      success: true,
      message: `Pengguna ${created.nama_user} (${created.email}) berhasil ditambahkan ke ${created.nama_hub}.`,
      user: created,
    });
  } catch (err) {
    const status = err instanceof UserMappingError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menambahkan pengguna" },
      { status }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = getAuthorizedHubUser(session);
  if (!authUser) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: { email?: string; status?: "active" | "inactive" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const nextStatus = body.status;

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }
  if (nextStatus !== "active" && nextStatus !== "inactive") {
    return NextResponse.json({ error: "Status harus 'active' atau 'inactive'" }, { status: 400 });
  }
  if (email === authUser.email && nextStatus === "inactive") {
    return NextResponse.json(
      { error: "Tidak dapat menonaktifkan akun yang sedang Anda gunakan." },
      { status: 400 }
    );
  }

  try {
    await setUserStatusInHub({
      email,
      hubName: authUser.hubName,
      status: nextStatus,
    });
    return NextResponse.json({
      success: true,
      message:
        nextStatus === "active"
          ? `Akun ${email} diaktifkan kembali.`
          : `Akun ${email} dinonaktifkan.`,
    });
  } catch (err) {
    const status = err instanceof UserMappingError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengubah status pengguna" },
      { status }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = getAuthorizedHubUser(session);
  if (!authUser) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }
  if (email === authUser.email) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus akun yang sedang Anda gunakan." },
      { status: 400 }
    );
  }

  try {
    await removeUserFromHub({ email, hubName: authUser.hubName });
    return NextResponse.json({
      success: true,
      message: `Pengguna ${email} berhasil dihapus dari ${authUser.hubName}.`,
    });
  } catch (err) {
    const status = err instanceof UserMappingError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menghapus pengguna" },
      { status }
    );
  }
}
