import { getSheetData, appendRow, updateRow, deleteSheetRow } from "./sheets";
import { UserMapping } from "@/types/closing";

const USER_MAPPING_SHEET = "USER_MAPPING";

// Kolom index di sheet USER_MAPPING (0-indexed)
// email | nama_hub | nama_user | status | foto_profil | nonaktifkan_border
const COL_EMAIL = 0;
const COL_NAMA_HUB = 1;
const COL_NAMA_USER = 2;
const COL_STATUS = 3;
const COL_AVATAR = 4;
const COL_BORDER_DISABLED = 5;

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
      consistency_border_disabled:
        String(row[COL_BORDER_DISABLED] ?? "").trim().toLowerCase() === "true",
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

export function splitHubList(rawHub: string): string[] {
  return String(rawHub ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

function rowHasHub(rawHub: string, targetHubLower: string): boolean {
  return splitHubList(rawHub).some((h) => h.toLowerCase() === targetHubLower);
}

/**
 * Ambil seluruh daftar hub aktif milik satu email (mendukung banyak baris di USER_MAPPING
 * maupun penulisan dipisah koma pada kolom nama_hub).
 */
export async function getUserHubs(
  email: string,
  options?: { skipCache?: boolean }
): Promise<{
  hubs: string[];
  primaryHub: string | null;
  nama_user: string | null;
}> {
  if (!email) {
    return { hubs: [], primaryHub: null, nama_user: null };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: options?.skipCache });
  const activeMappings = parseRowsToIndexedMappings(data).filter(
    (m) => m.email === normalizedEmail && m.status === "active"
  );

  const seen = new Set<string>();
  const hubs: string[] = [];
  let namaUser: string | null = null;

  for (const m of activeMappings) {
    if (!namaUser && m.nama_user) namaUser = m.nama_user;
    for (const h of splitHubList(m.nama_hub)) {
      const key = h.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        hubs.push(h);
      }
    }
  }

  return {
    hubs,
    primaryHub: hubs[0] ?? null,
    nama_user: namaUser,
  };
}

/**
 * Lookup email ke nama hub utama pertama (kompatibel dengan caller single-hub)
 */
export async function getUserHub(email: string): Promise<{
  nama_hub: string;
  nama_user: string;
} | null> {
  const { primaryHub, nama_user } = await getUserHubs(email);
  if (!primaryHub) return null;

  return {
    nama_hub: primaryHub,
    nama_user: nama_user || "",
  };
}

/**
 * Ambil semua nama hub unik dari USER_MAPPING (untuk dashboard)
 */
export async function getAllHubs(): Promise<string[]> {
  const mappings = await getAllUserMappings();
  const seen = new Map<string, string>();
  for (const m of mappings) {
    for (const h of splitHubList(m.nama_hub)) {
      const key = h.toLowerCase();
      if (!seen.has(key)) seen.set(key, h);
    }
  }
  return Array.from(seen.values()).sort();
}

/**
 * Ambil daftar user untuk satu hub tertentu langsung dari Sheets (tanpa cache stale)
 */
export async function getHubUsers(hubName: string): Promise<UserMapping[]> {
  const normalizedHub = hubName.trim().toLowerCase();
  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: true });
  return parseRowsToIndexedMappings(data)
    .filter((m) => rowHasHub(m.nama_hub, normalizedHub))
    .map(({ rowIndex: _rowIndex, ...rest }) => ({
      ...rest,
      nama_hub: splitHubList(rest.nama_hub).find((h) => h.toLowerCase() === normalizedHub) || rest.nama_hub,
    }))
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
    for (const hubLabel of splitHubList(m.nama_hub)) {
      const key = hubLabel.toLowerCase();
      const existing = grouped.get(key) ?? {
        nama_hub: hubLabel,
        userCount: 0,
        activeCount: 0,
      };
      existing.userCount += 1;
      if (m.status === "active") existing.activeCount += 1;
      grouped.set(key, existing);
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.nama_hub.localeCompare(b.nama_hub, "id")
  );
}

/**
 * Tambah pengguna ke hub tertentu.
 * Mendukung 1 email mengakses lebih dari 1 hub berbeda; menolak hanya jika email
 * sudah terdaftar di hub yang sama.
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
  const existingSameHub = parseRowsToIndexedMappings(data).find(
    (m) =>
      m.email === normalizedEmail &&
      rowHasHub(m.nama_hub, cleanHub.toLowerCase())
  );

  if (existingSameHub) {
    throw new UserMappingError(
      existingSameHub.status === "inactive"
        ? `Email "${normalizedEmail}" sudah ada di hub ini dengan status nonaktif. Silakan aktifkan kembali di daftar pengguna.`
        : `Email "${normalizedEmail}" sudah terdaftar di ${cleanHub}.`,
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
    (m) => m.email === normalizedEmail && rowHasHub(m.nama_hub, normalizedHub)
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
    target.consistency_border_disabled ? "true" : "",
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
  consistencyBorderDisabled?: boolean;
}): Promise<UserMapping> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const cleanName = params.namaUser.trim();
  const cleanAvatar = sanitizeAvatarUrl(params.avatarUrl);

  const data = await getSheetData(USER_MAPPING_SHEET, { skipCache: true });
  const targets = parseRowsToIndexedMappings(data).filter(
    (m) => m.email === normalizedEmail && m.status === "active"
  );

  if (targets.length === 0) {
    throw new UserMappingError("Akun Anda tidak ditemukan atau tidak aktif.", 404);
  }

  const first = targets[0];
  const nextBorderDisabled =
    typeof params.consistencyBorderDisabled === "boolean"
      ? params.consistencyBorderDisabled
      : Boolean(first.consistency_border_disabled);

  // Pastikan header kolom E ("foto_profil") & F ("nonaktifkan_border") terisi jika belum ada
  const headerRow = data[0] || [];
  const needAvatarHeader = cleanAvatar && !String(headerRow[COL_AVATAR] ?? "").trim();
  const needBorderHeader =
    nextBorderDisabled && !String(headerRow[COL_BORDER_DISABLED] ?? "").trim();
  if (needAvatarHeader || needBorderHeader) {
    await updateRow(USER_MAPPING_SHEET, 1, [
      headerRow[COL_EMAIL] || "email",
      headerRow[COL_NAMA_HUB] || "nama_hub",
      headerRow[COL_NAMA_USER] || "nama_user",
      headerRow[COL_STATUS] || "status",
      headerRow[COL_AVATAR] || "foto_profil",
      headerRow[COL_BORDER_DISABLED] || "nonaktifkan_border",
    ]);
  }

  // Sinkronkan nama, avatar, & preferensi border ke semua baris hub aktif milik email tersebut
  for (const target of targets) {
    await updateRow(USER_MAPPING_SHEET, target.rowIndex, [
      target.email,
      target.nama_hub,
      cleanName,
      target.status,
      cleanAvatar,
      nextBorderDisabled ? "true" : "",
    ]);
  }

  return {
    email: first.email,
    nama_hub: splitHubList(first.nama_hub)[0] || first.nama_hub,
    nama_user: cleanName,
    status: first.status,
    avatar_url: cleanAvatar,
    consistency_border_disabled: nextBorderDisabled,
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
    (m) => m.email === normalizedEmail && rowHasHub(m.nama_hub, normalizedHub)
  );

  if (!target) {
    throw new UserMappingError("Pengguna tidak ditemukan pada hub Anda.", 404);
  }

  const remainingHubs = splitHubList(target.nama_hub).filter(
    (h) => h.toLowerCase() !== normalizedHub
  );
  if (remainingHubs.length > 0) {
    await updateRow(USER_MAPPING_SHEET, target.rowIndex, [
      target.email,
      remainingHubs.join(", "),
      target.nama_user,
      target.status,
      target.avatar_url || "",
    ]);
  } else {
    await deleteSheetRow(USER_MAPPING_SHEET, target.rowIndex);
  }
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

  const dupHub = mappings.find((m) => rowHasHub(m.nama_hub, cleanHub.toLowerCase()));
  if (dupHub) {
    throw new UserMappingError(
      `Hub "${cleanHub}" sudah terdaftar. Untuk menambah PIC di hub tersebut, gunakan menu Tambahkan Pengguna.`,
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
