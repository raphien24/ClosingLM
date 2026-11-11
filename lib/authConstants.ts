export const SUPER_ADMIN_EMAIL = "rafi.alvian@spxexpress.com";

export function isSuperAdminEmail(email?: string | null): boolean {
  return String(email ?? "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Karakter yang dilarang pada nama tab Google Sheets (karena sheet Productivity memakai prefix RAW_/TARGETS_ + nama hub)
export const INVALID_HUB_NAME_CHARS = /[\\/*?:[\]]/;
