"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProductivityKpiCards } from "@/components/productivity/ProductivityKpiCards";
import { CourierTable } from "@/components/productivity/CourierTable";
import { GracePeriodToggle } from "@/components/productivity/GracePeriodToggle";
import {
  MaritimeWaveBackdrop,
  SailorHelmVesselIcon,
} from "@/components/productivity/MaritimeAnimations";
import { useAuth } from "@/hooks/useAuth";
import { ProductivityKpi, CourierScheduleRow } from "@/types/productivity";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import toast from "react-hot-toast";

// ── Mapping filter sederhana → contract + vehicle ────────────
const FLEET_TYPES = [
  { label: "Semua",           value: "all",              contract: "all",        vehicle: "all"  },
  { label: "Rider Dedicated", value: "dedicated_2wh",    contract: "Dedicated",  vehicle: "2WH"  },
  { label: "Driver Dedicated",value: "dedicated_4wh",    contract: "Dedicated",  vehicle: "4WH"  },
  { label: "Rider Plus",      value: "kurir_plus_2wh",   contract: "Kurir Plus", vehicle: "2WH"  },
  { label: "Rider Mitra",     value: "mitra_2wh",        contract: "Mitra",      vehicle: "2WH"  },
  { label: "Driver Mitra",    value: "mitra_4wh",        contract: "Mitra",      vehicle: "4WH"  },
] as const;

type FleetTypeValue = typeof FLEET_TYPES[number]["value"];

function getContractVehicle(val: FleetTypeValue) {
  const found = FLEET_TYPES.find((f) => f.value === val);
  return { contract: found?.contract ?? "all", vehicle: found?.vehicle ?? "all" };
}

function getMonday(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end   = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${format(start, "dd MMM")} – ${format(end, "dd MMM yyyy")}`;
}

function DashboardWeeklyContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { hubName }  = useAuth();

  const [weekStart, setWeekStart]   = useState(searchParams.get("week") || getMonday(new Date()));
  const [fleetType, setFleetType]   = useState<FleetTypeValue>(
    (searchParams.get("fleet") as FleetTypeValue) || "all"
  );
  const [excludeNew, setExcludeNew] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("spx_grace_period_14d");
    if (saved !== null) {
      setExcludeNew(saved === "true");
    }
  }, []);

  const handleToggleExcludeNew = (val: boolean) => {
    setExcludeNew(val);
    localStorage.setItem("spx_grace_period_14d", String(val));
  };

  const [kpi, setKpi]               = useState<ProductivityKpi | null>(null);
  const [schedule, setSchedule]     = useState<CourierScheduleRow[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [schLoading, setSchLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setKpiLoading(true);
    setSchLoading(true);
    const { contract, vehicle } = getContractVehicle(fleetType);
    try {
      const [kpiRes, schRes] = await Promise.all([
        fetch(`/api/productivity/kpi?week_start=${weekStart}&contract=${encodeURIComponent(contract)}&vehicle=${vehicle}&exclude_new=${excludeNew}`),
        fetch(`/api/productivity/schedule?week_start=${weekStart}&contract=${encodeURIComponent(contract)}&vehicle=${vehicle}&exclude_new=${excludeNew}`),
      ]);
      const kpiJson = await kpiRes.json();
      const schJson = await schRes.json();
      if (kpiJson.success) setKpi(kpiJson.kpi);
      if (schJson.success) setSchedule(schJson.schedule);
    } catch {
      toast.error("Gagal memuat data produktivitas.");
    } finally {
      setKpiLoading(false);
      setSchLoading(false);
    }
  }, [weekStart, fleetType, excludeNew]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("week", weekStart);
    if (fleetType !== "all") params.set("fleet", fleetType);
    router.replace(`/productivity/weekly?${params.toString()}`, { scroll: false });
  }, [weekStart, fleetType, router]);

  const prevWeek = () => setWeekStart(getMonday(subWeeks(new Date(weekStart + "T00:00:00"), 1)));
  const nextWeek = () => {
    const next = getMonday(addWeeks(new Date(weekStart + "T00:00:00"), 1));
    if (next <= getMonday(new Date())) setWeekStart(next);
  };
  const isCurrentWeek = weekStart === getMonday(new Date());

  return (
    <div className="min-h-screen bg-[#e8eef5] dark:bg-transparent">
      <div className="w-full px-3 sm:px-6 py-4 space-y-4">
        {/* Maritime Navy Command Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b1f3a] via-[#102d56] to-[#15457a] dark:from-slate-900 dark:via-[#0f2447] dark:to-[#132c57] border border-sky-900/30 dark:border-slate-700/80 text-white px-5 py-4 shadow-lg">
          {/* Top thin maritime gold highlight */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-400/70 via-sky-300/60 to-amber-400/70" />
          <MaritimeWaveBackdrop />

          <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3.5">
              <SailorHelmVesselIcon />
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-extrabold tracking-tight text-white">
                    Dashboard Weekly Productivity
                  </h1>
                  <GracePeriodToggle
                    hasL15D={Boolean(kpi?.hasL15D)}
                    dataDaysCount={kpi?.dataDaysCount ?? 0}
                    enabled={excludeNew}
                    onToggle={handleToggleExcludeNew}
                    excludedCount={kpi?.excludedNewCount}
                  />
                </div>
                <p className="text-xs sm:text-sm text-sky-100/85 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>Hub:</span>
                  <span className="font-bold text-amber-300">{hubName}</span>
                  <span className="text-sky-300/60">•</span>
                  <span className="text-sky-200/80">Weekly Fleet Command &amp; Courier Tracking</span>
                </p>
              </div>
            </div>

            {/* Week navigator */}
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl px-2.5 py-1.5 shadow-sm">
              <button
                onClick={prevWeek}
                className="p-1.5 hover:bg-white/15 rounded-lg transition-colors text-white cursor-pointer"
                aria-label="Minggu sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-white min-w-[165px] text-center">
                {formatWeekLabel(weekStart)}
              </span>
              <button
                onClick={nextWeek}
                disabled={isCurrentWeek}
                className="p-1.5 hover:bg-white/15 rounded-lg transition-colors text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Minggu berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isCurrentWeek && (
                <button
                  onClick={() => setWeekStart(getMonday(new Date()))}
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 hover:underline ml-1 pr-1 cursor-pointer"
                >
                  Minggu ini
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Banner Notifikasi jika Target Hari Senin tidak ditemukan */}
        {!kpiLoading && kpi?.missingWeekTarget && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <span className="font-semibold">
                Target hari Senin pada week ini belum diinput / tidak ditemukan.{" "}
              </span>
              <Link
                href={`/productivity/targets?week=${weekStart}`}
                className="font-bold text-amber-800 underline hover:text-amber-950 transition-colors"
              >
                Klik disini untuk menentukan target pada week tanggal {formatWeekLabel(weekStart)}
              </Link>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <ProductivityKpiCards
          kpi={kpi}
          isLoading={kpiLoading}
          filterLabel={FLEET_TYPES.find((f) => f.value === fleetType)?.label}
        />

        {/* Filter + Table */}
        <div className="bg-white rounded-2xl border border-slate-300/70 dark:border-slate-700/80 border-t-[3px] border-t-[#134074] dark:border-t-blue-500 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-900/75 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <Anchor className="h-3.5 w-3.5 text-[#134074] dark:text-sky-400" />
              Armada:
            </span>

            {/* Tombol filter — satu klik, tidak ada dropdown */}
            <div className="flex flex-wrap gap-1.5">
              {FLEET_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  onClick={() => setFleetType(ft.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    fleetType === ft.value
                      ? "bg-[#0f294a] dark:bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {ft.label}
                </button>
              ))}
            </div>

            <Button variant="ghost" size="sm" onClick={fetchData}
              loading={kpiLoading || schLoading} className="ml-auto">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
          <div className="p-4">
            <CourierTable
              data={schedule}
              isLoading={schLoading}
              weekStart={weekStart}
              weekLabel={formatWeekLabel(weekStart)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardWeeklyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <DashboardWeeklyContent />
    </Suspense>
  );
}
