"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  BarChart3,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { GracePeriodToggle } from "@/components/productivity/GracePeriodToggle";
import { format } from "date-fns";

interface CoreSegmentMetrics {
  avgProductivity: number;
  target: number;
  threshold75: number;
  achievement: number;
  totalShifts: number;
  totalDelivered: number;
}

interface DailySegmentMetrics {
  cour: number;
  deliv: number;
  prod: number;
  targ: number;
  achv: number;
}

interface DailyBreakdownRow {
  dateKey: string;
  date: string;
  dayName: string;
  delivered: number;
  shifts: number;
  productivity: number;
  target: number;
  achievement: number;
  riderDedicated: DailySegmentMetrics;
  riderPlus: DailySegmentMetrics;
  driverDedicated: DailySegmentMetrics;
}

interface DailyBreakdownTotals {
  riderDedicated: DailySegmentMetrics;
  riderPlus: DailySegmentMetrics;
  driverDedicated: DailySegmentMetrics;
}

interface MonthlyData {
  totalDelivered: number;
  totalShifts: number;
  avgProductivity: number;
  target: number;
  progress: number;
  operatingDays: number;
  uniqueHeadcount: number;
  metQuota: number;
  totalCouriers: number;
  lastUpdate: string | null;
  core2wh: {
    achievement: number;
    dedicated: CoreSegmentMetrics;
    kurirPlus: CoreSegmentMetrics;
  };
  core4wh: {
    achievement: number;
    dedicated4wh: CoreSegmentMetrics;
  };
  dailyBreakdown: DailyBreakdownRow[];
  dailyBreakdownTotals: DailyBreakdownTotals;
  weeklyBreakdown: { week: string; avgProductivity: number; shifts: number }[];
  missingTargetWeeks?: string[];
  hasL15D?: boolean;
  dataDaysCount?: number;
  excludedNewCount?: number;
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${format(start, "dd MMM")} – ${format(end, "dd MMM yyyy")}`;
}

function StatusBadge({ pct }: { pct: number }) {
  if (pct >= 100) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-400 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-400/40 dark:shadow-none shadow-sm">
        ✓ ACHIEVED
      </span>
    );
  }
  if (pct >= 80) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-400 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-400/40 dark:shadow-none shadow-sm">
        ◐ PROGRESS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-400 text-white dark:bg-rose-500/20 dark:text-rose-300 dark:border dark:border-rose-400/40 dark:shadow-none shadow-sm">
      ✕ BELOW
    </span>
  );
}

function SegmentProgressBar({ pct }: { pct: number }) {
  const width = Math.min(Math.max(pct, 0), 100);
  const color =
    pct >= 100
      ? "bg-emerald-500"
      : pct >= 80
      ? "bg-amber-500"
      : "bg-rose-500";
  return (
    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden my-2.5">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

const BREAKDOWN_SEGMENTS: {
  key: keyof DailyBreakdownTotals;
  label: string;
  subLabel: string;
  headerClass: string;
  highlightProd: boolean;
}[] = [
  {
    key: "riderDedicated",
    label: "Rider Dedicated",
    subLabel: "Dedicated 2WH",
    headerClass: "text-blue-600",
    highlightProd: true,
  },
  {
    key: "riderPlus",
    label: "Rider Plus",
    subLabel: "Kurir Plus 2WH",
    headerClass: "text-gray-900",
    highlightProd: false,
  },
  {
    key: "driverDedicated",
    label: "Driver Dedicated",
    subLabel: "Dedicated 4WH",
    headerClass: "text-gray-900",
    highlightProd: false,
  },
];

function formatCompactTarget(val: number): string {
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}

function getAchvTextColor(achv: number): string {
  if (achv >= 100) return "text-emerald-600";
  if (achv >= 80) return "text-amber-600";
  return "text-orange-600";
}

function SegmentCells({
  seg,
  highlightProd,
  isTotal = false,
}: {
  seg: DailySegmentMetrics;
  highlightProd: boolean;
  isTotal?: boolean;
}) {
  const hasShifts = seg.cour > 0;
  const achvColor = getAchvTextColor(seg.achv);

  return (
    <>
      <td
        className={`py-3 px-2.5 text-center tabular-nums border-l border-gray-200 ${
          isTotal ? "font-bold text-gray-900" : "text-gray-700"
        }`}
      >
        {seg.cour}
      </td>
      <td
        className={`py-3 px-2.5 text-center tabular-nums font-semibold ${
          isTotal ? "font-bold text-gray-900" : "text-gray-900"
        }`}
      >
        {seg.deliv.toLocaleString("en-US")}
      </td>
      <td
        className={`py-3 px-2.5 text-center tabular-nums font-bold ${
          !hasShifts
            ? "text-gray-400"
            : highlightProd
            ? "text-blue-600"
            : "text-gray-900"
        }`}
      >
        {hasShifts ? seg.prod.toFixed(1) : "-"}
      </td>
      <td
        className={`py-3 px-2.5 text-center tabular-nums ${
          isTotal ? "font-bold text-gray-900" : "text-gray-600"
        }`}
      >
        {hasShifts ? formatCompactTarget(seg.targ) : "-"}
      </td>
      <td className={`py-3 px-2.5 text-center tabular-nums font-bold ${hasShifts ? achvColor : "text-gray-400"}`}>
        {hasShifts ? `${seg.achv.toFixed(1)}%` : "-"}
      </td>
    </>
  );
}

export default function DashboardMonthlyPage() {
  const { hubName, user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [data, setData] = useState<MonthlyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [excludeNew, setExcludeNew] = useState(false);
  const requestSeqRef = useRef(0);

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

  const fetchData = useCallback(async () => {
    if (!selectedMonth) return;
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split("-");
      const res = await fetch(
        `/api/productivity/monthly?year=${year}&month=${month}&exclude_new=${excludeNew}`
      );
      const json = await res.json();
      if (seq !== requestSeqRef.current) return;
      if (json.success) setData(json.data);
      else toast.error(json.error || "Gagal memuat data");
    } catch {
      if (seq === requestSeqRef.current) {
        toast.error("Gagal memuat data bulanan.");
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedMonth, excludeNew]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const monthLabel = selectedMonth
    ? new Date(selectedMonth + "-01T00:00:00").toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Top Blue Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-slate-900 dark:via-[#0f2447] dark:to-[#132c57] dark:border-b dark:border-slate-700/80 text-white shadow-md">
        <div className="w-full px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                Monthly Productivity Dashboard
              </h1>
              <GracePeriodToggle
                hasL15D={Boolean(data?.hasL15D)}
                dataDaysCount={data?.dataDaysCount ?? 0}
                enabled={excludeNew}
                onToggle={handleToggleExcludeNew}
                excludedCount={data?.excludedNewCount}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-blue-100 dark:text-slate-300">
              <span>Monthly Aggregated Performance Metrics</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Synced
              </span>
              <span>•</span>
              <span className="px-2.5 py-1 rounded-md bg-blue-500/40 border border-blue-400/30 dark:bg-slate-800/80 dark:border-slate-600/60 dark:text-slate-100 text-white font-medium">
                Last Update: {data?.lastUpdate || "-"}
              </span>
              {hubName && (
                <>
                  <span>•</span>
                  <span className="px-2.5 py-1 rounded-md bg-blue-500/40 border border-blue-400/30 dark:bg-slate-800/80 dark:border-slate-600/60 dark:text-blue-300 text-white font-medium">
                    Hub: {hubName}
                  </span>
                </>
              )}
            </div>
          </div>

          {user?.name && (
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-blue-500/30 border border-blue-400/30 dark:bg-slate-800/80 dark:border-slate-600/60 text-sm font-medium">
              <div className="w-6 h-6 rounded-full bg-white/20 dark:bg-blue-500/25 dark:text-blue-200 flex items-center justify-center text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span>{user.name.split(" ")[0]}</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full px-3 sm:px-6 pt-6 space-y-6">
        {/* Banner Notifikasi jika ada minggu yang Target Hari Senin-nya tidak ditemukan */}
        {data?.missingTargetWeeks && data.missingTargetWeeks.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 space-y-1">
              <p className="font-semibold">
                Target hari Senin belum diinput / tidak ditemukan pada minggu berikut:
              </p>
              <div className="flex flex-col gap-1">
                {data.missingTargetWeeks.map((wk) => (
                  <Link
                    key={wk}
                    href={`/productivity/targets?week=${wk}`}
                    className="font-bold text-amber-800 underline hover:text-amber-950 transition-colors"
                  >
                    • Klik disini untuk menentukan target pada week tanggal{" "}
                    {formatWeekLabel(wk)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar Bulan (tetap di paling atas halaman) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="w-full sm:w-72">
              <label
                htmlFor="monthly-month-filter"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5"
              >
                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                Month
              </label>
              <input
                id="monthly-month-filter"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500 sm:pb-2">
              <div>
                Showing data for:{" "}
                <span className="font-semibold text-blue-600">{monthLabel}</span>
              </div>
              {isLoading && (
                <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Memuat...
                </span>
              )}
            </div>
          </div>
        </div>

        {!data && isLoading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Memuat data Monthly Productivity...
          </div>
        )}

        {data && (
          <>
            {/* Two Big Core KPI Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Card: PRODUCTIVITY 2WH */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-[#0f2447] dark:via-[#122b54] dark:to-[#173668] dark:border dark:border-blue-500/35 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-extrabold tracking-wide uppercase">
                          PRODUCTIVITY 2WH
                        </h2>
                        <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-amber-400 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-400/35">
                          CORE KPI
                        </span>
                      </div>
                      <p className="text-xs text-blue-100 dark:text-blue-200/80 mt-0.5">
                        Avg: Dedicated 2WH + Kurir Plus 2WH
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-extrabold leading-none">
                        {data.core2wh.achievement.toFixed(1)}%
                      </div>
                      <div className="mt-1.5">
                        <StatusBadge pct={data.core2wh.achievement} />
                      </div>
                    </div>
                  </div>

                  {/* Dedicated & Kurir Plus Sub-cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-5">
                    {/* Dedicated 2WH */}
                    <div className="bg-white dark:border dark:border-blue-400/20 dark:shadow-none rounded-xl p-4 text-gray-800 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700">
                          Dedicated
                        </span>
                        <span className="text-base font-extrabold text-gray-900">
                          {data.core2wh.dedicated.achievement.toFixed(1)}%
                        </span>
                      </div>
                      <SegmentProgressBar pct={data.core2wh.dedicated.achievement} />
                      <div className="space-y-1 text-xs mt-2">
                        <div className="flex justify-between text-gray-500">
                          <span>Avg:</span>
                          <span className="font-bold text-gray-800">
                            {data.core2wh.dedicated.avgProductivity}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Target:</span>
                          <span className="font-bold text-gray-800">
                            {data.core2wh.dedicated.target.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Thr 75%:</span>
                          <span className="font-bold text-amber-600">
                            {data.core2wh.dedicated.threshold75.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Kurir Plus 2WH */}
                    <div className="bg-white dark:border dark:border-blue-400/20 dark:shadow-none rounded-xl p-4 text-gray-800 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700">
                          Kurir Plus
                        </span>
                        <span className="text-base font-extrabold text-gray-900">
                          {data.core2wh.kurirPlus.achievement.toFixed(1)}%
                        </span>
                      </div>
                      <SegmentProgressBar pct={data.core2wh.kurirPlus.achievement} />
                      <div className="space-y-1 text-xs mt-2">
                        <div className="flex justify-between text-gray-500">
                          <span>Avg:</span>
                          <span className="font-bold text-gray-800">
                            {data.core2wh.kurirPlus.avgProductivity}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Target:</span>
                          <span className="font-bold text-gray-800">
                            {data.core2wh.kurirPlus.target.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Thr 75%:</span>
                          <span className="font-bold text-amber-600">
                            {data.core2wh.kurirPlus.threshold75.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* View Calculation Formula Accordion */}
                <div className="mt-3.5">
                  <button
                    type="button"
                    onClick={() => setShowFormula(!showFormula)}
                    className="w-full bg-white text-gray-700 hover:bg-gray-50 dark:border dark:border-blue-400/20 rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-sm transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                      View Calculation Formula
                    </span>
                    {showFormula ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  {showFormula && (
                    <div className="mt-2 bg-blue-900/60 dark:bg-slate-950/65 border border-blue-400/30 dark:border-blue-500/30 rounded-xl p-3.5 text-xs text-blue-50 space-y-1">
                      <p>
                        • <strong>Threshold 75%</strong> = Target × 75%
                      </p>
                      <p>
                        • <strong>Segment Achievement</strong> = ((Avg − Thr 75%) ÷
                        (Target − Thr 75%)) × 100% (maks 100%, min 0%)
                      </p>
                      <p>
                        • <strong>Productivity 2WH</strong> = Rata-rata dari
                        Achievement Dedicated 2WH dan Kurir Plus 2WH
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Card: PRODUCTIVITY 4WH */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-[#162033] dark:to-[#0f172a] dark:border dark:border-slate-700/80 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-extrabold tracking-wide uppercase">
                          PRODUCTIVITY 4WH
                        </h2>
                        <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-amber-400 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-400/35">
                          CORE KPI
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Dedicated 4WH Only
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-extrabold leading-none">
                        {data.core4wh.achievement.toFixed(1)}%
                      </div>
                      <div className="mt-1.5">
                        <StatusBadge pct={data.core4wh.achievement} />
                      </div>
                    </div>
                  </div>

                  {/* Dedicated 4WH White Inner Card */}
                  <div className="bg-white dark:border dark:border-slate-700/70 dark:shadow-none rounded-xl p-5 text-gray-800 shadow-sm mt-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-700">
                        Dedicated 4WH
                      </span>
                      <span className="text-lg font-extrabold text-gray-900">
                        {data.core4wh.dedicated4wh.achievement.toFixed(1)}%
                      </span>
                    </div>

                    <SegmentProgressBar
                      pct={data.core4wh.dedicated4wh.achievement}
                    />

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                        <p className="text-[11px] text-gray-500">
                          Avg Productivity
                        </p>
                        <p className="text-lg font-extrabold text-gray-900 mt-0.5">
                          {data.core4wh.dedicated4wh.avgProductivity.toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                        <p className="text-[11px] text-gray-500">Target</p>
                        <p className="text-lg font-extrabold text-gray-900 mt-0.5">
                          {data.core4wh.dedicated4wh.target.toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                        <p className="text-[11px] text-gray-500">
                          Threshold 75%
                        </p>
                        <p className="text-lg font-extrabold text-amber-600 mt-0.5">
                          {data.core4wh.dedicated4wh.threshold75.toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                        <p className="text-[11px] text-gray-500">Total Shifts</p>
                        <p className="text-lg font-extrabold text-gray-900 mt-0.5">
                          {data.core4wh.dedicated4wh.totalShifts}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5 Summary Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">
                  Total Delivered
                </p>
                <p className="mt-1.5 text-2xl font-extrabold text-gray-900">
                  {data.totalDelivered.toLocaleString("en-US")}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Parcels delivered this month
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">
                  Active Shifts
                </p>
                <p className="mt-1.5 text-2xl font-extrabold text-gray-900">
                  {data.totalShifts.toLocaleString("en-US")}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Total active courier shifts
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">
                  Avg Daily Productivity
                </p>
                <p className="mt-1.5 text-2xl font-extrabold text-gray-900">
                  {data.avgProductivity.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Delivered per shift
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">
                  Monthly Target
                </p>
                <p className="mt-1.5 text-2xl font-extrabold text-gray-900">
                  {data.target.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Target per shift (avg)
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm col-span-2 sm:col-span-1">
                <p className="text-xs font-medium text-gray-500">
                  Operating Days
                </p>
                <p className="mt-1.5 text-2xl font-extrabold text-gray-900">
                  {data.operatingDays}
                </p>
                <p className="text-xs text-gray-400 mt-1">Days with activity</p>
              </div>
            </div>

            {/* Monthly Calculation Method Info Banner */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs text-blue-900 leading-relaxed">
                <p className="font-bold text-blue-800 mb-0.5">
                  Monthly Calculation Method
                </p>
                <p className="text-blue-700">
                  Monthly Achievement = Total Delivered ÷ Total Active Shifts
                  (daily active manpower). Cross-month weeks are split by month
                  boundaries with daily targets from appeal or Monday baseline.
                  Threshold-based achievement calculation applies (75%
                  threshold).
                </p>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-gray-900">
                      Daily Breakdown
                    </h3>
                    {isLoading && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Memuat...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Perbandingan harian Rider Dedicated (2WH), Rider Plus (Kurir Plus 2WH), dan Driver Dedicated (4WH)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-10 bg-gray-50 py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                      >
                        TANGGAL
                      </th>
                      {BREAKDOWN_SEGMENTS.map((seg) => (
                        <th
                          key={seg.key}
                          colSpan={5}
                          title={seg.subLabel}
                          className={`pt-2.5 pb-1 px-2 text-center text-xs font-bold border-l border-gray-200 whitespace-nowrap ${seg.headerClass}`}
                        >
                          {seg.label}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
                      {BREAKDOWN_SEGMENTS.map((seg) => (
                        <th key={`${seg.key}-cour`} className="pb-2 pt-0.5 px-2.5 text-center border-l border-gray-200">
                          Cour
                        </th>
                      )).flatMap((courTh, idx) => {
                        const key = BREAKDOWN_SEGMENTS[idx].key;
                        return [
                          courTh,
                          <th key={`${key}-deliv`} className="pb-2 pt-0.5 px-2.5 text-center">Deliv</th>,
                          <th key={`${key}-prod`}  className="pb-2 pt-0.5 px-2.5 text-center">Prod</th>,
                          <th key={`${key}-targ`}  className="pb-2 pt-0.5 px-2.5 text-center">Targ</th>,
                          <th key={`${key}-achv`}  className="pb-2 pt-0.5 px-2.5 text-center">Achv%</th>,
                        ];
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.dailyBreakdown.length === 0 ? (
                      <tr>
                        <td
                          colSpan={16}
                          className="py-8 text-center text-gray-400 text-sm"
                        >
                          Tidak ada data aktivitas kurir pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      data.dailyBreakdown.map((row) => {
                        const dateObj = new Date(`${row.dateKey}T00:00:00`);
                        const shortDate = isNaN(dateObj.getTime())
                          ? row.date
                          : format(dateObj, "dd MMM");
                        return (
                          <tr
                            key={row.dateKey}
                            className="hover:bg-gray-50/60 transition-colors"
                          >
                            <td
                              className="sticky left-0 z-10 bg-white py-3 px-4 font-bold text-gray-900 whitespace-nowrap"
                              title={`${row.dayName}, ${row.date}`}
                            >
                              {shortDate}
                            </td>
                            {BREAKDOWN_SEGMENTS.map((seg) => (
                              <SegmentCells
                                key={seg.key}
                                seg={row[seg.key]}
                                highlightProd={seg.highlightProd}
                              />
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {data.dailyBreakdown.length > 0 && data.dailyBreakdownTotals && (
                    <tfoot>
                      <tr className="bg-amber-50/60 border-t-2 border-gray-200 font-bold text-gray-900">
                        <td className="sticky left-0 z-10 bg-[#fef6e9] dark:bg-[#2a2015] py-3.5 px-4 uppercase tracking-wide whitespace-nowrap">
                          TOTAL
                        </td>
                        {BREAKDOWN_SEGMENTS.map((seg) => (
                          <SegmentCells
                            key={seg.key}
                            seg={data.dailyBreakdownTotals[seg.key]}
                            highlightProd={seg.highlightProd}
                            isTotal
                          />
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
