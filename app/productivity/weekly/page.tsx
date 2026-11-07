"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProductivityKpiCards } from "@/components/productivity/ProductivityKpiCards";
import { CourierTable } from "@/components/productivity/CourierTable";
import { GracePeriodToggle } from "@/components/productivity/GracePeriodToggle";
import { useAuth } from "@/hooks/useAuth";
import { ProductivityKpi, CourierScheduleRow } from "@/types/productivity";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, BarChart2, RefreshCw, AlertTriangle } from "lucide-react";
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
    <div className="w-full px-3 sm:px-6 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <BarChart2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Dashboard Weekly Productivity</h1>
              <GracePeriodToggle
                hasL15D={Boolean(kpi?.hasL15D)}
                dataDaysCount={kpi?.dataDaysCount ?? 0}
                enabled={excludeNew}
                onToggle={handleToggleExcludeNew}
                excludedCount={kpi?.excludedNewCount}
              />
            </div>
            <p className="text-sm text-gray-500">
              Hub: <span className="font-medium text-blue-600">{hubName}</span>
            </p>
          </div>
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={prevWeek} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-800 min-w-[160px] text-center">
            {formatWeekLabel(weekStart)}
          </span>
          <button onClick={nextWeek} disabled={isCurrentWeek}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30">
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
          {!isCurrentWeek && (
            <button onClick={() => setWeekStart(getMonday(new Date()))}
              className="text-xs text-blue-600 hover:underline ml-1">
              Hari ini
            </button>
          )}
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Tipe:</span>

          {/* Tombol filter — satu klik, tidak ada dropdown */}
          <div className="flex flex-wrap gap-1.5">
            {FLEET_TYPES.map((ft) => (
              <button
                key={ft.value}
                onClick={() => setFleetType(ft.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  fleetType === ft.value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
  );
}

export default function DashboardWeeklyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <DashboardWeeklyContent />
    </Suspense>
  );
}
