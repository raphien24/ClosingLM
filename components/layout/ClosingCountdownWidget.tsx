"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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
 * bergaya kronometer saku kuningan kapten kapal dengan indikator urgensi & progres pasang surut.
 */
export function ClosingCountdownWidget({
  variant = "navbar",
}: {
  variant?: "navbar" | "drawer";
}) {
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
      box: "bg-gradient-to-r from-[#111b2c]/95 via-[#17253c]/95 to-[#0f1726]/95 border-amber-400/45 shadow-[inset_0_1px_0_rgba(253,230,138,0.16),0_3px_12px_-3px_rgba(0,0,0,0.45)]",
      dialBg:
        "bg-gradient-to-br from-[#2a1e0e] via-[#17243b] to-[#0b1322] border-amber-300/65 text-amber-300",
      label: "text-amber-200/80",
      badge: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
      badgeDot: "bg-emerald-400",
      badgeText: "EOD 23:59",
      timer: "text-amber-50",
      divider: "border-amber-400/25",
      track: "bg-black/45 ring-1 ring-amber-400/20",
      fill: "from-amber-500 via-amber-300 to-cyan-300",
      stud: "bg-amber-300/65",
    },
    warning: {
      box: "bg-gradient-to-r from-[#281a0b]/95 via-[#38230e]/95 to-[#221507]/95 border-amber-400/80 shadow-[0_0_16px_-3px_rgba(245,158,11,0.38)]",
      dialBg:
        "bg-gradient-to-br from-amber-500/35 via-orange-600/30 to-[#1f1307] border-amber-300/80 text-amber-200",
      label: "text-amber-200/90",
      badge: "bg-amber-400/20 text-amber-100 border-amber-300/55",
      badgeDot: "bg-amber-400 animate-pulse",
      badgeText: "Segera",
      timer: "text-amber-100",
      divider: "border-amber-300/30",
      track: "bg-black/45 ring-1 ring-amber-300/25",
      fill: "from-orange-500 via-amber-400 to-yellow-200",
      stud: "bg-amber-200/80",
    },
    critical: {
      box: "bg-gradient-to-r from-[#2f0d16]/95 via-[#43111e]/95 to-[#270911]/95 border-rose-400/85 shadow-[0_0_18px_-2px_rgba(244,63,94,0.45)]",
      dialBg:
        "bg-gradient-to-br from-rose-600/40 via-red-700/35 to-[#22070d] border-rose-300/80 text-rose-200",
      label: "text-rose-200/90",
      badge: "bg-rose-500/25 text-rose-100 border-rose-300/60",
      badgeDot: "bg-rose-400 animate-ping",
      badgeText: "Kritis",
      timer: "text-rose-50",
      divider: "border-rose-300/30",
      track: "bg-black/45 ring-1 ring-rose-400/25",
      fill: "from-rose-600 via-red-400 to-amber-300",
      stud: "bg-rose-300/80",
    },
  }[urgency];

  const { hh, mm, ss } =
    remainingSec !== null ? formatHms(remainingSec) : { hh: "--", mm: "--", ss: "--" };

  const isDrawer = variant === "drawer";

  if (isDrawer) {
    return (
      <div
        title="Sisa waktu closing harian hingga pukul 23:59:59 WIB (End of Day)"
        className={cn(
          "relative flex flex-col gap-2 w-full rounded-xl border px-3 py-2.5 backdrop-blur-md transition-colors",
          theme.box
        )}
      >
        <span aria-hidden="true" className={cn("absolute top-1 left-1 w-1 h-1 rounded-full", theme.stud)} />
        <span aria-hidden="true" className={cn("absolute top-1 right-1 w-1 h-1 rounded-full", theme.stud)} />

        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              aria-hidden="true"
              className={cn(
                "relative w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 shadow-inner overflow-hidden",
                theme.dialBg
              )}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <rect x="10.2" y="0.9" width="3.6" height="1.8" rx="0.8" fill="currentColor" opacity="0.9" />
                <g className="animate-chrono-spin">
                  <circle cx="12" cy="12.5" r="7.5" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.2" />
                  <line x1="12" y1="12.5" x2="12" y2="6.6" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
                </g>
                <circle cx="12" cy="12.5" r="1.4" fill="currentColor" />
              </svg>
            </div>

            <div className="min-w-0">
              <p className={cn("text-[10px] font-bold uppercase tracking-wider leading-tight truncate", theme.label)}>
                Batas Closing
              </p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold border leading-none",
                  theme.badge
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full inline-block", theme.badgeDot)} />
                {theme.badgeText}
              </span>
            </div>
          </div>

          <div className={cn("flex flex-col items-end flex-shrink-0 border-l pl-2.5", theme.divider)}>
            <div
              className={cn(
                "flex items-baseline gap-0.5 font-mono font-extrabold text-sm tracking-tight tabular-nums leading-none",
                theme.timer
              )}
            >
              <span>{hh}</span>
              <span className="animate-pulse opacity-75">:</span>
              <span>{mm}</span>
              <span className="animate-pulse opacity-75">:</span>
              <span>{ss}</span>
            </div>
            <span className={cn("text-[9px] font-semibold leading-none mt-1", theme.label)}>
              WIB · EOD
            </span>
          </div>
        </div>

        <div className={cn("relative w-full h-1.5 rounded-full overflow-hidden", theme.track)}>
          <div
            className={cn(
              "relative h-full rounded-full bg-gradient-to-r transition-all duration-700 overflow-hidden",
              theme.fill
            )}
            style={{ width: `${Math.max(4, remainingPct)}%` }}
          >
            <div className="animate-tide-shimmer absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      title="Sisa waktu closing harian hingga pukul 23:59:59 WIB (End of Day)"
      className={cn(
        "hidden lg:flex relative items-center gap-3 rounded-2xl border px-3.5 py-2 backdrop-blur-md transition-colors flex-shrink-0",
        theme.box
      )}
    >
      {/* Stud paku kuningan khas peti / instrumen navigasi kapal */}
      <span aria-hidden="true" className={cn("absolute top-1.5 left-1.5 w-1 h-1 rounded-full", theme.stud)} />
      <span aria-hidden="true" className={cn("absolute bottom-1.5 left-1.5 w-1 h-1 rounded-full", theme.stud)} />

      {/* Emblem Kronometer Saku Kapten Beranimasi */}
      <div
        aria-hidden="true"
        className={cn(
          "relative w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 shadow-inner overflow-hidden",
          theme.dialBg
        )}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
          {/* Mahkota rantai jam saku */}
          <rect x="10.2" y="0.9" width="3.6" height="1.8" rx="0.8" fill="currentColor" opacity="0.9" />
          {/* Jarum kronometer berputar presisi */}
          <g className="animate-chrono-spin">
            <circle cx="12" cy="12.5" r="7.5" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.2" />
            <line
              x1="12"
              y1="12.5"
              x2="12"
              y2="6.6"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
            />
          </g>
          {/* Penanda arah mata angin / angka jam kardinal */}
          <line x1="12" y1="5.8" x2="12" y2="7.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="12" y1="17.8" x2="12" y2="19.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="5.3" y1="12.5" x2="6.7" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="17.3" y1="12.5" x2="18.7" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="12" cy="12.5" r="1.4" fill="currentColor" />
        </svg>
      </div>

      {/* Info label + progress bar beranimasi (tampil penuh mulai layar 2xl >= 1536px) */}
      <div className="hidden 2xl:flex flex-col min-w-[148px]">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-[10px] font-bold uppercase tracking-wider leading-none whitespace-nowrap", theme.label)}>
            Batas Closing
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border leading-none whitespace-nowrap",
              theme.badge
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full inline-block", theme.badgeDot)} />
            {theme.badgeText}
          </span>
        </div>

        {/* Progress Bar Berkilau (sisa waktu hari ini menuju 23:59 WIB) */}
        <div className={cn("relative w-full h-2 rounded-full overflow-hidden mt-1.5", theme.track)}>
          <div
            className={cn(
              "relative h-full rounded-full bg-gradient-to-r transition-all duration-700 overflow-hidden",
              theme.fill
            )}
            style={{ width: `${Math.max(4, remainingPct)}%` }}
          >
            <div className="animate-tide-shimmer absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </div>
      </div>

      {/* Timer Digital Monospace */}
      <div className={cn("flex flex-col items-end pl-0.5 2xl:border-l 2xl:pl-3", theme.divider)}>
        <div
          className={cn(
            "flex items-baseline gap-0.5 font-mono font-extrabold text-[15px] tracking-tight tabular-nums leading-none whitespace-nowrap",
            theme.timer
          )}
        >
          <span>{hh}</span>
          <span className="animate-pulse opacity-75">:</span>
          <span>{mm}</span>
          <span className="animate-pulse opacity-75">:</span>
          <span>{ss}</span>
        </div>
        <span className={cn("text-[10px] font-semibold leading-none mt-1 whitespace-nowrap", theme.label)}>
          <span className="2xl:hidden">Closing · WIB</span>
          <span className="hidden 2xl:inline">Sisa waktu · WIB</span>
        </span>
      </div>

      {/* Garis progres pasang-surut ringkas untuk layar laptop (1024px–1535px) */}
      <div className={cn("2xl:hidden absolute inset-x-3 bottom-0.5 h-[2px] rounded-full overflow-hidden", theme.track)}>
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", theme.fill)}
          style={{ width: `${Math.max(4, remainingPct)}%` }}
        />
      </div>
    </div>
  );
}
