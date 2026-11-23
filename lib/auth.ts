import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getAllHubs, getUserHubs } from "./userMapping";
import { isOwnerAdminEmail, isSuperAdminEmail } from "./authConstants";
import { isAdminEmail } from "./adminService";
import { mergeAdminAllowedHubs } from "./activeHub";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // Konfigurasi sesi login: berlaku tepat 24 jam (86.400 detik)
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 jam
    updateAge: 24 * 60 * 60, // Tidak memperpanjang sesi sebelum 24 jam
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 jam
  },
  callbacks: {
    async session({ session, token }) {
      const now = Date.now();
      const MAX_SESSION_MS = 24 * 60 * 60 * 1000; // 24 jam
      const isExpired =
        !token?.loginAt || now - Number(token.loginAt) > MAX_SESSION_MS;

      if (session.user && token) {
        // Attach custom fields dari token ke session
        const extendedUser = session.user as typeof session.user & {
          hubName: string | null;
          hubs: string[];
          writableHubs: string[];
          hubUser: string | null;
          isAuthorized: boolean;
          isExpired: boolean;
          isSuperAdmin: boolean;
          isOwnerAdmin: boolean;
          isReadOnlyAdmin: boolean;
        };
        const userEmail = (session.user.email || token.email) as string | undefined;
        const hubs = Array.isArray(token.hubs)
          ? (token.hubs as string[])
          : token.hubName
            ? [token.hubName as string]
            : [];
        const resolvedIsAdmin =
          !isExpired &&
          (typeof token.isAdmin === "boolean"
            ? token.isAdmin
            : isSuperAdminEmail(userEmail));
        const resolvedIsOwner = !isExpired && isOwnerAdminEmail(userEmail);
        const activeHub = (token.hubName as string | null) ?? hubs[0] ?? null;
        const writableHubs = Array.isArray(token.writableHubs)
          ? (token.writableHubs as string[])
          : !resolvedIsAdmin
            ? hubs
            : [];
        const canEditActiveHub =
          !resolvedIsAdmin ||
          (Boolean(activeHub) &&
            writableHubs.some(
              (h) => h.toLowerCase() === activeHub!.toLowerCase()
            ));

        extendedUser.hubName = activeHub;
        extendedUser.hubs = hubs;
        extendedUser.writableHubs = writableHubs;
        extendedUser.hubUser = (token.hubUser as string | null) ?? null;
        extendedUser.isAuthorized = !isExpired && ((token.isAuthorized as boolean) ?? false);
        extendedUser.isExpired = isExpired;
        extendedUser.isSuperAdmin = resolvedIsAdmin;
        extendedUser.isOwnerAdmin = resolvedIsOwner;
        extendedUser.isReadOnlyAdmin = resolvedIsAdmin && !canEditActiveHub;
      }
      return session;
    },
    async jwt({ token, user, trigger, session }) {
      const now = Date.now();
      const MAX_SESSION_MS = 24 * 60 * 60 * 1000; // 24 jam

      // Catat timestamp login saat pertama kali autentikasi
      if (user) {
        token.loginAt = now;
      }

      // Validasi mutlak 24 jam: jika sudah melewati 24 jam sejak login,
      // kembalikan null untuk mengakhiri sesi dan membersihkan cookie login
      if (token.loginAt && now - Number(token.loginAt) > MAX_SESSION_MS) {
        return null;
      }

      const RECHECK_MS = 60 * 60 * 1000; // 1 jam
      const email = (user?.email || token.email) as string | undefined;
      const shouldCheck =
        !!user ||
        trigger === "update" ||
        !token.checkedAt ||
        now - Number(token.checkedAt) > RECHECK_MS;

      const isUpdateTrigger = (trigger as string | undefined) === "update";
      const shouldFetch = shouldCheck || isUpdateTrigger;
      if (email && shouldFetch) {
        const isSuper = await isAdminEmail(email);
        try {
          const [hubInfo, allHubs] = await Promise.all([
            getUserHubs(email),
            isSuper ? getAllHubs().catch(() => [] as string[]) : Promise.resolve([] as string[]),
          ]);
          const hubs = isSuper
            ? mergeAdminAllowedHubs(hubInfo.hubs, allHubs)
            : hubInfo.hubs;

          const requestedHub =
            isUpdateTrigger &&
            session &&
            typeof (session as { activeHub?: unknown }).activeHub === "string"
              ? (session as { activeHub: string }).activeHub.trim()
              : null;

          const matchedRequested = requestedHub
            ? hubs.find((h) => h.toLowerCase() === requestedHub.toLowerCase()) ?? null
            : null;
          const previousHub =
            typeof token.hubName === "string"
              ? hubs.find((h) => h.toLowerCase() === token.hubName!.toString().toLowerCase()) ?? null
              : null;

          token.hubs = hubs;
          token.writableHubs = hubInfo.hubs;
          token.hubName = matchedRequested ?? previousHub ?? hubs[0] ?? null;
          token.hubUser = hubInfo.nama_user ?? (isSuper ? (user?.name || "Admin") : null);
          token.isAuthorized = hubs.length > 0 || isSuper;
          token.isAdmin = isSuper;
          token.checkedAt = now;
        } catch (error) {
          console.error("Error looking up user hub:", error);
          if (isSuper) {
            token.hubs = ["Soko Hub"];
            token.writableHubs = [];
            token.hubName = "Soko Hub";
            token.hubUser = user?.name || "Admin";
            token.isAuthorized = true;
            token.isAdmin = true;
            token.checkedAt = now;
          } else if (user) {
            token.hubs = [];
            token.writableHubs = [];
            token.hubName = null;
            token.hubUser = null;
            token.isAuthorized = false;
            token.isAdmin = false;
          }
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/unauthorized",
  },
  trustHost: true,
});

// Type augmentation untuk session
declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      hubName: string | null;
      hubs?: string[];
      writableHubs?: string[];
      hubUser: string | null;
      isAuthorized: boolean;
      isExpired?: boolean;
      isSuperAdmin?: boolean;
      isOwnerAdmin?: boolean;
      isReadOnlyAdmin?: boolean;
    };
  }
}
