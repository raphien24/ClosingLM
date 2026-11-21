"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Package,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

export interface HubSegmentDetail {
  shifts: number;
  delivered: number;
  avgProductivity: number;
  target: number;
  threshold75: number;
  achievement: number;
  activeDays: number;
  avgCouriersPerDay: number;
  shortfallPerCourier: number;
  totalGapParcels: number;
  catchUpTarget: number;
}

export interface HubPeriodDetail {
  kpi2wh: number;
  kpi4wh: number;
  dedicated2whAch: number;
  kurirPlus2whAch: number;
  dedicated4whAch: number;
  shifts2wh: number;
  shifts4wh: number;
  segments: {
    dedicated2wh: HubSegmentDetail;
    kurirPlus2wh: HubSegmentDetail;
    dedicated4wh: HubSegmentDetail;
    mitra2wh: HubSegmentDetail;
    mitra4wh: HubSegmentDetail;
  };
}

export interface HubDetailItem {
  namaHub: string;
  lastDataDate: string | null;
  lastUploadAt: string | null;
  hasL15D: boolean;
  weekly: HubPeriodDetail;
  monthly: HubPeriodDetail;
}

export type DetailFocusTab = "weekly_2wh" | "weekly_4wh" | "monthly_2wh" | "monthly_4wh";

interface HubProductivityDetailModalProps {
  hub: HubDetailItem | null;
  focusTab: DetailFocusTab;
  onChangeFocusTab: (tab: DetailFocusTab) => void;
  weekLabel: string;
  monthLabel: string;
  lastDataLabel: string;
  onClose: () => void;
}

function getStatusPill(pct: number, shifts: number) {
  if (shifts <= 0) {
    return {
      label: "TIDAK ADA SHIFT",
      cls: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    };
  }
  if (pct >= 100) {
    return {
      label: "✓ ACHIEVED",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/35",
    };
  }
  if (pct >= 80) {
    return {
      label: "◐ PROGRESS",
      cls: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/35",
    };
  }
  return {
    label: "✕ BELOW",
    cls: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-400/35",
  };
}

function SegmentDetailCard({
  title,
  subtitle,
  dotClass,
  seg,
}: {
  title: string;
  subtitle: string;
  dotClass: string;
  seg: HubSegmentDetail;
}) {
  const hasShifts = seg.shifts > 0;
  const pill = getStatusPill(seg.achievement, seg.shifts);
  const barWidth = Math.max(0, Math.min(seg.achievement, 100));
  const barColor =
    seg.achievement >= 100
      ? "bg-emerald-500"
      : seg.achievement >= 80
      ? "bg-amber-500"
      : "bg-rose-500";
  const isAchieved = hasShifts && seg.shortfallPerCourier <= 0;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-[#fcfdff] dark:bg-[#0f172a]/75 p-4 sm:p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{title}</h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 ml-4.5">
              {subtitle}
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold whitespace-nowrap ${pill.cls}`}
          >
            {pill.label}
          </span>
        </div>

        {/* Achievement Bar */}
        <div className="mt-3.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Achievement</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
              {hasShifts ? `${seg.achievement.toFixed(1)}%` : "-"}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${hasShifts ? barColor : "bg-slate-400"}`}
              style={{ width: `${hasShifts ? barWidth : 0}%` }}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 mt-3.5">
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700/70 p-2.5">
            <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              Avg Productivity
            </p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {hasShifts ? `${seg.avgProductivity.toFixed(1)} pkt/hr` : "-"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700/70 p-2.5">
            <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              Target / Threshold 75%
            </p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {seg.target.toFixed(1)}{" "}
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                / {seg.threshold75.toFixed(1)}
              </span>
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700/70 p-2.5">
            <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Package className="h-3 w-3" /> Total Delivered
            </p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {hasShifts ? `${seg.delivered.toLocaleString("en-US")} pkt` : "-"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700/70 p-2.5">
            <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Users className="h-3 w-3" /> Shifts · Kurir/Hr
            </p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {hasShifts
                ? `${seg.shifts.toLocaleString("en-US")} (${seg.avgCouriersPerDay}/hr × ${seg.activeDays}h)`
                : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* Gap / Catch-Up Summary */}
      {hasShifts && (
        <div
          className={`mt-3.5 rounded-xl border p-3 text-xs ${
            isAchieved
              ? "bg-emerald-50 border-emerald-200 dark:border-emerald-500/30"
              : "bg-[#fff7ec] dark:bg-[#241911] border-amber-200 dark:border-amber-500/35"
          }`}
        >
          {isAchieved ? (
            <div className="flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Target Tercapai (Gap 0 paket)
              </span>
              <span className="tabular-nums font-extrabold">
                Target: {seg.target.toFixed(1)} pkt/hr
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-amber-800 dark:text-amber-200 font-semibold">
                  Kekurangan ({seg.avgCouriersPerDay} kurir × {seg.activeDays} hari):
                </span>
                <span className="font-extrabold text-orange-700 dark:text-amber-300 tabular-nums">
                  {seg.shortfallPerCourier.toFixed(1)} pkt/hr · Gap {seg.totalGapParcels.toLocaleString("en-US")} pkt
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-200/70 dark:border-amber-500/20">
                <span className="text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1">
                  <Target className="h-3 w-3 text-rose-500 dark:text-amber-300" />
                  Target Catch Up Besok:
                </span>
                <span className="font-extrabold text-blue-600 dark:text-sky-300 tabular-nums">
                  {seg.catchUpTarget.toFixed(1)} pkt/hari
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const FOCUS_TABS: { id: DetailFocusTab; label: string; period: "Weekly" | "Monthly"; fleet: "2WH" | "4WH" }[] = [
  { id: "weekly_2wh", label: "Weekly · 2WH KPI", period: "Weekly", fleet: "2WH" },
  { id: "weekly_4wh", label: "Weekly · 4WH KPI", period: "Weekly", fleet: "4WH" },
  { id: "monthly_2wh", label: "Monthly · 2WH KPI", period: "Monthly", fleet: "2WH" },
  { id: "monthly_4wh", label: "Monthly · 4WH KPI", period: "Monthly", fleet: "4WH" },
];

export function HubProductivityDetailModal({
  hub,
  focusTab,
  onChangeFocusTab,
  weekLabel,
  monthLabel,
  lastDataLabel,
  onClose,
}: HubProductivityDetailModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hub) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [hub, onClose]);

  if (!mounted || !hub) return null;

  const isWeekly = focusTab === "weekly_2wh" || focusTab === "weekly_4wh";
  const is2wh = focusTab === "weekly_2wh" || focusTab === "monthly_2wh";
  const periodData = isWeekly ? hub.weekly : hub.monthly;
  const activeHeadlinePct = is2wh ? periodData.kpi2wh : periodData.kpi4wh;
  const activeHeadlineShifts = is2wh ? periodData.shifts2wh : periodData.shifts4wh;
  const headlineStatus = getStatusPill(activeHeadlinePct, activeHeadlineShifts);

  const mitraSeg = is2wh ? periodData.segments.mitra2wh : periodData.segments.mitra4wh;
  const mitraVsTarget =
    mitraSeg.shifts > 0 && mitraSeg.target > 0
      ? Math.round((mitraSeg.avgProductivity / mitraSeg.target) * 1000) / 10
      : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hub-prod-detail-title"
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 dark:border-slate-700/80 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700/80 bg-gray-50 dark:bg-slate-900/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#134074] to-[#1d5ca3] dark:from-blue-600 dark:to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="hub-prod-detail-title"
                  className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white truncate"
                >
                  {hub.namaHub}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${headlineStatus.cls}`}
                >
                  {headlineStatus.label}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  {isWeekly ? `Weekly: ${weekLabel}` : `Monthly: ${monthLabel}`}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  Update Terakhir: <strong>{lastDataLabel}</strong>
                  {hub.lastUploadAt ? ` (Upload: ${hub.lastUploadAt})` : ""}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/70 transition-colors cursor-pointer"
            aria-label="Tutup detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Switcher Cepat Periode & Fleet KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FOCUS_TABS.map((t) => {
              const active = focusTab === t.id;
              const pData = t.period === "Weekly" ? hub.weekly : hub.monthly;
              const val = t.fleet === "2WH" ? pData.kpi2wh : pData.kpi4wh;
              const sh = t.fleet === "2WH" ? pData.shifts2wh : pData.shifts4wh;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeFocusTab(t.id)}
                  className={`text-left rounded-xl border px-3 py-2.5 transition-all cursor-pointer ${
                    active
                      ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 dark:border-blue-400 ring-1 ring-blue-500/30"
                      : "border-slate-200 dark:border-slate-700/80 bg-gray-50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t.label}
                  </p>
                  <p className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {sh > 0 ? `${val.toFixed(1)}%` : "-"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Banner Skor KPI Pilihan */}
          <div className="rounded-2xl bg-gradient-to-r from-[#0e2d5a] via-[#133b75] to-[#194c94] dark:from-[#0f2447] dark:via-[#122b54] dark:to-[#173668] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                {isWeekly ? "Weekly" : "Monthly"} {is2wh ? "2WH Core KPI" : "4WH Core KPI"}
              </p>
              <p className="text-xs text-blue-100 mt-1">
                {is2wh
                  ? "Rata-rata Achievement Dedicated 2WH dan Kurir Plus 2WH (Threshold 75%)"
                  : "Achievement Dedicated 4WH (Threshold 75%)"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold tabular-nums leading-none">
                {activeHeadlineShifts > 0 ? `${activeHeadlinePct.toFixed(1)}%` : "-"}
              </p>
              <p className="text-[11px] text-blue-200 mt-1 tabular-nums">
                Total {activeHeadlineShifts.toLocaleString("en-US")} active shifts
              </p>
            </div>
          </div>

          {/* Detail Segmen Utama sesuai 2WH / 4WH */}
          {is2wh ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SegmentDetailCard
                title="Rider Dedicated (2WH)"
                subtitle="Kontrak Dedicated · Motor 2WH"
                dotClass="bg-blue-500"
                seg={periodData.segments.dedicated2wh}
              />
              <SegmentDetailCard
                title="Rider Plus (2WH)"
                subtitle="Kontrak Kurir Plus · Motor 2WH"
                dotClass="bg-emerald-500"
                seg={periodData.segments.kurirPlus2wh}
              />
            </div>
          ) : (
            <SegmentDetailCard
              title="Driver Dedicated (4WH)"
              subtitle="Kontrak Dedicated · Mobil 4WH"
              dotClass="bg-cyan-500"
              seg={periodData.segments.dedicated4wh}
            />
          )}

          {/* Info Armada Mitra (Pendukung, jika ada shift Mitra) */}
          {mitraSeg.shifts > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-gray-50 dark:bg-slate-900/60 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  Catatan Armada {is2wh ? "Rider Mitra (2WH)" : "Driver Mitra (4WH)"}
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Tidak masuk perhitungan Core KPI · {mitraSeg.shifts} shift ·{" "}
                  {mitraSeg.delivered.toLocaleString("en-US")} paket terkirim
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-extrabold text-slate-900 dark:text-white">
                  Avg {mitraSeg.avgProductivity.toFixed(1)} / Target {mitraSeg.target.toFixed(1)}
                </p>
                <p className="text-[11px] font-bold text-sky-600 dark:text-sky-300">
                  {mitraVsTarget.toFixed(1)}% vs Target
                </p>
              </div>
            </div>
          )}

          {/* Tabel Perbandingan Ringkas Weekly vs Monthly untuk Hub Ini */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Perbandingan Lengkap Weekly vs Monthly ({hub.namaHub})
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/80">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-3 text-left font-bold">Segmen Armada</th>
                    <th className="py-2.5 px-3 text-center font-bold">Weekly Avg / Tgt</th>
                    <th className="py-2.5 px-3 text-center font-bold">Weekly Achv</th>
                    <th className="py-2.5 px-3 text-center font-bold">Monthly Avg / Tgt</th>
                    <th className="py-2.5 px-3 text-center font-bold">Monthly Achv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    {
                      name: "Rider Dedicated (2WH)",
                      w: hub.weekly.segments.dedicated2wh,
                      m: hub.monthly.segments.dedicated2wh,
                    },
                    {
                      name: "Rider Plus (2WH)",
                      w: hub.weekly.segments.kurirPlus2wh,
                      m: hub.monthly.segments.kurirPlus2wh,
                    },
                    {
                      name: "Driver Dedicated (4WH)",
                      w: hub.weekly.segments.dedicated4wh,
                      m: hub.monthly.segments.dedicated4wh,
                    },
                  ].map((item) => (
                    <tr key={item.name} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums text-slate-600 dark:text-slate-300">
                        {item.w.shifts > 0
                          ? `${item.w.avgProductivity.toFixed(1)} / ${item.w.target.toFixed(1)}`
                          : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums font-bold text-slate-900 dark:text-white">
                        {item.w.shifts > 0 ? `${item.w.achievement.toFixed(1)}%` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums text-slate-600 dark:text-slate-300">
                        {item.m.shifts > 0
                          ? `${item.m.avgProductivity.toFixed(1)} / ${item.m.target.toFixed(1)}`
                          : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums font-bold text-slate-900 dark:text-white">
                        {item.m.shifts > 0 ? `${item.m.achievement.toFixed(1)}%` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
