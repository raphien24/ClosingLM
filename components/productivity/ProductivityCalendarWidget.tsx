"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { todayWIB } from "@/lib/dateUtils";

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const MONTH_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agt",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const WEEKDAYS_SHORT = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"];

function formatShortYMD(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} ${MONTH_SHORT_ID[m - 1] ?? m} ${y}`;
}

interface ProductivityCalendarWidgetProps {
  refreshKey?: number;
  onCoverageLoaded?: (info: { lastDate: string | null }) => void;
}

export function ProductivityCalendarWidget({
  refreshKey = 0,
  onCoverageLoaded,
}: ProductivityCalendarWidgetProps) {
  const todayYmd = useMemo(() => todayWIB(), []);
  const [todayYear, todayMonth] = useMemo(
    () => todayYmd.split("-").map(Number),
    [todayYmd]
  );

  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);
  const [dates, setDates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [selectedYmd, setSelectedYmd] = useState<string>(todayYmd);
  const [hoveredYmd, setHoveredYmd] = useState<string | null>(null);
  const onCoverageLoadedRef = useRef(onCoverageLoaded);
  onCoverageLoadedRef.current = onCoverageLoaded;

  const fetchCoverage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/productivity/dates", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.dates) {
        setDates(json.dates);
        onCoverageLoadedRef.current?.({ lastDate: json.lastDate ?? null });
      }
    } catch (err) {
      console.error("Gagal memuat cakupan tanggal productivity:", err);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage, refreshKey]);

  const isCurrentMonth = viewYear === todayYear && viewMonth === todayMonth;

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const jumpToCurrentMonth = () => {
    setViewYear(todayYear);
    setViewMonth(todayMonth);
    setSelectedYmd(todayYmd);
  };

  const daysInMonth = useMemo(
    () => new Date(viewYear, viewMonth, 0).getDate(),
    [viewYear, viewMonth]
  );

  // Offset Senin=0 .. Minggu=6
  const leadingEmptyCount = useMemo(() => {
    const jsDay = new Date(viewYear, viewMonth - 1, 1).getDay();
    return (jsDay + 6) % 7;
  }, [viewYear, viewMonth]);

  const { filledCount, elapsedCount } = useMemo(() => {
    let filled = 0;
    let elapsed = 0;
    const mm = String(viewMonth).padStart(2, "0");
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, "0");
      const ymd = `${viewYear}-${mm}-${dd}`;
      if (ymd <= todayYmd) {
        elapsed += 1;
        if ((dates[ymd] ?? 0) > 0) filled += 1;
      }
    }
    return { filledCount: filled, elapsedCount: elapsed };
  }, [viewYear, viewMonth, daysInMonth, todayYmd, dates]);

  const inspectYmd = hoveredYmd || selectedYmd;
  const inspectCount = dates[inspectYmd] ?? 0;
  const inspectFuture = inspectYmd > todayYmd;

  return (
    <div className="w-full lg:w-[348px] xl:w-[372px] flex-shrink-0 rounded-xl bg-[#f7faff] dark:bg-[#0b172e] border border-blue-200/90 dark:border-sky-400/25 p-3 shadow-xs">
      {/* Header mini kalender */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400 flex-shrink-0" />
          <span className="text-xs font-extrabold text-slate-800 truncate">
            {MONTH_NAMES_ID[viewMonth - 1]} {viewYear}
          </span>
          {loadedOnce && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border tabular-nums ${
                elapsedCount > 0 && filledCount === elapsedCount
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-blue-50 text-blue-700 border-blue-200 dark:border-sky-700/50"
              }`}
              title="Jumlah hari terisi dari hari yang sudah berjalan di bulan ini"
            >
              {filledCount}/{elapsedCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={jumpToCurrentMonth}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-700 hover:brightness-95 transition cursor-pointer"
              title="Kembali ke bulan ini"
            >
              Bulan Ini
            </button>
          )}
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Bulan sebelumnya"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            disabled={isCurrentMonth}
            aria-label="Bulan berikutnya"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Header nama hari (Sen–Min) */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS_SHORT.map((wd) => (
          <div
            key={wd}
            className="text-center text-[9px] font-bold uppercase tracking-wider text-slate-400"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Grid tanggal */}
      {loading && !loadedOnce ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[22px] rounded-md bg-slate-200/70 dark:bg-slate-800/70 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingEmptyCount }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-[22px]" />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const mm = String(viewMonth).padStart(2, "0");
            const dd = String(day).padStart(2, "0");
            const ymd = `${viewYear}-${mm}-${dd}`;
            const count = dates[ymd] ?? 0;
            const hasData = count > 0;
            const isFuture = ymd > todayYmd;
            const isToday = ymd === todayYmd;
            const isSelected = selectedYmd === ymd;

            const toneClass = hasData
              ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:brightness-95 dark:hover:brightness-110"
              : isFuture
              ? "bg-slate-100/70 dark:bg-slate-800/45 text-[#94a3b8] dark:text-slate-600 border-transparent cursor-default"
              : "bg-rose-50 text-rose-700 border-rose-200 hover:brightness-95 dark:hover:brightness-110";

            const tooltipText = hasData
              ? `${formatShortYMD(ymd)} — Ada database (${count} kurir)`
              : isFuture
              ? `${formatShortYMD(ymd)} — Tanggal mendatang`
              : `${formatShortYMD(ymd)} — Belum ada database`;

            return (
              <button
                key={ymd}
                type="button"
                title={tooltipText}
                onMouseEnter={() => setHoveredYmd(ymd)}
                onMouseLeave={() => setHoveredYmd(null)}
                onClick={() => setSelectedYmd(ymd)}
                className={`relative h-[22px] w-full rounded-md border text-[11px] font-bold flex items-center justify-center transition-transform cursor-pointer tabular-nums ${toneClass} ${
                  isToday
                    ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-[#f7faff] dark:ring-offset-[#0b172e]"
                    : isSelected
                    ? "ring-2 ring-blue-500 dark:ring-sky-400"
                    : ""
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      )}

      {/* Footer status tanggal aktif / refresh */}
      <div className="mt-2 pt-1.5 border-t border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1 min-w-0 truncate">
          {inspectCount > 0 ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold text-emerald-700 truncate">
                {formatShortYMD(inspectYmd)}: {inspectCount} kurir tersimpan
              </span>
            </>
          ) : inspectFuture ? (
            <span className="text-slate-400 font-medium truncate">
              {formatShortYMD(inspectYmd)}: Tanggal mendatang
            </span>
          ) : (
            <>
              <AlertCircle className="h-3 w-3 text-rose-600 flex-shrink-0" />
              <span className="font-semibold text-rose-700 truncate">
                {formatShortYMD(inspectYmd)}: Belum ada data DB
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={fetchCoverage}
          disabled={loading}
          title="Muat ulang status kalender database"
          className="p-1 rounded-md text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50"
        >
          <RotateCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
