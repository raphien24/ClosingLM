"use client";

import { useSession } from "next-auth/react";

export interface AuthUser {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  hubName: string | null;
  hubUser: string | null;
  isAuthorized: boolean;
}

export function useAuth() {
  const { data: session, status } = useSession();

  const user = session?.user as AuthUser | undefined;

  return {
    user: user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    isAuthorized: user?.isAuthorized ?? false,
    hubName: user?.hubName ?? null,
    hubUser: user?.hubUser ?? null,
  };
}
