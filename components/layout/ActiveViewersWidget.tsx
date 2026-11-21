"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveUserPresence } from "@/lib/presenceService";
import {
  ConsistentBadgePill,
  ProfileAvatarFrame,
} from "@/components/ui/ProfileAvatarFrame";

interface ActiveViewersWidgetProps {
  userEmail?: string | null;
  hubName?: string | null;
  onOpenPopover?: () => void;
}

const HEARTBEAT_INTERVAL_MS = 40_000;
const VISIBILITY_DEBOUNCE_MS = 15_000;

const RING_PALETTE = [
  { ring: "ring-2 ring-rose-500", bg: "bg-gradient-to-br from-rose-600 to-red-800 text-white" },
  { ring: "ring-2 ring-amber-500", bg: "bg-gradient-to-br from-amber-500 to-orange-700 text-white" },
  { ring: "ring-2 ring-emerald-500", bg: "bg-gradient-to-br from-emerald-600 to-teal-800 text-white" },
  { ring: "ring-2 ring-sky-500", bg: "bg-gradient-to-br from-sky-600 to-blue-800 text-white" },
  { ring: "ring-2 ring-violet-500", bg: "bg-gradient-to-br from-violet-600 to-purple-800 text-white" },
];

function getRingStyle(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  return RING_PALETTE[hash % RING_PALETTE.length];
}

function ViewerAvatar({
  viewer,
  size = "xs",
}: {
  viewer: ActiveUserPresence;
  size?: "xs" | "sm" | "md";
}) {
  const palette = getRingStyle(viewer.email);
  const initial = (viewer.nama_user || viewer.email || "U")[0].toUpperCase();

  return (
    <ProfileAvatarFrame
      src={viewer.avatar_url}
      alt={viewer.nama_user}
      fallbackLetter={initial}
      size={size}
      isConsistent={viewer.isConsistent}
      consistencyReason={viewer.consistencyReason}
      showPlaque={false}
      ringClassName={palette.ring}
      fallbackClassName={palette.bg}
    />
  );
}

export function ActiveViewersWidget({
  userEmail,
  hubName,
  onOpenPopover,
}: ActiveViewersWidgetProps) {
  const [users, setUsers] = useState<ActiveUserPresence[]>([]);
  const [selectedViewerEmail, setSelectedViewerEmail] = useState<string | null>(null);
  const [showAllList, setShowAllList] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastSyncRef = useRef<number>(0);

  const syncPresence = useCallback(async () => {
    if (!userEmail) return;
    lastSyncRef.current = Date.now();
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat" }),
      });
      if (!res.ok) return;
      const json = (await res.json().catch(() => null)) as
        | { users?: ActiveUserPresence[] }
        | null;
      if (Array.isArray(json?.users)) {
        setUsers(json.users);
      }
    } catch {
      // Abaikan gangguan jaringan sementara pada background polling
    }
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) return;
    void syncPresence();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncPresence();
      }
    }, HEARTBEAT_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastSyncRef.current >= VISIBILITY_DEBOUNCE_MS
      ) {
        void syncPresence();
      }
    };

    const onProfileUpdated = () => {
      void syncPresence();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("jtt08-profile-updated", onProfileUpdated);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("jtt08-profile-updated", onProfileUpdated);
    };
  }, [userEmail, hubName, syncPresence]);

  useEffect(() => {
    const handleOutsideClick = (ev: MouseEvent) => {
      if (!containerRef.current?.contains(ev.target as Node)) {
        setSelectedViewerEmail(null);
        setShowAllList(false);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setSelectedViewerEmail(null);
        setShowAllList(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!userEmail || users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, 2);
  const extraCount = Math.max(0, users.length - 2);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1 flex-shrink-0">
      {visibleUsers.map((viewer) => {
        const isSelected = selectedViewerEmail === viewer.email;
        return (
          <div key={viewer.email} className="relative">
            <button
              type="button"
              onClick={() => {
                onOpenPopover?.();
                setShowAllList(false);
                setSelectedViewerEmail((prev) =>
                  prev === viewer.email ? null : viewer.email
                );
              }}
              aria-label={`Lihat user aktif: ${viewer.nama_user}`}
              title={`${viewer.nama_user}${viewer.isCurrentUser ? " (Anda)" : ""}${viewer.isConsistent ? " · Si Paling Konsisten" : ""}`}
              className={cn(
                "relative rounded-full p-0.5 transition-transform duration-150 hover:scale-105 focus:outline-none cursor-pointer",
                isSelected && "scale-105"
              )}
            >
              <ViewerAvatar viewer={viewer} size="xs" />
            </button>

            {isSelected && (
              <div className="animate-dropdown absolute right-0 mt-2 w-60 bg-[#0d1727]/98 backdrop-blur-md rounded-xl shadow-[0_14px_34px_-6px_rgba(2,6,15,0.85)] border border-amber-400/45 overflow-hidden z-50">
                <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                <div className="px-3.5 py-2.5 flex items-center gap-2.5">
                  <ViewerAvatar viewer={viewer} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      <p className="text-xs font-bold text-amber-50 truncate">
                        {viewer.nama_user}
                        {viewer.isCurrentUser && (
                          <span className="ml-1 text-[10px] font-medium text-amber-300/80">
                            (Anda)
                          </span>
                        )}
                      </p>
                    </div>
                    {viewer.nama_hub && (
                      <p className="text-[11px] text-slate-300/85 truncate mt-0.5">
                        {viewer.nama_hub}
                      </p>
                    )}
                    {viewer.isConsistent && (
                      <ConsistentBadgePill
                        compact
                        reason={viewer.consistencyReason}
                        className="mt-1.5"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {extraCount > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              onOpenPopover?.();
              setSelectedViewerEmail(null);
              setShowAllList((prev) => !prev);
            }}
            aria-label={`${extraCount} user lainnya sedang membuka aplikasi`}
            title={`Lihat semua ${users.length} user aktif`}
            className={cn(
              "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-extrabold border-2 transition-all duration-150 cursor-pointer shadow-xs",
              showAllList
                ? "bg-amber-400 text-[#131d2f] border-amber-200 scale-105"
                : "bg-[#1a2942] hover:bg-[#233657] text-amber-100 border-amber-400/60 hover:border-amber-300 hover:scale-105"
            )}
          >
            {extraCount}+
          </button>

          {showAllList && (
            <div className="animate-dropdown absolute right-0 mt-2 w-72 bg-[#0d1727]/98 backdrop-blur-md rounded-2xl shadow-[0_18px_42px_-8px_rgba(2,6,15,0.88)] border border-amber-400/45 overflow-hidden z-50">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              <div className="px-3.5 py-2.5 bg-[#121e33] border-b border-amber-400/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="h-3.5 w-3.5 text-amber-300 flex-shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200 truncate">
                    Sedang Membuka App
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex-shrink-0">
                  {users.length} aktif
                </span>
              </div>

              <div className="py-1.5 px-1.5 max-h-64 overflow-y-auto space-y-0.5">
                {users.map((viewer) => (
                  <div
                    key={viewer.email}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-amber-400/10 transition-colors"
                  >
                    <ViewerAvatar viewer={viewer} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <p className="text-xs font-semibold text-amber-50 truncate">
                          {viewer.nama_user}
                          {viewer.isCurrentUser && (
                            <span className="ml-1 text-[10px] font-normal text-amber-300/80">
                              (Anda)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {viewer.nama_hub && (
                          <p className="text-[10px] text-slate-400 truncate">
                            {viewer.nama_hub}
                          </p>
                        )}
                        {viewer.isConsistent && (
                          <ConsistentBadgePill compact reason={viewer.consistencyReason} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
