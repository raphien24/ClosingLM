"use client";

import { useEffect, useState } from "react";

interface CountdownState {
  remainingSec: number;
  remainingPct: number;
}

function getWibEodCountdown(): CountdownState {
  const wibEpochMs = Date.now() + 7 * 3600 * 1000;
  const msInDay = 86400 * 1000;
  const elapsedSec = Math.floor((wibEpochMs % msInDay) / 1000);
  const remainingSec = Math.max(0, 86399 - elapsedSec);
  const remainingPct = Math.min(100, Math.max(0, (remainingSec / 86399) * 100));
  return { remainingSec, remainingPct };
}

function formatHms(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    hh: String(h).padStart(2, "0"),
    mm: String(m).padStart(2, "0"),
    ss: String(s).padStart(2, "0"),
  };
}

/**
 * Widget hitung mundur batas waktu closing harian (End of Day 23:59:59 WIB)
 * bergaya kronometer pelaut dengan animasi progres & indikator urgensi.
 */
export function ClosingCountdownWidget() {
  const [state, setState] = useState<CountdownState | null>(null);

  useEffect(() => {
    setState(getWibEodCountdown());
    const id = window.setInterval(() => {
      setState(getWibEodCountdown());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingSec = state?.remainingSec ?? null;
  const remainingPct = state?.remainingPct ?? 100;

  // Status urgensi: < 1 jam = Kritis, 1–4 jam = Mendekati Batas, > 4 jam = Normal
  const urgency: "normal" | "warning" | "critical" =
    remainingSec === null
      ? "normal"
      : remainingSec < 3600
      ? "critical"
      : remainingSec < 4 * 3600
      ? "warning"
      : "normal";

  const theme = {
    normal: {
      box: "bg-white/75 dark:bg-[#0d1f3d]/85 border-sky-300/80 dark:border-sky-500/35",
      dialBg:
        "bg-gradient-to-br from-[#0b2347] to-[#17427d] dark:from-sky-500/20 dark:to-blue-600/25 border-amber-300/45 dark:border-sky-400/35 text-amber-300 dark:text-sky-300",
      label: "text-[#355580] dark:text-sky-200/80",
      badge:
        "bg-sky-100 text-[#0f2c59] border-sky-300/80 dark:bg-sky-900/50 dark:text-sky-200 dark:border-sky-500/40",
      badgeDot: "bg-emerald-500",
      badgeText: "EOD 23:59",
      timer: "text-[#0a1d3a] dark:text-white",
      track: "bg-sky-200/75 dark:bg-slate-800",
      fill: "from-[#0f2c59] via-[#1d5bbf] to-cyan-500 dark:from-sky-500 dark:to-cyan-300",
    },
    warning: {
      box: "bg-amber-50/95 dark:bg-amber-950/45 border-amber-300 dark:border-amber-500/50",
      dialBg:
        "bg-gradient-to-br from-amber-500 to-orange-500 dark:from-amber-500/25 dark:to-orange-500/25 border-amber-300/70 dark:border-amber-400/45 text-white dark:text-amber-300",
      label: "text-amber-800 dark:text-amber-200/90",
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      badgeDot: "bg-amber-500 animate-pulse",
      badgeText: "Segera",
      timer: "text-amber-900",
      track: "bg-amber-200/75 dark:bg-amber-900/40",
      fill: "from-amber-500 via-orange-500 to-amber-400",
    },
    critical: {
      box: "bg-rose-50/95 dark:bg-rose-950/50 border-rose-300 dark:border-rose-500/60",
      dialBg:
        "bg-gradient-to-br from-rose-600 to-red-600 dark:from-rose-500/30 dark:to-red-600/30 border-rose-300/70 dark:border-rose-400/50 text-white dark:text-rose-300",
      label: "text-rose-800",
      badge: "bg-rose-100 text-rose-800 border-rose-300",
      badgeDot: "bg-rose-500 animate-ping",
      badgeText: "Kritis",
      timer: "text-rose-800",
      track: "bg-rose-200/75 dark:bg-rose-900/40",
      fill: "from-rose-600 via-red-500 to-amber-400",
    },
  }[urgency];

  const { hh, mm, ss } =
    remainingSec !== null ? formatHms(remainingSec) : { hh: "--", mm: "--", ss: "--" };

  return (
    <div
      title="Sisa waktu closing harian hingga pukul 23:59:59 WIB (End of Day)"
      className={`hidden lg:flex items-center gap-2.5 rounded-xl border px-3 py-1.5 backdrop-blur-xs shadow-2xs transition-colors ${theme.box}`}
    >
      {/* Emblem Kronometer Pelaut Beranimasi */}
      <div
        aria-hidden="true"
        className={`relative w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 shadow-xs overflow-hidden ${theme.dialBg}`}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
          {/* Kepala tombol kronometer */}
          <rect x="10" y="1" width="4" height="1.8" rx="0.7" fill="currentColor" opacity="0.85" />
          {/* Dial & jarum kronometer berputar presisi di pusat (12,12) */}
          <g className="animate-chrono-spin">
            <circle cx="12" cy="12.5" r="7.5" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.3" />
            <line
              x1="12"
              y1="12.5"
              x2="12"
              y2="6.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
          {/* Tanda kardinal jam statis */}
          <line x1="12" y1="6.2" x2="12" y2="7.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="12" y1="17.6" x2="12" y2="18.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="5.7" y1="12.5" x2="6.9" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="17.1" y1="12.5" x2="18.3" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="12" cy="12.5" r="1.3" fill="currentColor" />
        </svg>
      </div>

      {/* Info label + progress bar beranimasi */}
      <div className="hidden xl:flex flex-col min-w-[146px]">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider leading-none ${theme.label}`}>
            Batas Closing
          </span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border leading-none ${theme.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${theme.badgeDot}`} />
            {theme.badgeText}
          </span>
        </div>

        {/* Progress Bar Berkilau (sisa waktu hari ini menuju 23:59 WIB) */}
        <div className={`relative w-full h-1.5 rounded-full overflow-hidden mt-1.5 ${theme.track}`}>
          <div
            className={`relative h-full rounded-full bg-gradient-to-r transition-all duration-700 overflow-hidden ${theme.fill}`}
            style={{ width: `${Math.max(4, remainingPct)}%` }}
          >
            <div className="animate-tide-shimmer absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/55 to-transparent" />
          </div>
        </div>
      </div>

      {/* Timer Digital Monospace */}
      <div className="flex flex-col items-end pl-1 xl:border-l xl:border-sky-200/70 dark:xl:border-slate-700/70 xl:pl-2.5">
        <div className={`flex items-baseline gap-0.5 font-mono font-extrabold text-sm sm:text-base tracking-tight tabular-nums leading-none ${theme.timer}`}>
          <span>{hh}</span>
          <span className="animate-pulse opacity-75">:</span>
          <span>{mm}</span>
          <span className="animate-pulse opacity-75">:</span>
          <span>{ss}</span>
        </div>
        <span className={`text-[9px] font-semibold leading-none mt-1 ${theme.label}`}>
          Sisa waktu · WIB
        </span>
      </div>
    </div>
  );
}
