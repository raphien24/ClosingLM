export const OWNER_ADMIN_EMAIL = "rafi.alvian@spxexpress.com";

export const SUPER_ADMIN_EMAILS = [
  "rafi.alvian@spxexpress.com",
  "rafiagusalvian@gmail.com",
  "raphien24@gmail.com",
];

export const SUPER_ADMIN_EMAIL = OWNER_ADMIN_EMAIL;

export function isOwnerAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return String(email).trim().toLowerCase() === OWNER_ADMIN_EMAIL;
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.includes(normalized);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Karakter yang dilarang pada nama tab Google Sheets (karena sheet Productivity memakai prefix RAW_/TARGETS_ + nama hub)
export const INVALID_HUB_NAME_CHARS = /[\\/*?:[\]]/;
