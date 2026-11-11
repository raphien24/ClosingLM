/**
 * Utility fungsi tanggal yang aman dipakai di client maupun server.
 * Tidak mengimport googleapis atau modul Node-only.
 */

/**
 * Ambil tanggal hari ini dalam format YYYY-MM-DD sesuai timezone Asia/Jakarta (WIB)
 */
export function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Ambil objek Date yang merepresentasikan tanggal hari ini pukul 00:00:00 WIB
 */
export function nowWIBDate(): Date {
  return parseYMD(todayWIB());
}

/**
 * Ambil timestamp saat ini dalam format "dd-mm-yyyy hh:mm WIB" (contoh: "12-11-2026 00:31 WIB").
 */
export function nowWIBTimestamp(date: Date = new Date()): string {
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const iso = wib.toISOString();
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)} ${iso.slice(11, 16)} WIB`;
}

/**
 * Parse timestamp dari format "dd-mm-yyyy hh:mm WIB" maupun ISO-8601 (+07:00 / Z) menjadi Date.
 */
export function parseTimestamp(raw: string | null | undefined): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\s*WIB)?$/i);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] || "00"}+07:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format Date ke MM/DD/YYYY (format yang dipakai di sheet PRODUCTIVITY_RAW)
 */
export function formatDateForSheet(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

/**
 * Parse YYYY-MM-DD string ke Date dengan timezone Jakarta
 */
export function parseYMD(ymd: string): Date {
  return new Date(ymd + "T00:00:00+07:00");
}

/**
 * Konversi Google Sheets serial date number (misal 46333) ke YYYY-MM-DD
 */
export function serialToYMD(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normalisasi string tanggal dari berbagai format (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, serial number)
 * ke YYYY-MM-DD
 */
export function normalizeToYMD(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  if (typeof raw === "number" && raw > 40000 && raw < 70000) {
    return serialToYMD(raw);
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{5}$/.test(s)) {
    const n = Number(s);
    if (n > 40000 && n < 70000) return serialToYMD(n);
  }
  // Format DD/MM/YYYY atau MM/DD/YYYY
  const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = Number(slash[3]);
    // Jika a > 12 pasti DD/MM/YYYY
    if (a > 12) {
      return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }
    // Jika b > 12 pasti MM/DD/YYYY
    if (b > 12) {
      return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    }
    // Default asumsikan DD/MM/YYYY untuk Indonesia kecuali dari productivity
    return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }
  return s;
}

