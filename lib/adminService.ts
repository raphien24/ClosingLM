import {
  appendRow,
  deleteSheetRow,
  ensureSheet,
  getSheetData,
  invalidateSheetCache,
  updateRow,
} from "./sheets";
import {
  OWNER_ADMIN_EMAIL,
  SUPER_ADMIN_EMAILS,
  isOwnerAdminEmail,
  isValidEmail,
} from "./authConstants";
import { nowWIBTimestamp } from "./dateUtils";

const ADMIN_SHEET = "ADMIN_LIST";
const ADMIN_HEADERS = ["email", "nama", "status", "updated_at", "updated_by"];

const COL_EMAIL = 0;
const COL_NAMA = 1;
const COL_STATUS = 2;
const COL_UPDATED_AT = 3;
const COL_UPDATED_BY = 4;

export interface AdminRecord {
  email: string;
  nama: string;
  status: "active" | "inactive";
  updated_at: string;
  updated_by: string;
  isOwner: boolean;
}

export class AdminServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface IndexedAdminRecord extends AdminRecord {
  rowIndex: number;
}

async function ensureAdminSheetSeeded(skipCache = false): Promise<string[][]> {
  await ensureSheet(ADMIN_SHEET, ADMIN_HEADERS);
  let data = await getSheetData(ADMIN_SHEET, { skipCache });
  if (data.length <= 1) {
    const ts = nowWIBTimestamp();
    for (const email of SUPER_ADMIN_EMAILS) {
      const defaultName =
        email === OWNER_ADMIN_EMAIL ? "Rafi (Owner)" : email.split("@")[0];
      await appendRow(ADMIN_SHEET, [email, defaultName, "active", ts, OWNER_ADMIN_EMAIL]);
    }
    invalidateSheetCache(ADMIN_SHEET);
    data = await getSheetData(ADMIN_SHEET, { skipCache: true });
  }
  return data;
}

function parseAdminRows(data: string[][]): IndexedAdminRecord[] {
  const rows: IndexedAdminRecord[] = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const email = String(r?.[COL_EMAIL] ?? "").trim().toLowerCase();
    if (!email) continue;
    const rawStatus = String(r?.[COL_STATUS] ?? "active").trim().toLowerCase();
    const isOwner = isOwnerAdminEmail(email);
    rows.push({
      rowIndex: i + 1,
      email,
      nama: String(r?.[COL_NAMA] ?? "").trim() || email.split("@")[0],
      status: isOwner ? "active" : rawStatus === "inactive" ? "inactive" : "active",
      updated_at: String(r?.[COL_UPDATED_AT] ?? "").trim(),
      updated_by: String(r?.[COL_UPDATED_BY] ?? "").trim(),
      isOwner,
    });
  }
  return rows;
}

export async function getAllAdmins(options?: {
  skipCache?: boolean;
}): Promise<AdminRecord[]> {
  const data = await ensureAdminSheetSeeded(options?.skipCache);
  const parsed = parseAdminRows(data).map(({ rowIndex: _rowIndex, ...rest }) => rest);

  // Pastikan akun Owner selalu ada di daftar teratas
  if (!parsed.some((a) => a.isOwner)) {
    parsed.unshift({
      email: OWNER_ADMIN_EMAIL,
      nama: "Rafi (Owner)",
      status: "active",
      updated_at: "",
      updated_by: OWNER_ADMIN_EMAIL,
      isOwner: true,
    });
  }

  return parsed.sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    return a.email.localeCompare(b.email);
  });
}

export async function isAdminEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  if (isOwnerAdminEmail(normalized)) return true;
  try {
    const admins = await getAllAdmins();
    return admins.some((a) => a.email === normalized && a.status === "active");
  } catch (err) {
    console.error("Failed checking ADMIN_LIST:", err);
    return SUPER_ADMIN_EMAILS.includes(normalized);
  }
}

export async function addAdmin(params: {
  email: string;
  nama: string;
  addedBy: string;
}): Promise<AdminRecord> {
  const cleanEmail = String(params.email ?? "").trim().toLowerCase();
  const cleanName = String(params.nama ?? "").trim() || cleanEmail.split("@")[0];
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    throw new AdminServiceError("Format email Google Admin tidak valid.", 400);
  }
  if (cleanName.length < 2 || cleanName.length > 80) {
    throw new AdminServiceError("Nama admin wajib diisi (2–80 karakter).", 400);
  }

  const data = await ensureAdminSheetSeeded(true);
  const existing = parseAdminRows(data).find((a) => a.email === cleanEmail);
  if (existing) {
    throw new AdminServiceError(
      `Email "${cleanEmail}" sudah terdaftar di daftar Admin.`,
      409
    );
  }

  const ts = nowWIBTimestamp();
  await appendRow(ADMIN_SHEET, [cleanEmail, cleanName, "active", ts, params.addedBy]);
  invalidateSheetCache(ADMIN_SHEET);

  return {
    email: cleanEmail,
    nama: cleanName,
    status: "active",
    updated_at: ts,
    updated_by: params.addedBy,
    isOwner: isOwnerAdminEmail(cleanEmail),
  };
}

export async function updateAdmin(params: {
  targetEmail: string;
  newEmail?: string;
  nama?: string;
  status?: "active" | "inactive";
  updatedBy: string;
}): Promise<AdminRecord> {
  const targetEmail = String(params.targetEmail ?? "").trim().toLowerCase();
  if (!targetEmail) {
    throw new AdminServiceError("Email admin target wajib diisi.", 400);
  }

  const data = await ensureAdminSheetSeeded(true);
  const rows = parseAdminRows(data);
  const current = rows.find((r) => r.email === targetEmail);
  if (!current) {
    throw new AdminServiceError("Email admin tidak ditemukan.", 404);
  }

  const nextEmail = params.newEmail
    ? String(params.newEmail).trim().toLowerCase()
    : current.email;
  const nextName =
    typeof params.nama === "string" ? params.nama.trim() : current.nama;
  const nextStatus = params.status || current.status;

  if (!isValidEmail(nextEmail)) {
    throw new AdminServiceError("Format email baru tidak valid.", 400);
  }
  if (nextName.length < 2 || nextName.length > 80) {
    throw new AdminServiceError("Nama admin wajib diisi (2–80 karakter).", 400);
  }
  if (current.isOwner) {
    if (nextEmail !== OWNER_ADMIN_EMAIL) {
      throw new AdminServiceError(
        "Email Owner utama (rafi.alvian@spxexpress.com) tidak boleh diubah.",
        400
      );
    }
    if (nextStatus !== "active") {
      throw new AdminServiceError(
        "Status Owner utama tidak boleh dinonaktifkan.",
        400
      );
    }
  }

  if (nextEmail !== current.email && rows.some((r) => r.email === nextEmail)) {
    throw new AdminServiceError(
      `Email "${nextEmail}" sudah terdaftar di daftar Admin.`,
      409
    );
  }

  const ts = nowWIBTimestamp();
  await updateRow(ADMIN_SHEET, current.rowIndex, [
    nextEmail,
    nextName,
    nextStatus,
    ts,
    params.updatedBy,
  ]);
  invalidateSheetCache(ADMIN_SHEET);

  return {
    email: nextEmail,
    nama: nextName,
    status: nextStatus,
    updated_at: ts,
    updated_by: params.updatedBy,
    isOwner: isOwnerAdminEmail(nextEmail),
  };
}

export async function deleteAdmin(targetEmailRaw: string): Promise<void> {
  const targetEmail = String(targetEmailRaw ?? "").trim().toLowerCase();
  if (!targetEmail) {
    throw new AdminServiceError("Email admin wajib diisi.", 400);
  }
  if (isOwnerAdminEmail(targetEmail)) {
    throw new AdminServiceError(
      "Akun Owner utama (rafi.alvian@spxexpress.com) tidak dapat dihapus.",
      400
    );
  }

  const data = await ensureAdminSheetSeeded(true);
  const current = parseAdminRows(data).find((r) => r.email === targetEmail);
  if (!current) {
    throw new AdminServiceError("Email admin tidak ditemukan.", 404);
  }

  await deleteSheetRow(ADMIN_SHEET, current.rowIndex);
  invalidateSheetCache(ADMIN_SHEET);
}
