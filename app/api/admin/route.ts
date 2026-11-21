import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { isOwnerAdminEmail } from "@/lib/authConstants";
import {
  addAdmin,
  AdminServiceError,
  deleteAdmin,
  getAllAdmins,
  updateAdmin,
} from "@/lib/adminService";

function requireOwnerAdmin(session: Session | null): {
  denied: NextResponse | null;
  email: string;
} {
  if (!session?.user) {
    return {
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      email: "",
    };
  }
  const user = session.user as typeof session.user & { isAuthorized?: boolean };
  const email = String(user.email ?? "").trim().toLowerCase();
  if (!user.isAuthorized || !isOwnerAdminEmail(email)) {
    return {
      denied: NextResponse.json(
        { error: "Akses ditolak. Menu Manage Admin khusus rafi.alvian@spxexpress.com." },
        { status: 403 }
      ),
      email,
    };
  }
  return { denied: null, email };
}

export async function GET() {
  const session = await auth();
  const { denied } = requireOwnerAdmin(session);
  if (denied) return denied;

  try {
    const admins = await getAllAdmins({ skipCache: true });
    return NextResponse.json({ success: true, admins });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat daftar admin" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const { denied, email: actorEmail } = requireOwnerAdmin(session);
  if (denied) return denied;

  let body: { email?: string; nama?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  try {
    const admin = await addAdmin({
      email: String(body.email ?? ""),
      nama: String(body.nama ?? ""),
      addedBy: actorEmail,
    });
    return NextResponse.json({
      success: true,
      message: `Admin "${admin.email}" berhasil ditambahkan.`,
      admin,
    });
  } catch (err) {
    const status = err instanceof AdminServiceError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menambahkan admin" },
      { status }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const { denied, email: actorEmail } = requireOwnerAdmin(session);
  if (denied) return denied;

  let body: {
    target_email?: string;
    new_email?: string;
    nama?: string;
    status?: "active" | "inactive";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  try {
    const admin = await updateAdmin({
      targetEmail: String(body.target_email ?? ""),
      newEmail: body.new_email,
      nama: body.nama,
      status: body.status,
      updatedBy: actorEmail,
    });
    return NextResponse.json({
      success: true,
      message: `Data admin "${admin.email}" berhasil diperbarui.`,
      admin,
    });
  } catch (err) {
    const status = err instanceof AdminServiceError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memperbarui admin" },
      { status }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const { denied } = requireOwnerAdmin(session);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const emailParam = searchParams.get("email") || "";

  try {
    await deleteAdmin(emailParam);
    return NextResponse.json({
      success: true,
      message: `Admin "${emailParam.toLowerCase()}" berhasil dihapus.`,
    });
  } catch (err) {
    const status = err instanceof AdminServiceError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menghapus admin" },
      { status }
    );
  }
}
