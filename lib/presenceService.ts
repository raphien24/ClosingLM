import { appendRow, ensureSheet, getSheetData, updateRow } from "./sheets";
import { getAllUserMappings } from "./userMapping";

const PRESENCE_SHEET = "USER_PRESENCE";
const PRESENCE_HEADERS = ["email", "nama_user", "nama_hub", "google_image", "last_seen_ms"];

const COL_EMAIL = 0;
const COL_NAMA_USER = 1;
const COL_NAMA_HUB = 2;
const COL_GOOGLE_IMAGE = 3;
const COL_LAST_SEEN_MS = 4;

// User dianggap masih membuka aplikasi jika heartbeat terakhir <= 90 detik lalu
const PRESENCE_ONLINE_WINDOW_MS = 90_000;
// Hemat kuota tulis Google Sheets: tulis ulang maksimal setiap 35 detik per user jika metadata sama
const PRESENCE_WRITE_THROTTLE_MS = 35_000;
// Cache pembacaan sheet presence singkat agar polling paralel tidak membebani kuota read
const PRESENCE_READ_CACHE_TTL_MS = 15_000;

export interface ActiveUserPresence {
  email: string;
  nama_user: string;
  nama_hub: string;
  avatar_url: string;
  last_seen_ms: number;
  isCurrentUser: boolean;
}

interface RawPresenceRow {
  rowIndex: number;
  email: string;
  nama_user: string;
  nama_hub: string;
  google_image: string;
  last_seen_ms: number;
}

let presenceSheetEnsured = false;
let presenceMutex: Promise<void> = Promise.resolve();
let presenceSnapshotCache: { rows: RawPresenceRow[]; expiresAt: number } | null = null;

// Track per-instance write terakhir agar navigasi cepat antar halaman tidak boros kuota Sheets
const lastWrittenMap = new Map<
  string,
  { nama_user: string; nama_hub: string; google_image: string; wroteAt: number }
>();

function withPresenceLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = presenceMutex.then(fn, fn);
  presenceMutex = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function ensurePresenceSheetReady(): Promise<void> {
  if (presenceSheetEnsured) return;
  await ensureSheet(PRESENCE_SHEET, PRESENCE_HEADERS, { hidden: true });
  presenceSheetEnsured = true;
}

function parsePresenceRows(data: string[][]): RawPresenceRow[] {
  const rows: RawPresenceRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const email = String(r?.[COL_EMAIL] ?? "").trim().toLowerCase();
    if (!email) continue;
    const lastSeenMs = Number(r?.[COL_LAST_SEEN_MS] ?? 0) || 0;
    rows.push({
      rowIndex: i + 1,
      email,
      nama_user: String(r?.[COL_NAMA_USER] ?? "").trim(),
      nama_hub: String(r?.[COL_NAMA_HUB] ?? "").trim(),
      google_image: String(r?.[COL_GOOGLE_IMAGE] ?? "").trim(),
      last_seen_ms: lastSeenMs,
    });
  }
  return rows;
}

function sanitizeGoogleImageUrl(raw?: string | null): string {
  const val = String(raw ?? "").trim();
  if (!val || val.length > 2000) return "";
  if (/^https?:\/\//i.test(val)) return val;
  return "";
}

async function readPresenceRows(): Promise<RawPresenceRow[]> {
  const now = Date.now();
  if (presenceSnapshotCache && presenceSnapshotCache.expiresAt > now) {
    return presenceSnapshotCache.rows;
  }
  await ensurePresenceSheetReady();
  const data = await getSheetData(PRESENCE_SHEET, { skipCache: true });
  const rows = parsePresenceRows(data);
  presenceSnapshotCache = {
    rows,
    expiresAt: Date.now() + PRESENCE_READ_CACHE_TTL_MS,
  };
  return rows;
}

function patchInMemorySnapshot(entry: Omit<RawPresenceRow, "rowIndex">, rowIndex?: number) {
  if (!presenceSnapshotCache) return;
  const idx = presenceSnapshotCache.rows.findIndex((r) => r.email === entry.email);
  if (idx >= 0) {
    presenceSnapshotCache.rows[idx] = {
      ...presenceSnapshotCache.rows[idx],
      ...entry,
    };
  } else if (rowIndex) {
    presenceSnapshotCache.rows.push({ rowIndex, ...entry });
  }
}

export async function recordUserPresence(params: {
  email: string;
  namaUser: string;
  namaHub: string;
  googleImage?: string | null;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  if (!email) return;

  const namaUser = params.namaUser.trim() || email.split("@")[0];
  const namaHub = params.namaHub.trim();
  const googleImage = sanitizeGoogleImageUrl(params.googleImage);
  const now = Date.now();

  const last = lastWrittenMap.get(email);
  if (
    last &&
    now - last.wroteAt < PRESENCE_WRITE_THROTTLE_MS &&
    last.nama_hub === namaHub &&
    last.nama_user === namaUser &&
    last.google_image === googleImage
  ) {
    // Tetap perbarui snapshot lokal instance agar respons UI langsung up-to-date
    patchInMemorySnapshot({
      email,
      nama_user: namaUser,
      nama_hub: namaHub,
      google_image: googleImage,
      last_seen_ms: now,
    });
    return;
  }

  await withPresenceLock(async () => {
    await ensurePresenceSheetReady();
    const data = await getSheetData(PRESENCE_SHEET, { skipCache: true });
    const rows = parsePresenceRows(data);
    const existing = rows.find((r) => r.email === email);
    const values = [email, namaUser, namaHub, googleImage, String(now)];

    if (existing) {
      await updateRow(PRESENCE_SHEET, existing.rowIndex, values);
      patchInMemorySnapshot(
        {
          email,
          nama_user: namaUser,
          nama_hub: namaHub,
          google_image: googleImage,
          last_seen_ms: now,
        },
        existing.rowIndex
      );
    } else {
      const insertedRow = await appendRow(PRESENCE_SHEET, values);
      patchInMemorySnapshot(
        {
          email,
          nama_user: namaUser,
          nama_hub: namaHub,
          google_image: googleImage,
          last_seen_ms: now,
        },
        insertedRow
      );
    }

    lastWrittenMap.set(email, {
      nama_user: namaUser,
      nama_hub: namaHub,
      google_image: googleImage,
      wroteAt: now,
    });
    presenceSnapshotCache = null;
  });
}

export async function markUserPresenceOffline(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  lastWrittenMap.delete(normalized);

  await withPresenceLock(async () => {
    await ensurePresenceSheetReady();
    const data = await getSheetData(PRESENCE_SHEET, { skipCache: true });
    const rows = parsePresenceRows(data);
    const existing = rows.find((r) => r.email === normalized);
    if (!existing) return;

    await updateRow(PRESENCE_SHEET, existing.rowIndex, [
      existing.email,
      existing.nama_user,
      existing.nama_hub,
      existing.google_image,
      "0",
    ]);
    presenceSnapshotCache = null;
  });
}

export async function getActiveUsers(
  currentUserEmail?: string | null
): Promise<ActiveUserPresence[]> {
  const [rows, mappings] = await Promise.all([
    readPresenceRows(),
    getAllUserMappings().catch(() => []),
  ]);

  const now = Date.now();
  const normalizedCurrent = String(currentUserEmail ?? "").trim().toLowerCase();

  // Indeks profil terbaru dari USER_MAPPING (nama_user & foto custom)
  const profileByEmail = new Map<
    string,
    { nama_user: string; avatar_url: string }
  >();
  for (const m of mappings) {
    if (m.status !== "active") continue;
    const prev = profileByEmail.get(m.email);
    profileByEmail.set(m.email, {
      nama_user: m.nama_user || prev?.nama_user || "",
      avatar_url: m.avatar_url || prev?.avatar_url || "",
    });
  }

  const deduped = new Map<string, ActiveUserPresence>();
  for (const row of rows) {
    if (!row.last_seen_ms || now - row.last_seen_ms > PRESENCE_ONLINE_WINDOW_MS) {
      continue;
    }
    const mapped = profileByEmail.get(row.email);
    const nickname =
      mapped?.nama_user?.trim() ||
      row.nama_user?.trim() ||
      row.email.split("@")[0];
    const avatarUrl = mapped?.avatar_url?.trim() || row.google_image || "";

    const existing = deduped.get(row.email);
    if (!existing || row.last_seen_ms > existing.last_seen_ms) {
      deduped.set(row.email, {
        email: row.email,
        nama_user: nickname,
        nama_hub: row.nama_hub,
        avatar_url: avatarUrl,
        last_seen_ms: row.last_seen_ms,
        isCurrentUser: Boolean(normalizedCurrent && row.email === normalizedCurrent),
      });
    }
  }

  // Prioritaskan user lain tampil di slot depan, lalu urutkan paling baru aktif
  return Array.from(deduped.values()).sort((a, b) => {
    if (a.isCurrentUser !== b.isCurrentUser) {
      return a.isCurrentUser ? 1 : -1;
    }
    return b.last_seen_ms - a.last_seen_ms;
  });
}
