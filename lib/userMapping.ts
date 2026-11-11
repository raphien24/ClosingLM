import { getSheetData, appendRow, updateRow, deleteSheetRow } from "./sheets";
import { UserMapping } from "@/types/closing";

const USER_MAPPING_SHEET = "USER_MAPPING";

// Kolom index di sheet USER_MAPPING (0-indexed)
// email | nama_hub | nama_user | status | foto_profil
const COL_EMAIL = 0;
const COL_NAMA_HUB = 1;
const COL_NAMA_USER = 2;
const COL_STATUS = 3;
const COL_AVATAR = 4;

const MAX_AVATAR_DATA_URI_CHARS = 45_000;
const SAFE_DATA_URI_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function sanitizeAvatarUrl(raw: string): string {
  const val = String(raw ?? "").trim();
  if (!val) return "";
  if (val.startsWith("data:")) {
    if (!SAFE_DATA_URI_REGEX.test(val)) {
      throw new UserMappingError(
        "Format foto profil tidak didukung. Gunakan gambar PNG, JPG, atau WebP.",
        400
      );
    }
    if (val.length > MAX_AVATAR_DATA_URI_CHARS) {
      throw new UserMappingError(
        "Ukuran foto profil melebihi batas penyimpanan. Silakan pilih gambar yang lebih kecil.",
        400
      );
    }
    return val;
  }
  if (/^https?:\/\//i.test(val)) {
    if (val.length > 2000) {
      throw new UserMappingError("URL foto profil terlalu panjang.", 400);
    }
    return val;
  }
  throw new UserMappingError("URL foto profil tidak valid.", 400);
}

export class UserMappingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface IndexedUserMapping extends UserMapping {
  rowIndex: number; // 1-indexed di Google Sheets
}

function parseRowsToIndexedMappings(data: string[][]): IndexedUserMapping[] {
  const result: IndexedUserMapping[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[COL_EMAIL]?.trim()) continue;
    result.push({
      rowIndex: i + 1,
      email: row[COL_EMAIL].trim().toLowerCase(),
      nama_hub: row[COL_NAMA_HUB]?.trim() || "",
      nama_user: row[COL_NAMA_USER]?.trim() || "",
      status: (row[COL_STATUS]?.trim().toLowerCase() || "active") as
        | "active"
        | "inactive",
      avatar_url: row[COL_AVATAR]?.trim() || "",
    });
  }
  return result;
}

/**
 * Ambil semua user mappings yang aktif/terdaftar
 */
export async function getAllUserMappings(): Promise<UserMapping[]> {
  const data = await getSheetData(USER_MAPPING_SHEET);
  return parseRowsToIndexedMappings(data).map(({ rowIndex: _rowIndex, ...rest }) => rest);
}

/**
 * Lookup email ke nama hub
 * Return nama_hub jika email terdaftar dan active, null jika tidak
 */
export async function getUserHub(email: string): Promise<{
  nama_hub: string;
  nama_user: string;
} | null> {
  if (!email) return null;

  const mappings = await getAllUserMappings();
  const mapping = mappings.find(
    (m) =>
      m.email === email.toLowerCase().trim() && m.status === "active"
  );

  if (!mapping) return null;

  return {
    nama_hub: mapping.nama_hub,
    nama_user: mapping.nama_user,
  };
}

/**
 * Ambil semua nama hub unik dari USER_MAPPING (untuk dashboard)
 */
export async function getAllHubs(): Promise<string[]> {
  const mappings = await getAllUserMappings();
  const hubs = [...new Set(mappings.map((m) => m.nama_hub).filter(Boolean))];
  return hubs.sort();
}

/**
 * Ambil daftar user untuk satu hub tertentu langsung dari Sheets (tanpa cache stale)
 */
export async function getHubUsers(hubName: string): Promise<UserMapping[]> {
  const normalizedHub = hubName.trim().toLowerCase();
  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: true });
  return parseRowsToIndexedMappings(data)
    .filter((m) => m.nama_hub.trim().toLowerCase() === normalizedHub)
    .map(({ rowIndex: _rowIndex, ...rest }) => rest)
    .sort((a, b) => a.nama_user.localeCompare(b.nama_user, "id"));
}

/**
 * Ambil ringkasan semua hub terdaftar (nama_hub, total user, jumlah user aktif)
 */
export async function getAllHubSummaries(): Promise<
  { nama_hub: string; userCount: number; activeCount: number }[]
> {
  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: true });
  const mappings = parseRowsToIndexedMappings(data);
  const grouped = new Map<string, { nama_hub: string; userCount: number; activeCount: number }>();

  for (const m of mappings) {
    if (!m.nama_hub) continue;
    const key = m.nama_hub.trim().toLowerCase();
    const existing = grouped.get(key) ?? {
      nama_hub: m.nama_hub,
      userCount: 0,
      activeCount: 0,
    };
    existing.userCount += 1;
    if (m.status === "active") existing.activeCount += 1;
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.nama_hub.localeCompare(b.nama_hub, "id")
  );
}

/**
 * Tambah pengguna baru ke hub tertentu.
 * Menolak email yang sudah terdaftar di hub yang sama maupun hub lain.
 */
export async function addUserToHub(params: {
  email: string;
  namaHub: string;
  namaUser: string;
}): Promise<UserMapping> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const cleanHub = params.namaHub.trim();
  const cleanUser = params.namaUser.trim();

  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: true });
  const existing = parseRowsToIndexedMappings(data).find(
    (m) => m.email === normalizedEmail
  );

  if (existing) {
    if (existing.nama_hub.trim().toLowerCase() === cleanHub.toLowerCase()) {
      throw new UserMappingError(
        existing.status === "inactive"
          ? `Email "${normalizedEmail}" sudah ada di hub ini dengan status nonaktif. Silakan aktifkan kembali di daftar pengguna.`
          : `Email "${normalizedEmail}" sudah terdaftar di ${existing.nama_hub}.`,
        409
      );
    }
    throw new UserMappingError(
      `Email "${normalizedEmail}" sudah terdaftar di hub lain (${existing.nama_hub}). Satu email hanya dapat terhubung ke satu hub.`,
      409
    );
  }

  await appendRow(USER_MAPPING_SHEET, [normalizedEmail, cleanHub, cleanUser, "active"]);
  return {
    email: normalizedEmail,
    nama_hub: cleanHub,
    nama_user: cleanUser,
    status: "active",
  };
}

/**
 * Ubah status (active/inactive) user yang berada di hub tersebut.
 */
export async function setUserStatusInHub(params: {
  email: string;
  hubName: string;
  status: "active" | "inactive";
}): Promise<void> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedHub = params.hubName.trim().toLowerCase();

  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: true });
  const target = parseRowsToIndexedMappings(data).find(
    (m) =>
      m.email === normalizedEmail &&
      m.nama_hub.trim().toLowerCase() === normalizedHub
  );

  if (!target) {
    throw new UserMappingError("Pengguna tidak ditemukan pada hub Anda.", 404);
  }

  await updateRow(USER_MAPPING_SHEET, target.rowIndex, [
    target.email,
    target.nama_hub,
    target.nama_user,
    params.status,
    target.avatar_url || "",
  ]);
}

/**
 * Ambil profil lengkap satu pengguna (termasuk avatar_url)
 */
export async function getUserProfile(email: string): Promise<UserMapping | null> {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const data = await getSheetData(USER_MAPPING_SHEET);
  const found = parseRowsToIndexedMappings(data).find(
    (m) => m.email === normalizedEmail && m.status === "active"
  );
  if (!found) return null;
  const { rowIndex: _rowIndex, ...profile } = found;
  return profile;
}

/**
 * Perbarui nama pengguna & foto profil milik sendiri di USER_MAPPING.
 */
export async function updateUserProfile(params: {
  email: string;
  namaUser: string;
  avatarUrl: string;
}): Promise<UserMapping> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const cleanName = params.namaUser.trim();
  const cleanAvatar = sanitizeAvatarUrl(params.avatarUrl);

  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: true });
  const target = parseRowsToIndexedMappings(data).find(
    (m) => m.email === normalizedEmail && m.status === "active"
  );

  if (!target) {
    throw new UserMappingError("Akun Anda tidak ditemukan atau tidak aktif.", 404);
  }

  // Pastikan header kolom E ("foto_profil") terisi jika belum ada
  const headerRow = data[0] || [];
  if (cleanAvatar && !String(headerRow[COL_AVATAR] ?? "").trim()) {
    await updateRow(USER_MAPPING_SHEET, 1, [
      headerRow[COL_EMAIL] || "email",
      headerRow[COL_NAMA_HUB] || "nama_hub",
      headerRow[COL_NAMA_USER] || "nama_user",
      headerRow[COL_STATUS] || "status",
      "foto_profil",
    ]);
  }

  await updateRow(USER_MAPPING_SHEET, target.rowIndex, [
    target.email,
    target.nama_hub,
    cleanName,
    target.status,
    cleanAvatar,
  ]);

  return {
    email: target.email,
    nama_hub: target.nama_hub,
    nama_user: cleanName,
    status: target.status,
    avatar_url: cleanAvatar,
  };
}

/**
 * Hapus user dari USER_MAPPING (hanya jika termasuk dalam hub tersebut).
 */
export async function removeUserFromHub(params: {
  email: string;
  hubName: string;
}): Promise<void> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedHub = params.hubName.trim().toLowerCase();

  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: true });
  const target = parseRowsToIndexedMappings(data).find(
    (m) =>
      m.email === normalizedEmail &&
      m.nama_hub.trim().toLowerCase() === normalizedHub
  );

  if (!target) {
    throw new UserMappingError("Pengguna tidak ditemukan pada hub Anda.", 404);
  }

  await deleteSheetRow(USER_MAPPING_SHEET, target.rowIndex);
}

/**
 * Khusus Super Admin: Tambah Hub baru sekaligus daftarkan email PIC awalnya ke USER_MAPPING.
 */
export async function createNewHub(params: {
  namaHub: string;
  picEmail: string;
  picName: string;
}): Promise<UserMapping> {
  const cleanHub = params.namaHub.trim();
  const normalizedEmail = params.picEmail.trim().toLowerCase();
  const cleanPicName = params.picName.trim();

  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: true });
  const mappings = parseRowsToIndexedMappings(data);

  const dupHub = mappings.find(
    (m) => m.nama_hub.trim().toLowerCase() === cleanHub.toLowerCase()
  );
  if (dupHub) {
    throw new UserMappingError(
      `Hub "${dupHub.nama_hub}" sudah terdaftar. Untuk menambah PIC di hub tersebut, gunakan menu Tambahkan Pengguna.`,
      409
    );
  }

  const dupEmail = mappings.find((m) => m.email === normalizedEmail);
  if (dupEmail) {
    throw new UserMappingError(
      `Email "${normalizedEmail}" sudah terdaftar di "${dupEmail.nama_hub}". Gunakan email lain untuk PIC hub baru.`,
      409
    );
  }

  await appendRow(USER_MAPPING_SHEET, [normalizedEmail, cleanHub, cleanPicName, "active"]);
  return {
    email: normalizedEmail,
    nama_hub: cleanHub,
    nama_user: cleanPicName,
    status: "active",
  };
}
