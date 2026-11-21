"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  NauticalChartBackdrop,
  SailorHelmVesselIcon,
} from "@/components/productivity/MaritimeAnimations";
import { SamedayHubDetailModal } from "@/components/sameday/SamedayHubDetailModal";
import { SamedayProgressCharts } from "@/components/sameday/SamedayProgressCharts";
import type { MonitorSamedayData, SamedayHubRow } from "@/lib/samedayService";
import {
  Anchor,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import toast from "react-hot-toast";

type ViewMode = "summary" | "delivering_daily" | "delivered_daily";
type SortKey = "namaHub" | "tier" | "delivMtd" | "delvdMtd" | "achvMtd" | "achvLast";
type SortDir = "asc" | "desc";

function fmtPct(v: number | null, decimalsIfFloat = 1): string {
  if (v === null) return "-";
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(decimalsIfFloat)}%`;
}

function getPctCellClass(val: number | null, target: number | null): string {
  if (val === null) return "text-slate-400 dark:text-slate-500";
  if (target === null) return "text-slate-800 dark:text-slate-100";
  if (val >= target) return "text-emerald-600 dark:text-emerald-400 font-bold";
  if (val >= target - 2) return "text-amber-600 dark:text-amber-300 font-bold";
  return "text-rose-600 dark:text-rose-400 font-bold";
}

function getPctBadgeClass(val: number | null, target: number | null): string {
  if (val === null) {
    return "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
  }
  if (target === null || val >= target) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/35";
  }
  if (val >= target - 2) {
    return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/35";
  }
  return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-400/35";
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
  if (col !== activeKey) return <ArrowUpDown className="h-3 w-3 opacity-45 flex-shrink-0" />;
  return dir === "asc" ? (
    <ArrowUp className="h-3 w-3 text-amber-600 dark:text-amber-300 flex-shrink-0" />
  ) : (
    <ArrowDown className="h-3 w-3 text-amber-600 dark:text-amber-300 flex-shrink-0" />
  );
}

export default function MonitorSamedayPage() {
  const { hubName } = useAuth();
  const [data, setData] = useState<MonitorSamedayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "met" | "below">("all");
  const [sortKey, setSortKey] = useState<SortKey>("namaHub");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedHub, setSelectedHub] = useState<SamedayHubRow | null>(null);
  const reqSeqRef = useRef(0);

  const fetchData = useCallback(async (forceRefresh = false) => {
    const seq = ++reqSeqRef.current;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sameday${forceRefresh ? "?refresh=1" : ""}`);
      const json = await res.json();
      if (seq !== reqSeqRef.current) return;
      if (json.success) {
        setData(json.data);
      } else {
        toast.error(json.error || "Gagal memuat data Monitor Sameday");
      }
    } catch {
      if (seq === reqSeqRef.current) {
        toast.error("Gagal menghubungi Google Sheets Monitor Sameday.");
      }
    } finally {
      if (seq === reqSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "namaHub" || key === "tier" ? "asc" : "desc");
    }
  };

  const tierOptions = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.summary.tierCounts).sort();
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    const list = data.rows.filter((r) => {
      if (q && !r.namaHub.toLowerCase().includes(q)) return false;
      if (tierFilter !== "all" && r.tier !== tierFilter) return false;
      if (statusFilter !== "all") {
        const isMet =
          r.delivered.mtd !== null &&
          r.targetDelivered !== null &&
          r.delivered.mtd >= r.targetDelivered;
        if (statusFilter === "met" && !isMet) return false;
        if (statusFilter === "below" && isMet) return false;
      }
      return true;
    });

    const getVal = (r: SamedayHubRow): string | number => {
      switch (sortKey) {
        case "namaHub":
          return r.namaHub.toLowerCase();
        case "tier":
          return r.tier;
        case "delivMtd":
          return r.delivering.mtd ?? -1;
        case "delvdMtd":
          return r.delivered.mtd ?? -1;
        case "achvMtd":
          return r.achievementMtd ?? -1;
        case "achvLast":
          return r.achievementLastDate ?? -1;
      }
    };

    return [...list].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return a.namaHub.localeCompare(b.namaHub, "id");
    });
  }, [data, searchQuery, tierFilter, statusFilter, sortKey, sortDir]);

  return (
    <div className="min-h-screen bg-[#e8eef5] dark:bg-transparent pb-12">
      {/* Top Maritime Banner */}
      <div className="w-full px-3 sm:px-6 pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#fffdf9] via-[#f5f9fd] to-[#e9f4f0] dark:from-[#121d2f] dark:via-[#12243d] dark:to-[#0f2c2a] border border-slate-200/90 dark:border-slate-700/80 border-l-4 border-l-sky-600 dark:border-l-sky-400 text-slate-900 dark:text-white px-5 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.14)] dark:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.45)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/80 via-amber-400/70 to-emerald-500/75" />
          <NauticalChartBackdrop variant="weekly" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <SailorHelmVesselIcon />
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Monitor Sameday
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-400/35">
                    STD SD · Hub SD
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <span>CL: {data?.clEmail || "rizal.firlani@spxexpress.com"}</span>
                  {data?.latestDataDate && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-600/60">
                        <Calendar className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                        Update Data: {data.latestDataDate}
                      </span>
                    </>
                  )}
                  {data?.reportDate && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-600/60">
                      Report: {data.reportDate}
                    </span>
                  )}
                  {hubName && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 dark:bg-slate-800/80 dark:border-slate-600/60 text-amber-700 dark:text-amber-300 font-bold">
                        Hub Anda: {hubName}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/80 text-slate-700 dark:text-slate-100 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Sheet
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-6 pt-5 space-y-5">
        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="hover-lift bg-gradient-to-br from-[#fffdf7] to-[#fdf3dc] dark:from-[#1e293b] dark:to-[#282116] rounded-2xl border border-amber-200/85 dark:border-slate-700/80 border-t-[3px] border-t-amber-500 dark:border-t-amber-400 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Total Hub Sameday
              </p>
              <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-gray-900 tabular-nums">
              {data ? data.summary.totalHubs : "-"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {data
                ? Object.entries(data.summary.tierCounts)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([tier, cnt]) => `Tier ${tier}: ${cnt}`)
                    .join(" · ")
                : "Memuat tier..."}
            </p>
          </div>

          <div className="hover-lift bg-gradient-to-br from-[#f6faff] to-[#e9f2fe] dark:from-[#1e293b] dark:to-[#142238] rounded-2xl border border-blue-200/85 dark:border-slate-700/80 border-t-[3px] border-t-blue-600 dark:border-t-blue-500 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Avg SD Delivering
              </p>
              <Truck className="h-4 w-4 text-blue-600 dark:text-sky-400" />
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-gray-900 tabular-nums">
              {data ? fmtPct(data.summary.avgDeliveringMtd) : "-"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              MTD · WTD: {data ? fmtPct(data.summary.avgDeliveringWtd) : "-"}
            </p>
          </div>

          <div className="hover-lift bg-gradient-to-br from-[#f4fbf7] to-[#e3f5ec] dark:from-[#1e293b] dark:to-[#122a23] rounded-2xl border border-emerald-200/85 dark:border-slate-700/80 border-t-[3px] border-t-emerald-600 dark:border-t-emerald-500 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Avg SD Delivered
              </p>
              <PackageCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-gray-900 tabular-nums">
              {data ? fmtPct(data.summary.avgDeliveredMtd) : "-"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              MTD · WTD: {data ? fmtPct(data.summary.avgDeliveredWtd) : "-"}
            </p>
          </div>

          <div className="hover-lift bg-gradient-to-br from-[#f7f8ff] to-[#ebeffe] dark:from-[#1e293b] dark:to-[#17213a] rounded-2xl border border-indigo-200/85 dark:border-slate-700/80 border-t-[3px] border-t-indigo-600 dark:border-t-indigo-500 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Achv vs Target
              </p>
              <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-gray-900 tabular-nums">
              {data ? fmtPct(data.summary.avgAchvMtd, 2) : "-"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {data
                ? `On Target: ${data.summary.achievedCount} · Below: ${data.summary.belowTargetCount}`
                : "Memuat status..."}
            </p>
          </div>
        </div>

        {/* Filter & View Mode Bar */}
        <div className="bg-white rounded-2xl border border-slate-300/75 dark:border-slate-700/80 border-t-[3px] border-t-[#134074] dark:border-t-blue-500 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
            <div>
              <label
                htmlFor="sd-search-hub"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5"
              >
                <Search className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                Cari Nama Hub
              </label>
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="sd-search-hub"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama hub..."
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="sd-tier-filter"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5"
              >
                <Filter className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Filter Tier
              </label>
              <select
                id="sd-tier-filter"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
              >
                <option value="all">Semua Tier</option>
                {tierOptions.map((t) => (
                  <option key={t} value={t}>
                    Tier {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sd-status-filter"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Status Target Delivered (MTD)
              </label>
              <select
                id="sd-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "met" | "below")}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
              >
                <option value="all">Semua Status</option>
                <option value="met">On Target (≥ Target)</option>
                <option value="below">Di Bawah Target (&lt; Target)</option>
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-gray-600 mb-1.5">
                Tampilan Kolom Tabel
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700 text-[11px] font-bold">
                {(
                  [
                    { id: "summary", label: "Ringkas" },
                    { id: "delivering_daily", label: "Deliv 14H" },
                    { id: "delivered_daily", label: "Delvd 14H" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewMode(m.id)}
                    className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      viewMode === m.id
                        ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Charts Progres Sameday */}
        {data && (
          <SamedayProgressCharts
            rows={filteredRows}
            deliveringDailyCols={data.deliveringDailyCols}
            deliveredDailyCols={data.deliveredDailyCols}
            onSelectHub={setSelectedHub}
          />
        )}

        {/* Main Table */}
        <div className="bg-white rounded-2xl border border-slate-300/75 dark:border-slate-700/80 border-t-[3px] border-t-[#134074] dark:border-t-blue-500 shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Anchor className="h-4 w-4 text-[#134074] dark:text-sky-400 animate-ship-bob" />
                <h2 className="text-base sm:text-lg font-extrabold text-gray-900">
                  {viewMode === "summary"
                    ? "Ringkasan Performa Sameday Seluruh Hub"
                    : viewMode === "delivering_daily"
                    ? "Detail Harian SD Delivering (14 Hari Terakhir)"
                    : "Detail Harian SD Delivered (14 Hari Terakhir)"}
                </h2>
                {isLoading && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Memuat...
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Menampilkan {filteredRows.length} dari {data?.rows.length ?? 0} hub · Klik baris atau nama Hub untuk melihat rincian lengkap 14 hari
              </p>
            </div>
          </div>

          <div className="overflow-auto max-h-[70vh] rounded-xl border border-gray-200 dark:border-slate-700/80">
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                {viewMode === "summary" ? (
                  <>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th
                        rowSpan={2}
                        className="sticky top-0 z-20 bg-gray-50 py-3 px-3 text-center text-[11px] font-bold text-gray-500 uppercase w-11 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]"
                      >
                        No
                      </th>
                      <th
                        rowSpan={2}
                        className="sticky left-0 top-0 z-30 bg-gray-50 py-3 px-4 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap border-l border-gray-200 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("namaHub")}
                          className="inline-flex items-center gap-1 hover:text-blue-600 cursor-pointer"
                        >
                          <span>Nama Hub</span>
                          <SortIcon col="namaHub" activeKey={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th
                        rowSpan={2}
                        className="sticky top-0 z-20 bg-gray-50 py-3 px-3 text-center text-xs font-bold text-gray-700 uppercase border-l border-gray-200 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("tier")}
                          className="inline-flex items-center gap-1 hover:text-blue-600 cursor-pointer"
                        >
                          <span>Tier</span>
                          <SortIcon col="tier" activeKey={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th
                        colSpan={2}
                        className="sticky top-0 z-20 h-9 px-3 text-center text-xs font-extrabold uppercase border-l border-gray-200 bg-[#eef2f6] dark:bg-[#1b273a] text-slate-700 dark:text-slate-200 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]"
                      >
                        Target SD
                      </th>
                      <th
                        colSpan={6}
                        className="sticky top-0 z-20 h-9 px-3 text-center text-xs font-extrabold uppercase border-l border-gray-200 bg-[#e6f0ff] dark:bg-[#142a4b] text-blue-700 dark:text-sky-300 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]"
                      >
                        SD Delivering
                      </th>
                      <th
                        colSpan={6}
                        className="sticky top-0 z-20 h-9 px-3 text-center text-xs font-extrabold uppercase border-l border-gray-200 bg-[#e2f7ee] dark:bg-[#103329] text-emerald-700 dark:text-emerald-300 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]"
                      >
                        SD Delivered
                      </th>
                      <th
                        colSpan={2}
                        className="sticky top-0 z-20 h-9 px-3 text-center text-xs font-extrabold uppercase border-l border-gray-200 bg-[#fef3dc] dark:bg-[#2c2114] text-amber-800 dark:text-amber-300 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]"
                      >
                        Achv vs Target
                      </th>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase">
                      <th className="sticky top-9 z-20 bg-gray-50 py-2 px-2.5 text-center border-l border-gray-200 whitespace-nowrap shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">Deliv</th>
                      <th className="sticky top-9 z-20 bg-gray-50 py-2 px-2.5 text-center whitespace-nowrap shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">Delvd</th>

                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center border-l border-gray-200 bg-[#f2f7ff] dark:bg-[#11233e] whitespace-nowrap shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">
                        <button
                          type="button"
                          onClick={() => handleSort("delivMtd")}
                          className="inline-flex items-center gap-1 hover:text-blue-600 cursor-pointer"
                        >
                          <span>MTD</span>
                          <SortIcon col="delivMtd" activeKey={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#f2f7ff] dark:bg-[#11233e] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">L1M</th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#f2f7ff] dark:bg-[#11233e] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">WTD</th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#f2f7ff] dark:bg-[#11233e] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">L1W</th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#f2f7ff] dark:bg-[#11233e] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">L2W</th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#f2f7ff] dark:bg-[#11233e] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">L3W</th>

                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center border-l border-gray-200 bg-[#effbf5] dark:bg-[#0e2921] whitespace-nowrap shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">
                        <button
                          type="button"
                          onClick={() => handleSort("delvdMtd")}
                          className="inline-flex items-center gap-1 hover:text-emerald-600 cursor-pointer"
                        >
                          <span>MTD</span>
                          <SortIcon col="delvdMtd" activeKey={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#effbf5] dark:bg-[#0e2921] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">L1M</th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#effbf5] dark:bg-[#0e2921] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">WTD</th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#effbf5] dark:bg-[#0e2921] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">L1W</th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#effbf5] dark:bg-[#0e2921] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">L2W</th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#effbf5] dark:bg-[#0e2921] shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">L3W</th>

                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center border-l border-gray-200 bg-[#fff9ef] dark:bg-[#241b12] whitespace-nowrap shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">
                        <button
                          type="button"
                          onClick={() => handleSort("achvMtd")}
                          className="inline-flex items-center gap-1 hover:text-amber-700 cursor-pointer"
                        >
                          <span>MTD</span>
                          <SortIcon col="achvMtd" activeKey={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="sticky top-9 z-20 py-2 px-2.5 text-center bg-[#fff9ef] dark:bg-[#241b12] whitespace-nowrap shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">
                        <button
                          type="button"
                          onClick={() => handleSort("achvLast")}
                          className="inline-flex items-center gap-1 hover:text-amber-700 cursor-pointer"
                        >
                          <span>Last Date</span>
                          <SortIcon col="achvLast" activeKey={sortKey} dir={sortDir} />
                        </button>
                      </th>
                    </tr>
                  </>
                ) : (
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase">
                    <th className="sticky top-0 z-20 bg-gray-50 py-3 px-3 text-center w-11 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">No</th>
                    <th className="sticky left-0 top-0 z-30 bg-gray-50 py-3 px-4 text-left border-l border-gray-200 whitespace-nowrap shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">
                      Nama Hub
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 py-3 px-3 text-center border-l border-gray-200 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">Tier</th>
                    <th className="sticky top-0 z-20 bg-gray-50 py-3 px-3 text-center border-l border-gray-200 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">Target</th>
                    <th className="sticky top-0 z-20 bg-gray-50 py-3 px-3 text-center border-l border-gray-200 shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">MTD</th>
                    <th className="sticky top-0 z-20 bg-gray-50 py-3 px-3 text-center shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]">WTD</th>
                    {(viewMode === "delivering_daily"
                      ? data?.deliveringDailyCols || []
                      : data?.deliveredDailyCols || []
                    ).map((col) => (
                      <th
                        key={col.key}
                        className="sticky top-0 z-20 bg-gray-50 py-3 px-2.5 text-center border-l border-gray-200 whitespace-nowrap shadow-[inset_0_-1px_0_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_0_#334155]"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>

              <tbody className="divide-y divide-gray-100 tabular-nums">
                {isLoading && !data ? (
                  <tr>
                    <td colSpan={20} className="py-12 text-center text-gray-400">
                      <span className="inline-flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        Mengambil data STD SD dari Google Sheets...
                      </span>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="py-10 text-center text-gray-400 text-sm">
                      Tidak ada hub yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const isOwnHub =
                      Boolean(hubName) &&
                      row.namaHub.toLowerCase().trim() === hubName!.toLowerCase().trim();
                    const isDeliveringMode = viewMode === "delivering_daily";
                    const dailyTarget = isDeliveringMode ? row.targetDelivering : row.targetDelivered;
                    const dailySection = isDeliveringMode ? row.delivering : row.delivered;

                    return (
                      <tr
                        key={row.namaHub}
                        onClick={() => setSelectedHub(row)}
                        className={`cursor-pointer transition-colors ${
                          isOwnHub
                            ? "bg-amber-50/60 hover:bg-amber-100/60"
                            : "hover:bg-gray-50/60"
                        }`}
                      >
                        <td className="py-3 px-3 text-center text-xs font-semibold text-gray-500">
                          {idx + 1}
                        </td>
                        <td
                          className={`sticky left-0 z-10 py-3 px-4 border-l border-gray-100 whitespace-nowrap ${
                            isOwnHub ? "bg-[#fffbf2] dark:bg-[#221d15]" : "bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{row.namaHub}</span>
                            {isOwnHub && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/35">
                                Hub Anda
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center border-l border-gray-100">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {row.tier}
                          </span>
                        </td>

                        {viewMode === "summary" ? (
                          <>
                            <td className="py-3 px-2.5 text-center border-l border-gray-100 font-semibold text-gray-700">
                              {fmtPct(row.targetDelivering)}
                            </td>
                            <td className="py-3 px-2.5 text-center font-semibold text-gray-700">
                              {fmtPct(row.targetDelivered)}
                            </td>

                            {/* Delivering MTD..L3W */}
                            <td className="py-3 px-2.5 text-center border-l border-gray-100">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md border text-xs font-extrabold ${getPctBadgeClass(
                                  row.delivering.mtd,
                                  row.targetDelivering
                                )}`}
                              >
                                {fmtPct(row.delivering.mtd)}
                              </span>
                            </td>
                            {[row.delivering.l1m, row.delivering.wtd, row.delivering.l1w, row.delivering.l2w, row.delivering.l3w].map(
                              (val, i) => (
                                <td
                                  key={`dlv-${i}`}
                                  className={`py-3 px-2.5 text-center text-xs ${getPctCellClass(
                                    val,
                                    row.targetDelivering
                                  )}`}
                                >
                                  {fmtPct(val)}
                                </td>
                              )
                            )}

                            {/* Delivered MTD..L3W */}
                            <td className="py-3 px-2.5 text-center border-l border-gray-100">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md border text-xs font-extrabold ${getPctBadgeClass(
                                  row.delivered.mtd,
                                  row.targetDelivered
                                )}`}
                              >
                                {fmtPct(row.delivered.mtd)}
                              </span>
                            </td>
                            {[row.delivered.l1m, row.delivered.wtd, row.delivered.l1w, row.delivered.l2w, row.delivered.l3w].map(
                              (val, i) => (
                                <td
                                  key={`dlvd-${i}`}
                                  className={`py-3 px-2.5 text-center text-xs ${getPctCellClass(
                                    val,
                                    row.targetDelivered
                                  )}`}
                                >
                                  {fmtPct(val)}
                                </td>
                              )
                            )}

                            {/* Achievement vs Target */}
                            <td className="py-3 px-2.5 text-center border-l border-gray-100 font-extrabold text-gray-900">
                              {fmtPct(row.achievementMtd, 2)}
                            </td>
                            <td className="py-3 px-2.5 text-center font-bold text-gray-800">
                              {fmtPct(row.achievementLastDate, 2)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-3 text-center border-l border-gray-100 font-semibold text-gray-700">
                              {fmtPct(dailyTarget)}
                            </td>
                            <td
                              className={`py-3 px-3 text-center border-l border-gray-100 ${getPctCellClass(
                                dailySection.mtd,
                                dailyTarget
                              )}`}
                            >
                              {fmtPct(dailySection.mtd)}
                            </td>
                            <td
                              className={`py-3 px-3 text-center ${getPctCellClass(
                                dailySection.wtd,
                                dailyTarget
                              )}`}
                            >
                              {fmtPct(dailySection.wtd)}
                            </td>
                            {dailySection.daily.map((val, dIdx) => (
                              <td
                                key={`d-${dIdx}`}
                                className={`py-3 px-2.5 text-center border-l border-gray-100 text-xs ${getPctCellClass(
                                  val,
                                  dailyTarget
                                )}`}
                              >
                                {fmtPct(val)}
                              </td>
                            ))}
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <SamedayHubDetailModal
        row={selectedHub}
        deliveringDailyCols={data?.deliveringDailyCols || []}
        deliveredDailyCols={data?.deliveredDailyCols || []}
        reportDate={data?.reportDate ?? null}
        latestDataDate={data?.latestDataDate ?? null}
        onClose={() => setSelectedHub(null)}
      />
    </div>
  );
}
