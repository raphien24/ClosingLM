"use client";

import { Target, Lightbulb, CheckCircle2 } from "lucide-react";

export interface GapSegmentMetrics {
  avgProductivity: number;
  target: number;
  threshold75: number;
  achievement: number;
  totalShifts: number;
  totalDelivered: number;
  segmentDays?: number;
  avgCouriersPerDay?: number;
  shortfallPerCourier?: number;
  totalGapParcels?: number;
  catchUpTarget?: number;
}

interface GapSegmentConfig {
  key: string;
  label: string;
  dotClass: string;
  metrics: GapSegmentMetrics;
}

interface ProductivityGapAnalysisProps {
  dedicated2wh: GapSegmentMetrics;
  kurirPlus2wh: GapSegmentMetrics;
  dedicated4wh: GapSegmentMetrics;
  operatingDays: number;
}

function getAchievementColorClass(achievement: number): string {
  if (achievement >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (achievement >= 80) return "text-amber-600 dark:text-amber-300";
  return "text-orange-600 dark:text-orange-300";
}

function GapSegmentCard({ label, dotClass, metrics, fallbackDays }: {
  label: string;
  dotClass: string;
  metrics: GapSegmentMetrics;
  fallbackDays: number;
}) {
  const hasShifts = metrics.totalShifts > 0;
  const days = metrics.segmentDays && metrics.segmentDays > 0 ? metrics.segmentDays : fallbackDays;
  const couriers =
    metrics.avgCouriersPerDay !== undefined
      ? metrics.avgCouriersPerDay
      : days > 0
      ? Math.round(metrics.totalShifts / days)
      : 0;
  const shortfall =
    metrics.shortfallPerCourier !== undefined
      ? metrics.shortfallPerCourier
      : hasShifts
      ? Math.max(0, Math.round((metrics.target - metrics.avgProductivity) * 10) / 10)
      : 0;
  const totalGap =
    metrics.totalGapParcels !== undefined
      ? metrics.totalGapParcels
      : hasShifts
      ? Math.round(Math.max(0, metrics.target - metrics.avgProductivity) * metrics.totalShifts)
      : 0;
  const catchUpTarget =
    metrics.catchUpTarget !== undefined
      ? metrics.catchUpTarget
      : Math.round((metrics.target + shortfall) * 10) / 10;

  const isAchieved = hasShifts && shortfall <= 0;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-md bg-[#fcfdff] dark:bg-[#0f172a]/75 ${
        isAchieved
          ? "border-emerald-300/85 dark:border-emerald-500/40"
          : hasShifts
          ? "border-amber-300/85 dark:border-amber-500/35"
          : "border-slate-200 dark:border-slate-700/80"
      }`}
    >
      <div>
        {/* Judul Role */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {label}
            </h4>
          </div>
          {isAchieved && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/35 flex-shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              Target Tercapai
            </span>
          )}
        </div>

        {/* Ringkasan Target, Avg & Achievement */}
        <div className="mt-3.5 space-y-2 text-xs sm:text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Target Saat Ini:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {metrics.target.toFixed(1)} paket/hari
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Avg Productivity:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {hasShifts ? `${metrics.avgProductivity.toFixed(1)} paket/hari` : "-"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Achievement:</span>
            <span
              className={`font-extrabold tabular-nums ${
                hasShifts
                  ? getAchievementColorClass(metrics.achievement)
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {hasShifts ? `${metrics.achievement.toFixed(1)}%` : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Kotak Sorotan Kekurangan & Target Catch Up */}
      {!hasShifts ? (
        <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
          Belum ada data shift aktif untuk segmen ini pada periode terpilih.
        </div>
      ) : isAchieved ? (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:border-emerald-500/30 p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-emerald-200/80 dark:border-emerald-500/25">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              Kekurangan:
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Target Tercapai
            </span>
          </div>

          <div className="pb-2 border-b border-emerald-200/80 dark:border-emerald-500/25">
            <p className="text-[11px] text-slate-600 dark:text-slate-300">Total gap bulan ini:</p>
            <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums mt-0.5">
              0 paket
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              ({couriers} kurir · {days} hari kerja tanpa defisit)
            </p>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-100">
              <Target className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              Target Besok untuk Catch Up:
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-blue-600 dark:text-sky-300 tabular-nums mt-0.5">
              {metrics.target.toFixed(1)} paket/hari
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              = {metrics.target.toFixed(1)} (target normal) + 0.0 (gap terpenuhi)
            </p>
            <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300 mt-1.5 font-medium">
              Pertahankan delivery minimal {metrics.target.toFixed(1)} paket/hari agar performa tetap bertahan di 100%.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-[#fff7ec] dark:bg-[#241911] border border-amber-200 dark:border-amber-500/35 p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-amber-200/80 dark:border-amber-500/25">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              Kekurangan:
            </span>
            <span className="text-base sm:text-lg font-extrabold text-orange-600 dark:text-amber-300 tabular-nums">
              {shortfall.toFixed(1)} paket/hari
            </span>
          </div>

          <div className="pb-2 border-b border-amber-200/80 dark:border-amber-500/25">
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              Total gap bulan ini:
            </p>
            <p className="text-base font-extrabold text-orange-700 dark:text-orange-300 tabular-nums mt-0.5">
              {totalGap.toLocaleString("en-US")} paket
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              ({couriers} kurir × {shortfall.toFixed(1)} paket × {days} hari)
            </p>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-100">
              <Target className="h-3.5 w-3.5 text-rose-500 dark:text-amber-300 flex-shrink-0" />
              Target Besok untuk Catch Up:
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-blue-600 dark:text-sky-300 tabular-nums mt-0.5">
              {catchUpTarget.toFixed(1)} paket/hari
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              = {metrics.target.toFixed(1)} (target normal) + {shortfall.toFixed(1)} (untuk tutup gap)
            </p>
            <p className="text-[11px] leading-relaxed text-blue-700 dark:text-sky-300 mt-1.5 font-medium">
              Mulai besok, setiap kurir harus deliver {catchUpTarget.toFixed(1)} paket/hari untuk achieve 100% dan menutupi kekurangan.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Section Analisis Kekurangan Productivity (Gap Analysis per segmen kurir)
 * dengan tema kartu maritim-operasional yang selaras dengan mode Terang & Gelap.
 */
export function ProductivityGapAnalysis({
  dedicated2wh,
  kurirPlus2wh,
  dedicated4wh,
  operatingDays,
}: ProductivityGapAnalysisProps) {
  const segments: GapSegmentConfig[] = [
    {
      key: "rider-dedicated",
      label: "Rider Dedicated",
      dotClass: "bg-blue-500",
      metrics: dedicated2wh,
    },
    {
      key: "rider-plus",
      label: "Rider Plus",
      dotClass: "bg-emerald-500",
      metrics: kurirPlus2wh,
    },
    {
      key: "driver-dedicated",
      label: "Driver Dedicated",
      dotClass: "bg-cyan-600 dark:bg-cyan-400",
      metrics: dedicated4wh,
    },
  ];

  return (
    <section className="bg-white rounded-2xl border border-slate-300/75 dark:border-slate-700/80 border-t-[3px] border-t-[#134074] dark:border-t-blue-500 shadow-sm p-5 sm:p-6">
      {/* Header Section */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#134074] to-[#1d5ca3] dark:from-blue-600 dark:to-indigo-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            Analisis Kekurangan Productivity
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gap analysis untuk mencapai target 100%
          </p>
        </div>
      </div>

      {/* 3 Kartu Segmen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-5">
        {segments.map((seg) => (
          <GapSegmentCard
            key={seg.key}
            label={seg.label}
            dotClass={seg.dotClass}
            metrics={seg.metrics}
            fallbackDays={operatingDays}
          />
        ))}
      </div>

      {/* Box Formula & Penjelasan */}
      <div className="mt-5 rounded-xl bg-gray-50 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-700/80 p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2">
        <p className="font-bold text-slate-800 dark:text-slate-100">Formula:</p>
        <ul className="space-y-1 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
          <li>• Kekurangan per kurir = Target - Avg Productivity</li>
          <li>• Total Gap = Kekurangan × Total Kurir × Hari Kerja</li>
          <li>• Target Besok = Target Normal + Kekurangan</li>
        </ul>
        <p className="pt-2 border-t border-slate-200/80 dark:border-slate-700/70 flex items-start gap-1.5 text-[11px] sm:text-xs text-blue-700 dark:text-sky-300">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Penjelasan:</strong> Target Besok adalah productivity harian yang dibutuhkan mulai hari berikutnya untuk achieve target normal PLUS menutupi gap yang sudah terjadi di hari-hari sebelumnya.
          </span>
        </p>
      </div>
    </section>
  );
}
