import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { getUserHubs } from "./userMapping";
import { isAdminEmail } from "./adminService";

export const ACTIVE_HUB_COOKIE = "jtt08_active_hub";

export interface ResolvedHubAccess {
  email: string;
  activeHub: string;
  allowedHubs: string[];
  isAdmin: boolean;
}

/**
 * Menentukan daftar seluruh Hub yang dapat diakses user dari USER_MAPPING
 * serta Hub aktif saat ini (berdasarkan cookie jtt08_active_hub yang tervalidasi).
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

  const allowedHubs =
    hubs.length > 0 ? hubs : isAdmin ? [user.hubName || "Soko Hub"] : [];

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

  return {
    email,
    activeHub: matchedCookie || matchedSession || allowedHubs[0],
    allowedHubs,
    isAdmin,
  };
}
