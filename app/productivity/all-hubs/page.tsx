"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useUserProfileDisplay } from "@/hooks/useAuth";
import { GracePeriodToggle } from "@/components/productivity/GracePeriodToggle";
import {
  HubProductivityDetailModal,
  type DetailFocusTab,
  type HubDetailItem,
} from "@/components/productivity/HubProductivityDetailModal";
import {
  NauticalChartBackdrop,
  SailorCompassIcon,
  SailorHelmVesselIcon,
} from "@/components/productivity/MaritimeAnimations";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import {
  Anchor,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";

type HubProductivityRow = HubDetailItem;

type SortKey =
  | "namaHub"
  | "lastDataDate"
  | "weekly2wh"
  | "weekly4wh"
  | "monthly2wh"
  | "monthly4wh";

type SortDir = "asc" | "desc";

function getMonday(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${format(start, "dd MMM")} – ${format(end, "dd MMM yyyy")}`;
}

function formatLastDataDate(ymd: string | null): string {
  if (!ymd) return "-";
  const d = new Date(ymd + "T00:00:00");
  if (isNaN(d.getTime())) return ymd;
  return format(d, "dd MMM yyyy");
}

function getKpiBadgeStyle(pct: number): {
  text: string;
  bar: string;
  pill: string;
} {
  if (pct >= 100) {
    return {
      text: "text-emerald-700 dark:text-emerald-300",
      bar: "bg-emerald-500",
      pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/35",
    };
  }
  if (pct >= 80) {
    return {
      text: "text-amber-700 dark:text-amber-300",
      bar: "bg-amber-500",
      pill: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/35",
    };
  }
  return {
    text: "text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
    pill: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-400/35",
  };
}

function KpiCellContent({
  kpiPct,
  shifts,
  subText,
}: {
  kpiPct: number;
  shifts: number;
  subText: string;
}) {
  if (shifts <= 0) {
    return <span className="text-slate-400 dark:text-slate-500 font-medium">-</span>;
  }

  const style = getKpiBadgeStyle(kpiPct);
  const barWidth = Math.max(0, Math.min(kpiPct, 100));

  return (
    <div className="inline-flex flex-col items-center min-w-[98px]">
      <span
        className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg border text-xs sm:text-sm font-extrabold tabular-nums ${style.pill}`}
      >
        {kpiPct.toFixed(1)}%
      </span>
      <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-1.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">
        {subText}
      </span>
    </div>
  );
}

function SortIcon({
  col,
  activeKey,
  dir,
}: {
  col: SortKey;
  activeKey: SortKey;
  dir: SortDir;
}) {
  if (col !== activeKey) {
    return <ArrowUpDown className="h-3 w-3 opacity-45 flex-shrink-0" />;
  }
  return dir === "asc" ? (
    <ArrowUp className="h-3 w-3 text-amber-600 dark:text-amber-300 flex-shrink-0" />
  ) : (
    <ArrowDown className="h-3 w-3 text-amber-600 dark:text-amber-300 flex-shrink-0" />
  );
}

export default function AllHubsProductivityPage() {
  const { hubName, isLoading: authLoading, isSuperAdmin } = useUserProfileDisplay();
  const now = new Date();

  const [weekStart, setWeekStart] = useState(getMonday(now));
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [excludeNew, setExcludeNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("namaHub");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [hubs, setHubs] = useState<HubProductivityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<{
    hub: HubDetailItem;
    tab: DetailFocusTab;
  } | null>(null);
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

  const fetchAllHubs = useCallback(async () => {
    if (!selectedMonth) return;
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split("-");
      const res = await fetch(
        `/api/productivity/all-hubs?week_start=${weekStart}&year=${year}&month=${month}&exclude_new=${excludeNew}`
      );
      const json = await res.json();
      if (seq !== requestSeqRef.current) return;
      if (json.success) {
        setHubs(json.hubs || []);
      } else {
        toast.error(json.error || "Gagal memuat data produktivitas semua hub");
      }
    } catch {
      if (seq === requestSeqRef.current) {
        toast.error("Gagal memuat Dashboard Productivity All Hub.");
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [weekStart, selectedMonth, excludeNew]);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) {
      fetchAllHubs();
    }
  }, [authLoading, isSuperAdmin, fetchAllHubs]);

  const prevWeek = () => setWeekStart(getMonday(subWeeks(new Date(weekStart + "T00:00:00"), 1)));
  const nextWeek = () => {
    const next = getMonday(addWeeks(new Date(weekStart + "T00:00:00"), 1));
    if (next <= getMonday(new Date())) setWeekStart(next);
  };
  const isCurrentWeek = weekStart === getMonday(new Date());

  const monthLabel = selectedMonth
    ? new Date(selectedMonth + "-01T00:00:00").toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "";

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "namaHub" ? "asc" : "desc");
    }
  };

  const filteredAndSortedHubs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? hubs.filter((h) => h.namaHub.toLowerCase().includes(q))
      : [...hubs];

    const getVal = (row: HubProductivityRow): string | number => {
      switch (sortKey) {
        case "namaHub":
          return row.namaHub.toLowerCase();
        case "lastDataDate":
          return row.lastDataDate || "";
        case "weekly2wh":
          return row.weekly.shifts2wh > 0 ? row.weekly.kpi2wh : -1;
        case "weekly4wh":
          return row.weekly.shifts4wh > 0 ? row.weekly.kpi4wh : -1;
        case "monthly2wh":
          return row.monthly.shifts2wh > 0 ? row.monthly.kpi2wh : -1;
        case "monthly4wh":
          return row.monthly.shifts4wh > 0 ? row.monthly.kpi4wh : -1;
      }
    };

    list.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return a.namaHub.localeCompare(b.namaHub, "id");
    });
    return list;
  }, [hubs, searchQuery, sortKey, sortDir]);

  const summary = useMemo(() => {
    const totalHubs = hubs.length;
    const hubsWithData = hubs.filter((h) => Boolean(h.lastDataDate)).length;
    const latestDateAcrossHubs = hubs.reduce<string | null>((best, h) => {
      if (!h.lastDataDate) return best;
      if (!best || h.lastDataDate > best) return h.lastDataDate;
      return best;
    }, null);

    const avgOf = (vals: number[]) =>
      vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
        : null;

    return {
      totalHubs,
      hubsWithData,
      latestDateAcrossHubs,
      hasAnyL15D: hubs.some((h) => h.hasL15D),
      avgWeekly2wh: avgOf(hubs.filter((h) => h.weekly.shifts2wh > 0).map((h) => h.weekly.kpi2wh)),
      avgWeekly4wh: avgOf(hubs.filter((h) => h.weekly.shifts4wh > 0).map((h) => h.weekly.kpi4wh)),
      avgMonthly2wh: avgOf(hubs.filter((h) => h.monthly.shifts2wh > 0).map((h) => h.monthly.kpi2wh)),
      avgMonthly4wh: avgOf(hubs.filter((h) => h.monthly.shifts4wh > 0).map((h) => h.monthly.kpi4wh)),
    };
  }, [hubs]);

  if (!authLoading && !isSuperAdmin) {
    return (
      <div className="w-full px-3 sm:px-6 py-12 flex justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 dark:border-rose-500/35 p-6 text-center space-y-3 shadow-sm">
          <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Akses Dibatasi</h1>
          <p className="text-sm text-gray-500">
            Halaman Dashboard Productivity All Hub hanya tersedia untuk akun Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e8eef5] dark:bg-transparent pb-12">
      {/* Top Nautical Command Banner */}
      <div className="w-full px-3 sm:px-6 pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#fffdf9] via-[#f5f9fd] to-[#e9f4f0] dark:from-[#121d2f] dark:via-[#12243d] dark:to-[#0f2c2a] border border-slate-200/90 dark:border-slate-700/80 border-l-4 border-l-amber-500 dark:border-l-amber-400 text-slate-900 dark:text-white px-5 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.14)] dark:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.45)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500/80 via-sky-500/70 to-emerald-500/75" />
          <NauticalChartBackdrop variant="monthly" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <SailorHelmVesselIcon />
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Dashboard Productivity All Hub
                  </h1>
                  <GracePeriodToggle
                    hasL15D={summary.hasAnyL15D}
                    dataDaysCount={summary.hasAnyL15D ? 15 : 0}
                    enabled={excludeNew}
                    onToggle={handleToggleExcludeNew}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-2 font-medium">
                  <span>Rekap Capaian Weekly &amp; Monthly Seluruh Hub (2WH KPI &amp; 4WH KPI)</span>
                  {hubName && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 dark:bg-slate-800/80 dark:border-slate-600/60 text-amber-700 dark:text-amber-300 font-bold">
                        Hub Anda: {hubName}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchAllHubs}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/80 text-slate-700 dark:text-slate-100 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-6 pt-5 space-y-5">
        {/* Filter Bar: Week Navigator, Month Picker & Hub Search */}
        <div className="bg-white rounded-2xl border border-slate-300/75 dark:border-slate-700/80 border-t-[3px] border-t-[#134074] dark:border-t-blue-500 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Week Picker */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
                <SailorCompassIcon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                Periode Weekly
              </label>
              <div className="flex items-center justify-between gap-1 bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700 rounded-xl px-2 py-1.5">
                <button
                  type="button"
                  onClick={prevWeek}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
                  aria-label="Minggu sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 text-center">
                  {formatWeekLabel(weekStart)}
                </span>
                <button
                  type="button"
                  onClick={nextWeek}
                  disabled={isCurrentWeek}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Minggu berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Month Picker */}
            <div>
              <label
                htmlFor="all-hubs-month-filter"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5"
              >
                <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Periode Monthly
              </label>
              <input
                id="all-hubs-month-filter"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
              />
            </div>

            {/* Search Hub */}
            <div>
              <label
                htmlFor="all-hubs-search"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5"
              >
                <Search className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Cari Nama Hub
              </label>
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="all-hubs-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama hub..."
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="hover-lift bg-gradient-to-br from-[#fffdf7] to-[#fdf3dc] dark:from-[#1e293b] dark:to-[#282116] rounded-2xl border border-amber-200/85 dark:border-slate-700/80 border-t-[3px] border-t-amber-500 dark:border-t-amber-400 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Total Hub Terdaftar
              </p>
              <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-gray-900 tabular-nums">
              {summary.totalHubs}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.hubsWithData} hub memiliki data upload
            </p>
          </div>

          <div className="hover-lift bg-gradient-to-br from-[#f8fafc] to-[#eaeff6] dark:from-[#1e293b] dark:to-[#161f2e] rounded-2xl border border-slate-300/85 dark:border-slate-700/80 border-t-[3px] border-t-slate-600 dark:border-t-slate-400 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Update Data Terakhir
            </p>
            <p className="mt-1.5 text-xl sm:text-2xl font-extrabold text-gray-900 tabular-nums">
              {formatLastDataDate(summary.latestDateAcrossHubs)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Tanggal data terbaru All Hub</p>
          </div>

          <div className="hover-lift bg-gradient-to-br from-[#f6faff] to-[#e9f2fe] dark:from-[#1e293b] dark:to-[#142238] rounded-2xl border border-blue-200/85 dark:border-slate-700/80 border-t-[3px] border-t-blue-600 dark:border-t-blue-500 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Avg Weekly KPI
            </p>
            <div className="mt-1.5 flex items-baseline gap-3 flex-wrap">
              <span className="text-lg font-extrabold text-gray-900 tabular-nums">
                2WH: {summary.avgWeekly2wh !== null ? `${summary.avgWeekly2wh.toFixed(1)}%` : "-"}
              </span>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                4WH: {summary.avgWeekly4wh !== null ? `${summary.avgWeekly4wh.toFixed(1)}%` : "-"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{formatWeekLabel(weekStart)}</p>
          </div>

          <div className="hover-lift bg-gradient-to-br from-[#f4fbf7] to-[#e3f5ec] dark:from-[#1e293b] dark:to-[#122a23] rounded-2xl border border-emerald-200/85 dark:border-slate-700/80 border-t-[3px] border-t-emerald-600 dark:border-t-emerald-500 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Avg Monthly KPI
            </p>
            <div className="mt-1.5 flex items-baseline gap-3 flex-wrap">
              <span className="text-lg font-extrabold text-gray-900 tabular-nums">
                2WH: {summary.avgMonthly2wh !== null ? `${summary.avgMonthly2wh.toFixed(1)}%` : "-"}
              </span>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                4WH: {summary.avgMonthly4wh !== null ? `${summary.avgMonthly4wh.toFixed(1)}%` : "-"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{monthLabel}</p>
          </div>
        </div>

        {/* Tabel Daftar Seluruh Hub */}
        <div className="bg-white rounded-2xl border border-slate-300/75 dark:border-slate-700/80 border-t-[3px] border-t-[#134074] dark:border-t-blue-500 shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Anchor className="h-4 w-4 text-[#134074] dark:text-sky-400 animate-ship-bob" />
                <h2 className="text-base sm:text-lg font-extrabold text-gray-900">
                  Daftar Capaian Productivity Seluruh Hub
                </h2>
                {isLoading && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Memuat...
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Menampilkan {filteredAndSortedHubs.length} dari {hubs.length} hub · Klik nama hub atau angka KPI untuk melihat detail capaian · Metode threshold 75%
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                {/* Baris Group Header */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th
                    rowSpan={2}
                    className="py-3 px-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider w-12"
                  >
                    No
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-10 bg-gray-50 py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap border-l border-gray-200"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("namaHub")}
                      className="inline-flex items-center gap-1.5 hover:text-blue-600 cursor-pointer"
                    >
                      <span>Nama Hub</span>
                      <SortIcon col="namaHub" activeKey={sortKey} dir={sortDir} />
                    </button>
                  </th>
                  <th
                    rowSpan={2}
                    className="py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap border-l border-gray-200"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("lastDataDate")}
                      className="inline-flex items-center gap-1.5 hover:text-blue-600 cursor-pointer"
                    >
                      <span>Tanggal Update Terakhir</span>
                      <SortIcon col="lastDataDate" activeKey={sortKey} dir={sortDir} />
                    </button>
                  </th>
                  <th
                    colSpan={2}
                    className="pt-2.5 pb-1.5 px-3 text-center text-xs font-extrabold uppercase tracking-wider border-l border-gray-200 bg-blue-50/70 text-blue-700 whitespace-nowrap"
                  >
                    <div>Weekly Productivity</div>
                    <div className="text-[10px] font-semibold normal-case opacity-80">
                      {formatWeekLabel(weekStart)}
                    </div>
                  </th>
                  <th
                    colSpan={2}
                    className="pt-2.5 pb-1.5 px-3 text-center text-xs font-extrabold uppercase tracking-wider border-l border-gray-200 bg-emerald-50/80 text-emerald-700 whitespace-nowrap"
                  >
                    <div>Monthly Productivity</div>
                    <div className="text-[10px] font-semibold normal-case opacity-80">
                      {monthLabel}
                    </div>
                  </th>
                </tr>

                {/* Baris Sub Header 2WH & 4WH KPI */}
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase">
                  <th className="py-2 px-3 text-center border-l border-gray-200 bg-[#f2f7ff] dark:bg-[#11233e] whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort("weekly2wh")}
                      className="inline-flex items-center gap-1 hover:text-blue-600 cursor-pointer"
                    >
                      <span>2WH KPI</span>
                      <SortIcon col="weekly2wh" activeKey={sortKey} dir={sortDir} />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-center bg-[#f2f7ff] dark:bg-[#11233e] whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort("weekly4wh")}
                      className="inline-flex items-center gap-1 hover:text-blue-600 cursor-pointer"
                    >
                      <span>4WH KPI</span>
                      <SortIcon col="weekly4wh" activeKey={sortKey} dir={sortDir} />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-center border-l border-gray-200 bg-[#effbf5] dark:bg-[#0e2921] whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort("monthly2wh")}
                      className="inline-flex items-center gap-1 hover:text-emerald-600 cursor-pointer"
                    >
                      <span>2WH KPI</span>
                      <SortIcon col="monthly2wh" activeKey={sortKey} dir={sortDir} />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-center bg-[#effbf5] dark:bg-[#0e2921] whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort("monthly4wh")}
                      className="inline-flex items-center gap-1 hover:text-emerald-600 cursor-pointer"
                    >
                      <span>4WH KPI</span>
                      <SortIcon col="monthly4wh" activeKey={sortKey} dir={sortDir} />
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {isLoading && hubs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <span className="inline-flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        Memuat data capaian seluruh hub...
                      </span>
                    </td>
                  </tr>
                ) : filteredAndSortedHubs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400 text-sm">
                      {searchQuery.trim()
                        ? `Tidak ada hub dengan nama "${searchQuery.trim()}".`
                        : "Belum ada data hub terdaftar."}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedHubs.map((row, idx) => {
                    const isOwnHub =
                      Boolean(hubName) &&
                      row.namaHub.toLowerCase().trim() === hubName!.toLowerCase().trim();
                    return (
                      <tr
                        key={row.namaHub}
                        className={`transition-colors ${
                          isOwnHub
                            ? "bg-amber-50/60 hover:bg-amber-100/60"
                            : "hover:bg-gray-50/60"
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center text-xs font-semibold text-gray-500 tabular-nums">
                          {idx + 1}
                        </td>

                        <td
                          className={`sticky left-0 z-10 py-3.5 px-4 border-l border-gray-100 whitespace-nowrap ${
                            isOwnHub ? "bg-[#fffbf2] dark:bg-[#221d15]" : "bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedDetail({ hub: row, tab: "weekly_2wh" })}
                            className="flex items-center gap-2 text-left group cursor-pointer"
                            title={`Lihat detail capaian ${row.namaHub}`}
                          >
                            <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {row.namaHub}
                            </span>
                            {isOwnHub && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/35">
                                Hub Anda
                              </span>
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 border-l border-gray-100 whitespace-nowrap">
                          {row.lastDataDate ? (
                            <div>
                              <p className="font-bold text-gray-900 tabular-nums">
                                {formatLastDataDate(row.lastDataDate)}
                              </p>
                              {row.lastUploadAt && (
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  Upload: {row.lastUploadAt}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Belum ada data
                            </span>
                          )}
                        </td>

                        {/* Weekly 2WH KPI */}
                        <td className="py-2.5 px-2 text-center border-l border-gray-100">
                          <button
                            type="button"
                            onClick={() => setSelectedDetail({ hub: row, tab: "weekly_2wh" })}
                            title={`Klik untuk detail Weekly 2WH ${row.namaHub}`}
                            className="inline-flex items-center justify-center rounded-xl px-2 py-1.5 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 hover:ring-1 hover:ring-blue-400/40 transition-all cursor-pointer"
                          >
                            <KpiCellContent
                              kpiPct={row.weekly.kpi2wh}
                              shifts={row.weekly.shifts2wh}
                              subText={`Ded ${row.weekly.dedicated2whAch.toFixed(0)}% · Plus ${row.weekly.kurirPlus2whAch.toFixed(0)}%`}
                            />
                          </button>
                        </td>

                        {/* Weekly 4WH KPI */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedDetail({ hub: row, tab: "weekly_4wh" })}
                            title={`Klik untuk detail Weekly 4WH ${row.namaHub}`}
                            className="inline-flex items-center justify-center rounded-xl px-2 py-1.5 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 hover:ring-1 hover:ring-blue-400/40 transition-all cursor-pointer"
                          >
                            <KpiCellContent
                              kpiPct={row.weekly.kpi4wh}
                              shifts={row.weekly.shifts4wh}
                              subText={`${row.weekly.shifts4wh} shift`}
                            />
                          </button>
                        </td>

                        {/* Monthly 2WH KPI */}
                        <td className="py-2.5 px-2 text-center border-l border-gray-100">
                          <button
                            type="button"
                            onClick={() => setSelectedDetail({ hub: row, tab: "monthly_2wh" })}
                            title={`Klik untuk detail Monthly 2WH ${row.namaHub}`}
                            className="inline-flex items-center justify-center rounded-xl px-2 py-1.5 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:ring-1 hover:ring-emerald-400/40 transition-all cursor-pointer"
                          >
                            <KpiCellContent
                              kpiPct={row.monthly.kpi2wh}
                              shifts={row.monthly.shifts2wh}
                              subText={`Ded ${row.monthly.dedicated2whAch.toFixed(0)}% · Plus ${row.monthly.kurirPlus2whAch.toFixed(0)}%`}
                            />
                          </button>
                        </td>

                        {/* Monthly 4WH KPI */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedDetail({ hub: row, tab: "monthly_4wh" })}
                            title={`Klik untuk detail Monthly 4WH ${row.namaHub}`}
                            className="inline-flex items-center justify-center rounded-xl px-2 py-1.5 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:ring-1 hover:ring-emerald-400/40 transition-all cursor-pointer"
                          >
                            <KpiCellContent
                              kpiPct={row.monthly.kpi4wh}
                              shifts={row.monthly.shifts4wh}
                              subText={`${row.monthly.shifts4wh} shift`}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {filteredAndSortedHubs.length > 0 && (
                <tfoot>
                  <tr className="bg-amber-50/60 border-t-2 border-gray-200 font-bold text-gray-900">
                    <td
                      colSpan={3}
                      className="sticky left-0 z-10 bg-[#fef6e9] dark:bg-[#2a2015] py-3.5 px-4 uppercase tracking-wide text-xs"
                    >
                      RATA-RATA ALL HUB ({summary.totalHubs} HUB)
                    </td>
                    <td className="py-3.5 px-3 text-center border-l border-gray-200 tabular-nums">
                      {summary.avgWeekly2wh !== null ? `${summary.avgWeekly2wh.toFixed(1)}%` : "-"}
                    </td>
                    <td className="py-3.5 px-3 text-center tabular-nums">
                      {summary.avgWeekly4wh !== null ? `${summary.avgWeekly4wh.toFixed(1)}%` : "-"}
                    </td>
                    <td className="py-3.5 px-3 text-center border-l border-gray-200 tabular-nums">
                      {summary.avgMonthly2wh !== null ? `${summary.avgMonthly2wh.toFixed(1)}%` : "-"}
                    </td>
                    <td className="py-3.5 px-3 text-center tabular-nums">
                      {summary.avgMonthly4wh !== null ? `${summary.avgMonthly4wh.toFixed(1)}%` : "-"}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <HubProductivityDetailModal
        hub={selectedDetail?.hub ?? null}
        focusTab={selectedDetail?.tab ?? "weekly_2wh"}
        onChangeFocusTab={(tab) =>
          setSelectedDetail((prev) => (prev ? { ...prev, tab } : null))
        }
        weekLabel={formatWeekLabel(weekStart)}
        monthLabel={monthLabel}
        lastDataLabel={formatLastDataDate(selectedDetail?.hub.lastDataDate ?? null)}
        onClose={() => setSelectedDetail(null)}
      />
    </div>
  );
}
