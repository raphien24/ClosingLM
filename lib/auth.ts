import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getUserHub } from "./userMapping";

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
        (session.user as typeof session.user & {
          hubName: string | null;
          hubUser: string | null;
          isAuthorized: boolean;
          isExpired: boolean;
        }).hubName = (token.hubName as string | null) ?? null;
        (session.user as typeof session.user & {
          hubName: string | null;
          hubUser: string | null;
          isAuthorized: boolean;
          isExpired: boolean;
        }).hubUser = (token.hubUser as string | null) ?? null;
        (session.user as typeof session.user & {
          hubName: string | null;
          hubUser: string | null;
          isAuthorized: boolean;
          isExpired: boolean;
        }).isAuthorized = !isExpired && ((token.isAuthorized as boolean) ?? false);
        (session.user as typeof session.user & {
          hubName: string | null;
          hubUser: string | null;
          isAuthorized: boolean;
          isExpired: boolean;
        }).isExpired = isExpired;
      }
      return session;
    },
    async jwt({ token, user }) {
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
        !token.checkedAt ||
        now - Number(token.checkedAt) > RECHECK_MS;

      if (email && shouldCheck) {
        try {
          const hubInfo = await getUserHub(email);
          token.hubName = hubInfo?.nama_hub ?? null;
          token.hubUser = hubInfo?.nama_user ?? null;
          token.isAuthorized = !!hubInfo;
          token.checkedAt = now;
        } catch (error) {
          console.error("Error looking up user hub:", error);
          if (user) {
            token.hubName = null;
            token.hubUser = null;
            token.isAuthorized = false;
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
      hubUser: string | null;
      isAuthorized: boolean;
      isExpired?: boolean;
    };
  }
}
