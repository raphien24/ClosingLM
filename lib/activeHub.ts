import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { getAllHubs, getUserHubs } from "./userMapping";
import { isOwnerAdminEmail } from "./authConstants";
import { isAdminEmail } from "./adminService";

export const ACTIVE_HUB_COOKIE = "jtt08_active_hub";

export interface ResolvedHubAccess {
  email: string;
  activeHub: string;
  allowedHubs: string[];
  writableHubs: string[];
  isAdmin: boolean;
  isOwner: boolean;
  isReadOnlyAdmin: boolean;
}

/**
 * Gabungkan daftar Hub yang dapat dilihat oleh Admin (seluruh Hub aktif di area)
 * dengan prioritas Hub milik akun / fallback di urutan awal agar default tetap konsisten.
 */
export function mergeAdminAllowedHubs(
  mappedHubs: string[],
  allHubs: string[],
  fallbackHub?: string | null
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const pushUnique = (hub: string) => {
    const trimmed = hub.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  };

  for (const h of mappedHubs) pushUnique(h);
  if (mappedHubs.length === 0) {
    pushUnique(fallbackHub || "Soko Hub");
  }
  const sortedAll = [...allHubs].sort((a, b) => a.localeCompare(b, "id"));
  for (const h of sortedAll) pushUnique(h);

  return result;
}

/**
 * Helper terpusat untuk menolak operasi tulis/input/edit bila akun berstatus Admin View-Only (bukan Owner).
 */
export function denyIfReadOnlyAdmin(
  access: ResolvedHubAccess,
  actionLabel = "mengubah data"
): string | null {
  if (access.isReadOnlyAdmin) {
    return `Akses ditolak: Untuk Hub "${access.activeHub}", Anda hanya memiliki akses View (hanya dapat ${actionLabel} di Hub milik Anda sendiri).`;
  }
  return null;
}

/**
 * Menentukan daftar seluruh Hub yang dapat diakses user dari USER_MAPPING
 * serta Hub aktif saat ini (berdasarkan cookie jtt08_active_hub yang tervalidasi).
 * Untuk Admin aktif, seluruh Hub di area tersedia dengan hak akses View-Only (kecuali Owner).
 */
export async function resolveActiveHubForSession(
  session: Session | null,
  options?: { skipCache?: boolean }
): Promise<ResolvedHubAccess | null> {
  if (!session?.user) return null;

  const user = session.user as typeof session.user & {
    hubName?: string | null;
    isAuthorized?: boolean;
  };
  const email = String(user.email ?? "").trim().toLowerCase();
  if (!user.isAuthorized || !email) return null;

  const [{ hubs }, isAdmin] = await Promise.all([
    getUserHubs(email, { skipCache: options?.skipCache }),
    isAdminEmail(email),
  ]);

  let allowedHubs: string[];
  if (isAdmin) {
    const allHubs = await getAllHubs().catch(() => [] as string[]);
    allowedHubs = mergeAdminAllowedHubs(hubs, allHubs, user.hubName);
  } else {
    allowedHubs = hubs;
  }

  if (allowedHubs.length === 0) return null;

  let requestedHub = "";
  try {
    const cookieStore = await cookies();
    requestedHub = cookieStore.get(ACTIVE_HUB_COOKIE)?.value?.trim() || "";
  } catch {
    requestedHub = "";
  }

  const matchedCookie = requestedHub
    ? allowedHubs.find((h) => h.toLowerCase() === requestedHub.toLowerCase())
    : undefined;
  const matchedSession = user.hubName
    ? allowedHubs.find((h) => h.toLowerCase() === user.hubName!.toLowerCase())
    : undefined;

  const isOwner = isOwnerAdminEmail(email);
  const activeHub = matchedCookie || matchedSession || allowedHubs[0];
  const writableHubs = hubs;
  const canEditActiveHub =
    !isAdmin ||
    writableHubs.some((h) => h.toLowerCase() === activeHub.toLowerCase());

  return {
    email,
    activeHub,
    allowedHubs,
    writableHubs,
    isAdmin,
    isOwner,
    isReadOnlyAdmin: isAdmin && !canEditActiveHub,
  };
}
