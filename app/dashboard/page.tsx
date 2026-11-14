"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { ClosingInsightCards } from "@/components/dashboard/ClosingInsightCards";
import { HubTable } from "@/components/dashboard/HubTable";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { ClosingData, KpiSummary } from "@/types/closing";
import { todayWIB } from "@/lib/dateUtils";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { SunsetSailTransition } from "@/components/ocean/SunsetSailTransition";
import {
  MaritimeWaveBackdrop,
  LighthouseBeaconIcon,
  SailorCompassIcon,
} from "@/components/productivity/MaritimeAnimations";

const defaultKpi: KpiSummary = {
  totalDelivered: 0,
  totalOnhold: 0,
  totalBacklog: 0,
  hubUpdated: 0,
  hubTotal: 0,
};

function DashboardFallback() {
  const isSail =
    typeof window !== "undefined" &&
    window.location.search.includes("sail=1") &&
    !sessionStorage.getItem("jtt08_sail_played");

  if (isSail) {
    return (
      <div className="fixed inset-0 w-screen h-screen z-[999999] bg-[#1b1530]" />
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
  const { user } = useAuth();

  const today = todayWIB();
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get("date") || today
  );
  const [selectedHubs, setSelectedHubs] = useState<string[]>(
    searchParams.get("hub")?.split(",").filter(Boolean) || []
  );

  const [closingData, setClosingData] = useState<ClosingData[]>([]);
  const [allHubs, setAllHubs] = useState<string[]>([]);
  const [kpi, setKpi] = useState<KpiSummary>(defaultKpi);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleReadyForDashboard = useCallback(() => {
    setDashboardReady(true);
  }, []);

  const handleSailComplete = useCallback(() => {
    setShowSail(false);
    setDashboardReady(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("jtt08_sail_played", "1");
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("sail");
    const query = params.toString();
    router.replace(`/dashboard${query ? `?${query}` : ""}`, { scroll: false });
  }, [searchParams, router]);

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
      setKpi(json.kpi || defaultKpi);
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

      {/* JANGAN render atau tampilkan elemen dashboard sebelum animasi mengemudi selesai */}
      {dashboardReady && (
        <div className="min-h-screen bg-[#e7eef4] dark:bg-transparent">
          <div className="w-full px-2 sm:px-4 py-4 space-y-4 animate-page-enter">
            {/* Page Header — Harbor Lighthouse Command */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#0a1d33] via-[#0e3454] to-[#0f4c5c] dark:from-slate-900 dark:via-[#0d2847] dark:to-[#0f3548] border border-cyan-900/35 dark:border-slate-700/70 text-white rounded-2xl px-5 py-4 shadow-lg">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/70 via-amber-300/70 to-cyan-400/70" />
              <MaritimeWaveBackdrop />

              <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <LighthouseBeaconIcon />
                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-white">
                      Closing Report LM JTT08
                    </h1>
                    <p className="text-xs text-cyan-100/90 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live Monitoring
                      </span>
                      <span className="text-cyan-300/50">•</span>
                      <span>
                        {isToday
                          ? "Hari ini — " + formatDate(selectedDate)
                          : formatDate(selectedDate)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/15 backdrop-blur-xs text-cyan-100 text-xs font-semibold rounded-full">
                    <SailorCompassIcon className="h-3.5 w-3.5 text-amber-300" />
                    Harbor Control • JTT08
                  </span>
                  {!isToday && (
                    <span className="px-3 py-1 bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-semibold rounded-full">
                      Mode History
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <KpiCards kpi={kpi} isLoading={isLoading} />

            {/* 5 Operational Insight Cards */}
            <ClosingInsightCards data={closingData} isLoading={isLoading} />

            {/* Filter Bar */}
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

            {/* Hub Table */}
            <HubTable data={closingData} isLoading={isLoading} />
          </div>
        </div>
      )}
    </>
  );
}
