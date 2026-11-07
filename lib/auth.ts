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
  callbacks: {
    async session({ session, token }) {
      if (session.user && token) {
        // Attach custom fields dari token ke session
        (session.user as typeof session.user & {
          hubName: string | null;
          hubUser: string | null;
          isAuthorized: boolean;
        }).hubName = (token.hubName as string | null) ?? null;
        (session.user as typeof session.user & {
          hubName: string | null;
          hubUser: string | null;
          isAuthorized: boolean;
        }).hubUser = (token.hubUser as string | null) ?? null;
        (session.user as typeof session.user & {
          hubName: string | null;
          hubUser: string | null;
          isAuthorized: boolean;
        }).isAuthorized = (token.isAuthorized as boolean) ?? false;
      }
      return session;
    },
    async jwt({ token, user }) {
      const now = Date.now();
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
    };
  }
}
