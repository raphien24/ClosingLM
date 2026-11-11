"use client";

import { useSession } from "next-auth/react";
import { isSuperAdminEmail } from "@/lib/authConstants";

export interface AuthUser {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  hubName: string | null;
  hubUser: string | null;
  isAuthorized: boolean;
  isSuperAdmin?: boolean;
}

export function useAuth() {
  const { data: session, status, update } = useSession();

  const user = session?.user as AuthUser | undefined;

  return {
    user: user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    isAuthorized: user?.isAuthorized ?? false,
    isSuperAdmin: user?.isSuperAdmin ?? isSuperAdminEmail(user?.email),
    hubName: user?.hubName ?? null,
    hubUser: user?.hubUser ?? null,
    refreshSession: update,
  };
}
