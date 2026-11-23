"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClosingData } from "@/types/closing";
import { formatNumber, getRowColor, getRowColorClass } from "@/lib/utils";
import { parseTimestamp } from "@/lib/dateUtils";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Compass,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HubTableProps {
  data: ClosingData[];
  isLoading?: boolean;
  onSelectHub?: (row: ClosingData) => void;
}
type SortKey = keyof ClosingData;
type SortDir = "asc" | "desc" | null;

// 18 kolom total — lebar dalam % dari total tabel (harus jumlah = 100%)
// Nama Hub lebih lebar, angka-angka lebih sempit
const COLS: {
  key: SortKey;
  label: string;
  short: string;
  numeric?: boolean;
  group: string;
  w: string; // CSS min-width untuk kolom
}[] = [
  { key: "nama_hub",              label: "Nama Hub",              short: "Nama Hub",      group: "",                  w: "9rem"  },
  // In Hub Status
  { key: "in_hub_transported",    label: "Transported (Volume)",  short: "Transported",   group: "In Hub Status",     w: "4.5rem", numeric: true },
  { key: "in_hub_received",       label: "Received (Volume)",     short: "Received",      group: "In Hub Status",     w: "4.5rem", numeric: true },
  { key: "in_hub_assigning",      label: "Assigning (Volume)",    short: "Assigning",     group: "In Hub Status",     w: "4.5rem", numeric: true },
  { key: "in_hub_assigned",       label: "Assigned (Volume)",     short: "Assigned",      group: "In Hub Status",     w: "4.5rem", numeric: true },
  // Fleet Status
  { key: "fleet_delivering",      label: "Delivering (Volume)",   short: "Delivering",    group: "Fleet Status",       w: "5rem",   numeric: true },
  { key: "fleet_delivered",       label: "Delivered",             short: "Delivered",     group: "Fleet Status",       w: "5.5rem", numeric: true },
  { key: "fleet_oh_volume",       label: "On-hold Volume",        short: "OH Vol",        group: "Fleet Status",       w: "4.5rem", numeric: true },
  { key: "fleet_oh_total",        label: "On-hold Total",         short: "OH Total",      group: "Fleet Status",       w: "4.5rem", numeric: true },
  // Total Volume (In Hub + Fleet Status)
  { key: "total_volume",          label: "Total Volume (In Hub + Fleet)", short: "Total Vol", group: "Total Volume",  w: "5rem",   numeric: true },
  // Fleet Head Counts
  { key: "dedicated_actual_2wh",  label: "Dedicated 2WH",        short: "Ded 2W",        group: "Fleet Head Counts",  w: "3.5rem", numeric: true },
  { key: "kurir_plus_actual_2wh", label: "Kurir Plus 2WH",       short: "KP 2W",         group: "Fleet Head Counts",  w: "3.5rem", numeric: true },
  { key: "dedicated_actual_4wh",  label: "Dedicated 4WH",        short: "Ded 4W",        group: "Fleet Head Counts",  w: "3.5rem", numeric: true },
  { key: "mitra_actual_2wh",      label: "Mitra 2WH",            short: "Mtr 2W",        group: "Fleet Head Counts",  w: "3.5rem", numeric: true },
  { key: "mitra_actual_4wh",      label: "Mitra 4WH",            short: "Mtr 4W",        group: "Fleet Head Counts",  w: "3.5rem", numeric: true },
  // Daily Productivity (dari menu Productivity)
  { key: "prod_2w_dedicated",     label: "Daily Productivity: 2W Dedicated",  short: "2W Dedicated",  group: "Daily Productivity", w: "4.8rem", numeric: true },
  { key: "prod_2w_kurir_plus",    label: "Daily Productivity: 2W Kurir Plus", short: "2W Kurir Plus", group: "Daily Productivity", w: "4.8rem", numeric: true },
  { key: "prod_4w_dedicated",     label: "Daily Productivity: 4W Dedicated",  short: "4W Dedicated",  group: "Daily Productivity", w: "4.8rem", numeric: true },
  { key: "prod_2w_mitra",         label: "Daily Productivity: 2W Mitra",      short: "2W Mitra",      group: "Daily Productivity", w: "4.2rem", numeric: true },
  { key: "prod_4w_mitra",         label: "Daily Productivity: 4W Mitra",      short: "4W Mitra",      group: "Daily Productivity", w: "4.2rem", numeric: true },
  // Backlog, Expedite & Parcel Sweeper
  { key: "backlog_total",              label: "Backlog",                     short: "Backlog",       group: "Backlog",           w: "3.8rem", numeric: true },
  { key: "backlog_pct",                label: "Persentase Backlog (Backlog / Total Volume)", short: "Backlog %", group: "Backlog", w: "4.2rem", numeric: true },
  { key: "total_expedite",             label: "To Expedite",                 short: "Expedite",      group: "Expedite",          w: "3.8rem", numeric: true },
  { key: "parcel_sweeper_total",       label: "Parcel Sweeper Total",        short: "PS Total",      group: "Parcel Sweeper",    w: "3.8rem", numeric: true },
  { key: "parcel_sweeper_scanned_pct", label: "Parcel Sweeper Scanned (%)",  short: "Scanned %",     group: "Parcel Sweeper",    w: "3.8rem", numeric: true },
  // Metadata
  { key: "submitted_at",               label: "Last Update",                 short: "Update",        group: "",                  w: "3.8rem" },
];

const GROUPS = [
  { label: "",                   span: 1 },
  { label: "In Hub Status",      span: 4 },
  { label: "Fleet Status",       span: 4 },
  { label: "Total Volume",       span: 1 },
  { label: "Fleet Head Counts",  span: 5 },
  { label: "Daily Productivity", span: 5 },
  { label: "Backlog",            span: 2 },
  { label: "Expedite",           span: 1 },
  { label: "Parcel Sweeper",     span: 2 },
  { label: "",                   span: 1 },
];

function NumCell({
  value,
  isManual,
  className = "text-gray-700",
  suffix = "",
  decimals = 0,
}: {
  value: number | null | undefined;
  isManual?: boolean;
  className?: string;
  suffix?: string;
  decimals?: number;
}) {
  if (value === null || value === undefined) {
    return <td className="px-1.5 py-1.5 text-right text-gray-300 dark:text-slate-600">-</td>;
  }
  const formatted =
    decimals > 0
      ? formatNumber(value, decimals).replace(/,0$/, "") + suffix
      : formatNumber(value, 0) + suffix;

  return (
    <td
      className={`px-1.5 py-1.5 text-right ${className} ${
        isManual ? "bg-purple-50/90 ring-1 ring-inset ring-purple-300" : ""
      }`}
      title={isManual ? "Angka ini diinput / diedit secara manual" : undefined}
    >
      <span className="inline-flex items-center justify-end gap-0.5">
        <span>{formatted}</span>
        {isManual && (
          <span
            className="inline-block px-1 py-0 text-[8px] font-bold leading-tight text-purple-700 bg-purple-200/80 rounded"
            title="Input Manual"
          >
            M
          </span>
        )}
      </span>
    </td>
  );
}

function ProdCell({
  value,
  target,
  invertTarget = false,
}: {
  value: number | null | undefined;
  target: number | null | undefined;
  invertTarget?: boolean;
}) {
  if (value === null || value === undefined) {
    return <td className="px-1.5 py-1.5 text-right text-gray-300 dark:text-slate-600">-</td>;
  }

  const formatted = formatNumber(value, 1).replace(/,0$/, "");
  const hasTarget = target !== null && target !== undefined && target > 0;

  // Dedicated & Kurir Plus: Hijau jika >= target, Merah jika < target
  // Mitra (invertTarget = true): Hijau jika <= target, Merah jika > target
  const isGreen = hasTarget
    ? invertTarget
      ? value <= target!
      : value >= target!
    : true;

  const badgeCls = isGreen
    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : "bg-red-100 text-red-700 border-red-300";

  const tooltip = hasTarget
    ? invertTarget
      ? `Prod: ${formatted} | Target: ${target} (${
          isGreen ? "Hijau: ≤ Target" : "Merah: > Target"
        })`
      : `Prod: ${formatted} | Target: ${target} (${
          isGreen ? "Hijau: ≥ Target" : "Merah: < Target"
        })`
    : `Prod: ${formatted}`;

  return (
    <td className="px-1.5 py-1.5 text-right" title={tooltip}>
      <span
        className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-bold leading-tight ${badgeCls}`}
      >
        {formatted}
      </span>
    </td>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-2.5 w-2.5 opacity-40 flex-shrink-0" />;
  return dir === "asc"
    ? <ChevronUp className="h-2.5 w-2.5 flex-shrink-0" />
    : <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" />;
}

function DeliveryBadge({ delivered, transported, hasData }: {
  delivered: number | null; transported: number | null; hasData: boolean;
}) {
  if (!hasData) return <Badge variant="orange">Belum</Badge>;
  if (delivered === null) return <span className="text-gray-300">-</span>;
  const label = delivered.toLocaleString("id-ID");
  if (!transported || transported === 0) return <Badge variant="gray">{label}</Badge>;
  const rate = (delivered / transported) * 100;
  if (rate >= 98) return <Badge variant="green">{label}</Badge>;
  if (rate >= 95) return <Badge variant="yellow">{label}</Badge>;
  return <Badge variant="red">{label}</Badge>;
}

const TABLE_WAYPOINTS = [
  { id: "in-hub", label: "In Hub", group: "In Hub Status" },
  { id: "fleet", label: "Fleet & Vol", group: "Fleet Status" },
  { id: "prod", label: "Productivity", group: "Daily Productivity" },
  { id: "backlog", label: "Backlog & PS", group: "Backlog" },
] as const;

export function HubTable({ data, isLoading, onSelectHub }: HubTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const stickyColRef = useRef<HTMLTableCellElement | null>(null);
  const [scrollState, setScrollState] = useState({
    left: 0,
    max: 0,
    activeGroup: "In Hub Status",
  });
  const holdDelayRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const didHoldPanRef = useRef(false);

  const syncScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const left = Math.min(max, Math.max(0, el.scrollLeft));
    const stickyW = stickyColRef.current?.offsetWidth ?? 144;

    let activeGroup = "In Hub Status";
    const tableEl = tableRef.current;
    if (tableEl && max > 4) {
      const probeX = left + stickyW + 32;
      for (const wp of TABLE_WAYPOINTS) {
        const th = tableEl.querySelector<HTMLElement>(
          `th[data-group="${wp.group}"]`
        );
        if (th && probeX >= th.offsetLeft) {
          activeGroup = wp.group;
        }
      }
      if (left >= max - 6) {
        activeGroup = "Backlog";
      }
    }

    setScrollState((prev) =>
      prev.left === Math.round(left) &&
      prev.max === Math.round(max) &&
      prev.activeGroup === activeGroup
        ? prev
        : { left: Math.round(left), max: Math.round(max), activeGroup }
    );
  }, []);

  useEffect(() => {
    syncScrollState();
    const container = scrollContainerRef.current;
    const table = tableRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => syncScrollState());
    ro.observe(container);
    if (table) ro.observe(table);
    return () => ro.disconnect();
  }, [syncScrollState, data.length, isLoading]);

  const stopHoldPan = useCallback(() => {
    if (holdDelayRef.current !== null) {
      window.clearTimeout(holdDelayRef.current);
      holdDelayRef.current = null;
    }
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopHoldPan, [stopHoldPan]);

  const scrollByStep = useCallback((delta: number) => {
    if (didHoldPanRef.current) {
      didHoldPanRef.current = false;
      return;
    }
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  const startHoldPan = useCallback(
    (direction: -1 | 1) => {
      stopHoldPan();
      didHoldPanRef.current = false;
      holdDelayRef.current = window.setTimeout(() => {
        didHoldPanRef.current = true;
        holdTimerRef.current = window.setInterval(() => {
          const el = scrollContainerRef.current;
          if (!el) return;
          el.scrollLeft += direction * 20;
        }, 16);
      }, 180);
    },
    [stopHoldPan]
  );

  const scrollToEdge = useCallback((edge: "start" | "end") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const targetLeft = edge === "start" ? 0 : el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, []);

  const scrollToGroup = useCallback((groupName: string) => {
    const el = scrollContainerRef.current;
    const table = tableRef.current;
    if (!el || !table) return;
    if (groupName === "In Hub Status") {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    const th = table.querySelector<HTMLElement>(`th[data-group="${groupName}"]`);
    if (!th) return;
    const stickyW = stickyColRef.current?.offsetWidth ?? 144;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const targetLeft = Math.min(max, Math.max(0, th.offsetLeft - stickyW));
    el.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, []);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = scrollContainerRef.current;
      if (!el) return;
      el.scrollLeft = Number(e.target.value);
    },
    []
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1; if (bv == null) return -1;
    if (sortKey === "submitted_at") {
      const at = parseTimestamp(String(av))?.getTime() ?? 0;
      const bt = parseTimestamp(String(bv))?.getTime() ?? 0;
      return sortDir === "asc" ? at - bt : bt - at;
    }
    if (typeof av === "number" && typeof bv === "number")
      return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              {COLS.map((c) => (
                <th key={c.key} style={{ minWidth: c.w }} className="px-2 py-2">
                  <div className="h-3 bg-gray-200 animate-pulse rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t border-gray-100">
                {COLS.map((c) => (
                  <td key={c.key} className="px-2 py-2">
                    <div className="h-3 bg-gray-100 animate-pulse rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-200 p-10 text-center bg-white">
        <p className="text-gray-400 text-sm">Tidak ada data untuk filter yang dipilih.</p>
      </div>
    );
  }

  const canScroll = scrollState.max > 4;
  const scrollPct = canScroll
    ? Math.round((scrollState.left / scrollState.max) * 100)
    : 0;
  const atStart = !canScroll || scrollState.left <= 2;
  const atEnd = !canScroll || scrollState.left >= scrollState.max - 2;

  return (
    <div className="relative z-0 rounded-xl border border-slate-300/75 dark:border-slate-700/80 border-t-[3px] border-t-[#0e3454] dark:border-t-cyan-500 overflow-hidden bg-white shadow-sm w-full">
      {/* Harbor Helm Horizontal Navigator Bar */}
      <div className="px-2.5 py-1.5 bg-gradient-to-r from-[#0e3454]/[0.06] via-sky-50/85 to-[#0e3454]/[0.06] dark:from-slate-900 dark:via-[#0c2640] dark:to-slate-900 border-b border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 select-none">
        {/* Kiri: Sektor Kolom (Quick Jump Waypoints) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#0e3454] dark:text-cyan-300 pr-1">
            <Compass className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
            <span className="hidden sm:inline">Navigasi Tabel</span>
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {TABLE_WAYPOINTS.map((wp) => {
              const isActive = canScroll && scrollState.activeGroup === wp.group;
              const isProd = wp.group === "Daily Productivity";
              return (
                <button
                  key={wp.id}
                  type="button"
                  disabled={!canScroll}
                  onClick={() => scrollToGroup(wp.group)}
                  title={`Lompat ke kolom ${wp.group}`}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all border cursor-pointer disabled:opacity-45 disabled:cursor-default ${
                    isActive
                      ? isProd
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs dark:bg-emerald-500 dark:border-emerald-400"
                        : "bg-[#0e3454] text-amber-200 border-[#0e3454] shadow-2xs dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-400"
                      : isProd
                      ? "bg-emerald-50/90 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/70"
                      : "bg-white/90 text-slate-600 border-slate-200/90 hover:bg-sky-50 hover:text-[#0e3454] hover:border-sky-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:border-cyan-500/60"
                  }`}
                >
                  {wp.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kanan: Helm Slider + Tombol Geser Kiri/Kanan */}
        <div className="flex items-center gap-1.5 ml-auto w-full sm:w-auto justify-end">
          <div className="inline-flex items-center rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 p-0.5 shadow-2xs gap-0.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={atStart}
              onClick={() => scrollToEdge("start")}
              title="Geser ke paling kiri"
              aria-label="Geser ke paling kiri"
              className="p-1 rounded-md text-[#0e3454] dark:text-cyan-300 hover:bg-sky-100/80 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={atStart}
              onClick={() => scrollByStep(-280)}
              onPointerDown={() => {
                if (!atStart) startHoldPan(-1);
              }}
              onPointerUp={stopHoldPan}
              onPointerLeave={stopHoldPan}
              onPointerCancel={stopHoldPan}
              title="Geser kiri (klik atau tahan)"
              aria-label="Geser kiri"
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-[#0e3454] dark:text-cyan-200 hover:bg-sky-100/80 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Kiri</span>
            </button>

            {/* Track Slider Geser Horizontal */}
            <div className="relative flex items-center flex-1 sm:w-36 md:w-44 px-1.5">
              <div className="relative w-full h-2 rounded-full bg-slate-200/90 dark:bg-slate-700 pointer-events-none">
                <div className="w-full h-full rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0e3454] via-sky-600 to-cyan-500 dark:from-cyan-500 dark:to-amber-400"
                    style={{ width: `${canScroll ? Math.max(6, scrollPct) : 100}%` }}
                  />
                </div>
                {canScroll && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#0e3454] dark:bg-amber-400 border-2 border-white dark:border-slate-900 shadow-sm"
                    style={{ left: `${scrollPct}%` }}
                  />
                )}
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(1, scrollState.max)}
                value={scrollState.left}
                disabled={!canScroll}
                onChange={handleSliderChange}
                aria-label="Geser tabel secara horizontal"
                title="Seret untuk menggeser tabel kiri/kanan (atau tahan Shift + Scroll)"
                className="absolute inset-0 w-full h-full opacity-0 cursor-grab active:cursor-grabbing disabled:cursor-default"
              />
            </div>

            <span className="hidden lg:inline-block min-w-[2.1rem] text-center text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-300 tabular-nums">
              {canScroll ? `${scrollPct}%` : "Fit"}
            </span>

            <button
              type="button"
              disabled={atEnd}
              onClick={() => scrollByStep(280)}
              onPointerDown={() => {
                if (!atEnd) startHoldPan(1);
              }}
              onPointerUp={stopHoldPan}
              onPointerLeave={stopHoldPan}
              onPointerCancel={stopHoldPan}
              title="Geser kanan (klik atau tahan)"
              aria-label="Geser kanan"
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-[#0e3454] dark:text-cyan-200 hover:bg-sky-100/80 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <span className="hidden md:inline">Kanan</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={atEnd}
              onClick={() => scrollToEdge("end")}
              title="Geser ke paling kanan"
              aria-label="Geser ke paling kanan"
              className="p-1 rounded-md text-[#0e3454] dark:text-cyan-300 hover:bg-sky-100/80 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={syncScrollState}
        onWheel={(e) => {
          if (e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            const el = scrollContainerRef.current;
            if (el) {
              el.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }
        }}
        className="overflow-auto max-h-[calc(100vh-17rem)]"
      >
      <table ref={tableRef} className="w-full text-xs border-separate border-spacing-0">
        <colgroup>
          {COLS.map((col) => (
            <col key={col.key} style={{ minWidth: col.w }} />
          ))}
        </colgroup>

        <thead>
          {/* Baris 1: Nama Hub (rowSpan=2, terkunci di kiri-atas) + Group header */}
          <tr className="bg-gray-100">
            <th
              ref={stickyColRef}
              rowSpan={2}
              onClick={() => handleSort("nama_hub")}
              title="Nama Hub"
              className="sticky top-0 left-0 z-30 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none bg-gray-100 text-gray-700 border-b-2 border-r border-gray-200 shadow-[2px_2px_4px_-2px_rgba(0,0,0,0.12)] hover:bg-gray-200 transition-colors"
            >
              <div className="flex items-center gap-0.5">
                <span className="leading-tight">Nama Hub</span>
                <SortIcon active={sortKey === "nama_hub"} dir={sortDir} />
              </div>
            </th>
            {GROUPS.slice(1).map((g, i) => (
              <th
                key={i}
                colSpan={g.span}
                data-group={g.label || undefined}
                className={`sticky top-0 z-20 h-[26px] py-1 text-center text-[10px] font-semibold uppercase tracking-wide border-b border-gray-200 ${
                  g.label === "Daily Productivity"
                    ? "border-x border-emerald-300 bg-emerald-100 text-emerald-900"
                    : g.label
                    ? "border-x border-gray-300 bg-gray-100 text-gray-500"
                    : "bg-gray-50 text-gray-500"
                }`}
              >
                {g.label}
              </th>
            ))}
          </tr>

          {/* Baris 2: Column header (selain Nama Hub karena sudah rowSpan=2) */}
          <tr className="bg-gray-50">
            {COLS.filter((col) => col.key !== "nama_hub").map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                title={col.label}
                className={`sticky top-[26px] z-20 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer transition-colors select-none border-b-2 border-gray-200 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.06)] ${
                  col.group === "Daily Productivity"
                    ? "text-right bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-x border-emerald-200/70"
                    : col.numeric
                    ? "text-right bg-gray-50 text-gray-600 hover:bg-gray-100"
                    : "text-left bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <div className={`flex items-center gap-0.5 ${col.numeric ? "justify-end" : ""}`}>
                  <span className="leading-tight">{col.short}</span>
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="[&_td]:border-b [&_td]:border-gray-100">
          {sorted.map((row, i) => {
            const hasData = !!row.submitted_at;
            const color   = getRowColor(row.fleet_delivered, row.in_hub_transported, hasData);
            const rowCls  = getRowColorClass(color);
            const stickyBg = {
              green: "bg-green-50", yellow: "bg-yellow-50",
              red: "bg-red-50",    orange: "bg-orange-50", default: "bg-white",
            }[color];
            const manualSet = new Set(row.manual_fields || []);
            const manualCount = manualSet.size;

            return (
              <tr
                key={i}
                onClick={() => onSelectHub?.(row)}
                title={onSelectHub ? `Klik untuk melihat detail closing ${row.nama_hub}` : undefined}
                className={`${rowCls} transition-colors ${onSelectHub ? "cursor-pointer" : ""}`}
              >
                {/* Nama Hub — sticky */}
                <td
                  className={`px-2 py-1.5 sticky left-0 z-10 font-semibold text-gray-900 whitespace-nowrap truncate max-w-[9rem] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${stickyBg}`}
                  title={
                    manualCount > 0
                      ? `${row.nama_hub} (${manualCount} kolom diinput manual)`
                      : row.nama_hub
                  }
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{row.nama_hub}</span>
                    {manualCount > 0 && (
                      <span
                        className="flex-shrink-0 px-1 py-0.5 text-[9px] font-bold text-purple-700 bg-purple-100 border border-purple-300 rounded"
                        title={`${manualCount} angka diinput/diedit manual: ${Array.from(manualSet).join(", ")}`}
                      >
                        {manualCount}M
                      </span>
                    )}
                  </div>
                </td>
                {/* In Hub Status */}
                <NumCell value={row.in_hub_transported} isManual={manualSet.has("in_hub_transported")} />
                <NumCell value={row.in_hub_received}    isManual={manualSet.has("in_hub_received")} />
                <NumCell value={row.in_hub_assigning}   isManual={manualSet.has("in_hub_assigning")} />
                <NumCell value={row.in_hub_assigned}    isManual={manualSet.has("in_hub_assigned")} />
                {/* Fleet Status */}
                <NumCell value={row.fleet_delivering}   isManual={manualSet.has("fleet_delivering")} />
                <td
                  className={`px-1.5 py-1.5 text-right ${
                    manualSet.has("fleet_delivered")
                      ? "bg-purple-50/90 ring-1 ring-inset ring-purple-300"
                      : ""
                  }`}
                  title={
                    manualSet.has("fleet_delivered")
                      ? "Angka ini diinput / diedit secara manual"
                      : undefined
                  }
                >
                  <span className="inline-flex items-center justify-end gap-0.5">
                    <DeliveryBadge
                      delivered={row.fleet_delivered}
                      transported={row.in_hub_transported}
                      hasData={hasData}
                    />
                    {manualSet.has("fleet_delivered") && (
                      <span
                        className="inline-block px-1 py-0 text-[8px] font-bold leading-tight text-purple-700 bg-purple-200/80 rounded"
                        title="Input Manual"
                      >
                        M
                      </span>
                    )}
                  </span>
                </td>
                <NumCell value={row.fleet_oh_volume}       isManual={manualSet.has("fleet_oh_volume")} />
                <NumCell value={row.fleet_oh_total}        isManual={manualSet.has("fleet_oh_total")} />
                {/* Total Volume */}
                <NumCell
                  value={row.total_volume}
                  className="font-bold text-indigo-700 bg-indigo-50/40"
                />
                {/* Fleet Head Counts */}
                <NumCell value={row.dedicated_actual_2wh}  isManual={manualSet.has("dedicated_actual_2wh")} />
                <NumCell value={row.kurir_plus_actual_2wh} isManual={manualSet.has("kurir_plus_actual_2wh")} />
                <NumCell value={row.dedicated_actual_4wh}  isManual={manualSet.has("dedicated_actual_4wh")} />
                <NumCell value={row.mitra_actual_2wh}      isManual={manualSet.has("mitra_actual_2wh")} />
                <NumCell value={row.mitra_actual_4wh}      isManual={manualSet.has("mitra_actual_4wh")} />
                {/* Daily Productivity */}
                <ProdCell value={row.prod_2w_dedicated}  target={row.target_2w_dedicated} />
                <ProdCell value={row.prod_2w_kurir_plus} target={row.target_2w_kurir_plus} />
                <ProdCell value={row.prod_4w_dedicated}  target={row.target_4w_dedicated} />
                <ProdCell value={row.prod_2w_mitra}      target={row.target_2w_mitra} invertTarget />
                <ProdCell value={row.prod_4w_mitra}      target={row.target_4w_mitra} invertTarget />
                {/* Backlog */}
                <NumCell
                  value={row.backlog_total}
                  isManual={manualSet.has("backlog_total")}
                  className="font-semibold text-red-700"
                />
                <NumCell
                  value={row.backlog_pct}
                  className="font-semibold text-rose-600"
                  suffix="%"
                  decimals={1}
                />
                {/* Expedite */}
                <NumCell
                  value={row.total_expedite}
                  isManual={manualSet.has("total_expedite")}
                  className="font-semibold text-orange-600"
                />
                {/* Parcel Sweeper */}
                <NumCell
                  value={row.parcel_sweeper_total}
                  isManual={manualSet.has("parcel_sweeper_total")}
                />
                <NumCell
                  value={row.parcel_sweeper_scanned_pct}
                  isManual={manualSet.has("parcel_sweeper_scanned_pct")}
                  className="font-medium text-blue-700"
                  suffix="%"
                  decimals={1}
                />
                {/* Update */}
                <td className="px-1.5 py-1.5 text-center text-gray-400 whitespace-nowrap">
                  {row.submitted_at
                    ? (parseTimestamp(row.submitted_at)?.toLocaleTimeString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        hour: "2-digit",
                        minute: "2-digit",
                      }) ?? row.submitted_at)
                    : <span className="text-orange-400 font-medium">Belum</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
        <span className="font-medium text-gray-600">Color = Delivered/Transported:</span>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-green-300 dark:bg-emerald-500/50 dark:ring-1 dark:ring-emerald-400/50" /><span>≥ 98%</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-yellow-300 dark:bg-amber-500/50 dark:ring-1 dark:ring-amber-400/50" /><span>95–97%</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-red-300 dark:bg-rose-500/50 dark:ring-1 dark:ring-rose-400/50" /><span>&lt; 95%</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-orange-200 dark:bg-orange-500/25 dark:ring-1 dark:ring-orange-400/40" /><span>Belum Update</span></div>
        <div className="h-3 w-px bg-gray-300 dark:bg-slate-600 mx-1" />
        <div className="flex items-center gap-1">
          <span className="px-1 py-0 text-[8px] font-bold text-purple-700 bg-purple-200 border border-purple-300 rounded">M</span>
          <span>Angka Diinput / Diedit Manual</span>
        </div>
        <div className="h-3 w-px bg-gray-300 dark:bg-slate-600 mx-1" />
        <span className="font-medium text-gray-600">Daily Productivity:</span>
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0 text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded">Hijau</span>
          <span>Dedicated/KP ≥ Target · Mitra ≤ Target</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0 text-[9px] font-bold text-red-700 bg-red-100 border border-red-300 rounded">Merah</span>
          <span>Dedicated/KP &lt; Target · Mitra &gt; Target</span>
        </div>
      </div>
    </div>
  );
}
