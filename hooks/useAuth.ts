"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { isOwnerAdminEmail, isSuperAdminEmail } from "@/lib/authConstants";

export interface AuthUser {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  hubName: string | null;
  hubs?: string[];
  hubUser: string | null;
  isAuthorized: boolean;
  isSuperAdmin?: boolean;
  isOwnerAdmin?: boolean;
}

export function useAuth() {
  const { data: session, status, update } = useSession();

  const user = session?.user as AuthUser | undefined;
  const hubs =
    Array.isArray(user?.hubs) && user.hubs.length > 0
      ? user.hubs
      : user?.hubName
        ? [user.hubName]
        : [];

  const switchHub = async (nextHub: string) => {
    const res = await fetch("/api/active-hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hubName: nextHub }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.activeHub) {
      throw new Error(json?.error || "Gagal mengganti Hub aktif");
    }
    await update({ activeHub: json.activeHub });
    window.location.reload();
  };

  return {
    user: user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    isAuthorized: user?.isAuthorized ?? false,
    isSuperAdmin: user?.isSuperAdmin ?? isSuperAdminEmail(user?.email),
    isOwnerAdmin: user?.isOwnerAdmin ?? isOwnerAdminEmail(user?.email),
    hubName: user?.hubName ?? null,
    hubs,
    hubUser: user?.hubUser ?? null,
    refreshSession: update,
    switchHub,
  };
}

export interface HubConsistencyStatus {
  isConsistent: boolean;
  isEligible?: boolean;
  borderDisabled?: boolean;
  reason: string;
  currentStreakDays: number;
  completedMonthLabel: string | null;
}

const DEFAULT_CONSISTENCY: HubConsistencyStatus = {
  isConsistent: false,
  isEligible: false,
  borderDisabled: false,
  reason: "",
  currentStreakDays: 0,
  completedMonthLabel: null,
};

/**
 * Mengambil nama tampilan, avatar profil, hub aktif, konsistensi 1 bulan, & status admin live terbaru
 * (disinkronkan dengan /api/profile dan event "jtt08-profile-updated")
 * untuk dipakai konsisten di Navbar, Dashboard, & Halaman Profil.
 */
export function useUserProfileDisplay() {
  const auth = useAuth();
  const [customAvatar, setCustomAvatar] = useState<string>("");
  const [customName, setCustomName] = useState<string | null>(null);
  const [liveIsAdmin, setLiveIsAdmin] = useState<boolean | null>(null);
  const [liveActiveHub, setLiveActiveHub] = useState<string | null>(null);
  const [liveHubs, setLiveHubs] = useState<string[] | null>(null);
  const [consistency, setConsistency] = useState<HubConsistencyStatus>(DEFAULT_CONSISTENCY);

  useEffect(() => {
    setCustomAvatar("");
    setCustomName(null);
    setLiveIsAdmin(null);
    setLiveActiveHub(null);
    setLiveHubs(null);
    setConsistency(DEFAULT_CONSISTENCY);
    if (!auth.user?.email) return;
    let active = true;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json?.profile) return;
        setCustomAvatar(json.profile.avatar_url || "");
        if (json.profile.nama_user) setCustomName(json.profile.nama_user);
        if (typeof json.isAdmin === "boolean") setLiveIsAdmin(json.isAdmin);
        if (typeof json.activeHub === "string" && json.activeHub) {
          setLiveActiveHub(json.activeHub);
        }
        if (Array.isArray(json.hubs) && json.hubs.length > 0) {
          setLiveHubs(json.hubs);
        }
        if (json.consistency && typeof json.consistency.isConsistent === "boolean") {
          setConsistency({
            isConsistent: json.consistency.isConsistent,
            isEligible: Boolean(
              json.consistency.isEligible ?? json.consistency.isConsistent
            ),
            borderDisabled: Boolean(json.consistency.borderDisabled),
            reason: json.consistency.reason || "",
            currentStreakDays: Number(json.consistency.currentStreakDays) || 0,
            completedMonthLabel: json.consistency.completedMonthLabel ?? null,
          });
        }
      })
      .catch(() => {});

    const onProfileUpdated = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          nama_user?: string;
          avatar_url?: string;
          consistency_border_disabled?: boolean;
        }>
      ).detail;
      if (!detail) return;
      if (typeof detail.avatar_url === "string") setCustomAvatar(detail.avatar_url);
      if (typeof detail.nama_user === "string") setCustomName(detail.nama_user);
      if (typeof detail.consistency_border_disabled === "boolean") {
        const disabled = detail.consistency_border_disabled;
        setConsistency((prev) => ({
          ...prev,
          borderDisabled: disabled,
          isConsistent: Boolean(prev.isEligible) && !disabled,
        }));
      }
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
    hubName: liveActiveHub ?? auth.hubName,
    hubs: liveHubs ?? auth.hubs,
    isSuperAdmin: liveIsAdmin ?? auth.isSuperAdmin,
    consistency,
    displayName,
    avatarSrc,
  };
}
