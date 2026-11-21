"use client";

import { Suspense, useRef } from "react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ClosingInsightCards } from "@/components/dashboard/ClosingInsightCards";
import { HubTable } from "@/components/dashboard/HubTable";
import { HubClosingDetailModal } from "@/components/dashboard/HubClosingDetailModal";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { ClosingData } from "@/types/closing";
import { todayWIB } from "@/lib/dateUtils";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import { useUserProfileDisplay } from "@/hooks/useAuth";
import {
  ConsistentBadgePill,
  ProfileAvatarFrame,
} from "@/components/ui/ProfileAvatarFrame";
import { SunsetSailTransition } from "@/components/ocean/SunsetSailTransition";
import { DashboardShipWipeOverlay } from "@/components/ocean/DashboardShipWipeOverlay";
import {
  NauticalChartBackdrop,
  SailorCompassIcon,
} from "@/components/productivity/MaritimeAnimations";

function DashboardFallback() {
  const isSail =
    typeof window !== "undefined" &&
    window.location.search.includes("sail=1") &&
    !sessionStorage.getItem("jtt08_sail_played");

  if (isSail) {
    return (
      <div className="fixed inset-0 w-screen h-screen z-[999999] bg-[#0b1120]" />
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="h-10 w-64 bg-gray-200/60 dark:bg-slate-800 animate-pulse rounded mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-gray-200/60 dark:bg-slate-800 animate-pulse rounded-xl"
          />
        ))}
      </div>
      <div className="h-12 bg-gray-200/60 dark:bg-slate-800 animate-pulse rounded-xl mb-4" />
      <div className="h-96 bg-gray-200/60 dark:bg-slate-800 animate-pulse rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, displayName, avatarSrc, consistency } = useUserProfileDisplay();

  const today = todayWIB();
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get("date") || today
  );
  const [selectedHubs, setSelectedHubs] = useState<string[]>(
    searchParams.get("hub")?.split(",").filter(Boolean) || []
  );

  const [closingData, setClosingData] = useState<ClosingData[]>([]);
  const [allHubs, setAllHubs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHubDetail, setSelectedHubDetail] = useState<ClosingData | null>(null);

  // Animasi 3D POV Kapten hanya berjalan saat sudah BENAR-BENAR BERHASIL LOGIN (?sail=1)
  // dan belum pernah diputar pada sesi ini
  const isSailParam = searchParams.get("sail") === "1";
  const [showSail, setShowSail] = useState(() => {
    if (typeof window !== "undefined" && isSailParam) {
      if (sessionStorage.getItem("jtt08_sail_played")) {
        return false;
      }
      return true;
    }
    return isSailParam;
  });
  const [dashboardReady, setDashboardReady] = useState(() => !showSail);
  const hadShipRevealRef = useRef(showSail);
  const [revealStage, setRevealStage] = useState<
    "pre" | "sailing" | "assembling" | "done"
  >(() => (showSail ? "pre" : "done"));

  const handleReadyForDashboard = useCallback(() => {
    setDashboardReady(true);
  }, []);

  useEffect(() => {
    if (!showSail) {
      delete document.documentElement.dataset.sailPending;
    }
  }, [showSail]);

  const handleSailComplete = useCallback(() => {
    setShowSail(false);
    setDashboardReady(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("jtt08_sail_played", "1");
      delete document.documentElement.dataset.sailPending;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRevealStage(reduced ? "done" : "sailing");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("sail");
    const query = params.toString();
    router.replace(`/dashboard${query ? `?${query}` : ""}`, { scroll: false });
  }, [searchParams, router]);

  const handleShipPassed = useCallback(() => {
    setRevealStage("assembling");
  }, []);

  useEffect(() => {
    if (revealStage !== "assembling") return;
    const timer = setTimeout(() => setRevealStage("done"), 1300);
    return () => clearTimeout(timer);
  }, [revealStage]);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("date", selectedDate);
      if (selectedHubs.length > 0) {
        params.set("hub", selectedHubs.join(","));
      }

      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data dashboard");
      }

      const json = await res.json();
      setClosingData(json.closingData || []);
      setAllHubs(json.allHubs || []);
    } catch (err) {
      toast.error("Gagal memuat data. Coba refresh halaman.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, selectedHubs]);

  // Sync URL dengan filter tanpa menghapus parameter lain seperti ?sail=1 jika masih aktif
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedDate !== today) {
      params.set("date", selectedDate);
    } else {
      params.delete("date");
    }
    if (selectedHubs.length > 0) {
      params.set("hub", selectedHubs.join(","));
    } else {
      params.delete("hub");
    }
    const currentQuery = searchParams.toString();
    const newQuery = params.toString();
    if (currentQuery !== newQuery) {
      router.replace(`/dashboard${newQuery ? `?${newQuery}` : ""}`, { scroll: false });
    }
  }, [selectedDate, selectedHubs, today, router, searchParams]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const isToday = selectedDate === today;

  return (
    <>
      {showSail && (
        <SunsetSailTransition
          userName={user?.name}
          onReadyForDashboard={handleReadyForDashboard}
          onComplete={handleSailComplete}
        />
      )}

      {dashboardReady && (revealStage === "pre" || revealStage === "sailing") && (
        <DashboardShipWipeOverlay
          phase={revealStage === "sailing" ? "sailing" : "curtain"}
          onShipPassed={handleShipPassed}
        />
      )}

      {/* JANGAN render atau tampilkan elemen dashboard sebelum animasi mengemudi selesai */}
      {dashboardReady && (
        <div
          className={`min-h-screen bg-[#e7eef4] dark:bg-transparent ${
            revealStage !== "done" ? "overflow-x-clip" : ""
          }`}
        >
          <div
            className={`w-full px-2 sm:px-4 py-4 space-y-4 ${
              revealStage === "done"
                ? hadShipRevealRef.current
                  ? ""
                  : "animate-page-enter"
                : revealStage === "assembling"
                ? "dashboard-assemble-stage dashboard-assemble-enter"
                : "dashboard-assemble-stage dashboard-assemble-pre"
            }`}
          >
            {/* Page Header — Captain's Logbook Command */}
            <div className="dash-hero relative overflow-hidden bg-gradient-to-r from-[#fffdf9] via-[#f8fafd] to-[#eef4f9] dark:from-[#121d2f] dark:via-[#142338] dark:to-[#10293a] border border-slate-200/90 dark:border-slate-700/80 border-l-4 border-l-amber-600 dark:border-l-amber-400 text-slate-900 dark:text-white rounded-2xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.14)] dark:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.45)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500/75 via-amber-300/60 to-transparent" />
              <NauticalChartBackdrop />

              <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <ProfileAvatarFrame
                    src={avatarSrc}
                    fallbackLetter={(displayName || user?.email || "U")[0].toUpperCase()}
                    size="lg"
                    isConsistent={consistency.isConsistent}
                    consistencyReason={consistency.reason}
                    showPlaque={consistency.isConsistent}
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Welcome Back Sailor
                        {displayName && (
                          <>
                            {" "}
                            <span className="text-amber-700 dark:text-amber-300">{displayName}</span>
                          </>
                        )}
                      </h1>
                      {consistency.isConsistent && (
                        <ConsistentBadgePill reason={consistency.reason} />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap font-medium">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                        Live Monitoring
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span>
                        {isToday
                          ? "Hari ini — " + formatDate(selectedDate)
                          : formatDate(selectedDate)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50/90 dark:bg-slate-800/80 border border-amber-300/70 dark:border-amber-400/35 backdrop-blur-xs text-slate-800 dark:text-amber-100 text-xs font-semibold rounded-full shadow-2xs">
                    <SailorCompassIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                    Harbor Control • JTT08
                  </span>
                  {!isToday && (
                    <span className="px-3 py-1 bg-amber-100/90 dark:bg-amber-400/20 border border-amber-300 dark:border-amber-300/40 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded-full">
                      Mode History
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 5 Operational Insight Cards */}
            <div className="dash-insights">
              <ClosingInsightCards
                data={closingData}
                isLoading={isLoading}
                onSelectHub={setSelectedHubDetail}
              />
            </div>

            {/* Filter Bar */}
            <div className="dash-filter">
              <FilterBar
                allHubs={allHubs}
                missingHubs={closingData.filter((d) => !d.submitted_at).map((d) => d.nama_hub)}
                selectedDate={selectedDate}
                selectedHubs={selectedHubs}
                onDateChange={setSelectedDate}
                onHubsChange={setSelectedHubs}
                onRefresh={fetchDashboard}
                isLoading={isLoading}
              />
            </div>

            {/* Hub Table */}
            <div className="dash-table">
              <HubTable
                data={closingData}
                isLoading={isLoading}
                onSelectHub={setSelectedHubDetail}
              />
            </div>
          </div>

          <HubClosingDetailModal
            row={selectedHubDetail}
            onClose={() => setSelectedHubDetail(null)}
          />
        </div>
      )}
    </>
  );
}
