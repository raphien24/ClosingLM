"use client";

import { useEffect, useState } from "react";
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

/**
 * Mengambil nama tampilan & avatar profil terbaru (disinkronkan dengan /api/profile
 * dan event "jtt08-profile-updated") untuk dipakai konsisten di Navbar & Dashboard.
 */
export function useUserProfileDisplay() {
  const auth = useAuth();
  const [customAvatar, setCustomAvatar] = useState<string>("");
  const [customName, setCustomName] = useState<string | null>(null);

  useEffect(() => {
    setCustomAvatar("");
    setCustomName(null);
    if (!auth.user?.email) return;
    let active = true;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json?.profile) return;
        setCustomAvatar(json.profile.avatar_url || "");
        if (json.profile.nama_user) setCustomName(json.profile.nama_user);
      })
      .catch(() => {});

    const onProfileUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ nama_user?: string; avatar_url?: string }>).detail;
      if (!detail) return;
      if (typeof detail.avatar_url === "string") setCustomAvatar(detail.avatar_url);
      if (typeof detail.nama_user === "string") setCustomName(detail.nama_user);
    };
    window.addEventListener("jtt08-profile-updated", onProfileUpdated);
    return () => {
      active = false;
      window.removeEventListener("jtt08-profile-updated", onProfileUpdated);
    };
  }, [auth.user?.email]);

  const displayName = customName || auth.hubUser || auth.user?.name || "";
  const avatarSrc = customAvatar || auth.user?.image || "";

  return {
    ...auth,
    displayName,
    avatarSrc,
  };
}
