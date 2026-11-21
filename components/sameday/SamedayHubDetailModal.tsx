"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Truck,
  PackageCheck,
  X,
} from "lucide-react";
import type { SamedayHubRow, SamedayPeriodColumn } from "@/lib/samedayService";

interface SamedayHubDetailModalProps {
  row: SamedayHubRow | null;
  deliveringDailyCols: SamedayPeriodColumn[];
  deliveredDailyCols: SamedayPeriodColumn[];
  reportDate: string | null;
  latestDataDate: string | null;
  onClose: () => void;
}

function fmtPct(v: number | null): string {
  if (v === null) return "-";
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`;
}

function getToneClass(val: number | null, target: number | null): string {
  if (val === null) return "text-slate-400 dark:text-slate-500";
  if (target === null) return "text-slate-900 dark:text-white";
  if (val >= target) return "text-emerald-600 dark:text-emerald-400";
  if (val >= target - 2) return "text-amber-600 dark:text-amber-300";
  return "text-rose-600 dark:text-rose-400";
}

export function SamedayHubDetailModal({
  row,
  deliveringDailyCols,
  deliveredDailyCols,
  reportDate,
  latestDataDate,
  onClose,
}: SamedayHubDetailModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!row) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [row, onClose]);

  if (!mounted || !row) return null;

  const isDelivMet =
    row.delivering.mtd !== null &&
    row.targetDelivering !== null &&
    row.delivering.mtd >= row.targetDelivering;
  const isDelvdMet =
    row.delivered.mtd !== null &&
    row.targetDelivered !== null &&
    row.delivered.mtd >= row.targetDelivered;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sameday-detail-title"
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 dark:border-slate-700/80 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700/80 bg-gray-50 dark:bg-slate-900/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#134074] to-[#1d5ca3] dark:from-blue-600 dark:to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="sameday-detail-title"
                  className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white truncate"
                >
                  {row.namaHub}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  Tier {row.tier}
                </span>
                {isDelvdMet ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/35">
                    <CheckCircle2 className="h-3 w-3" /> Delivered On Target
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/35">
                    <AlertTriangle className="h-3 w-3" /> Pantau Target SD
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-300">
                <span>
                  {row.region || "-"} · {row.cluster || "-"} · {row.geoRegion || "-"}
                </span>
                {(latestDataDate || reportDate) && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    Data: <strong>{latestDataDate || reportDate}</strong>
                  </span>
                )}
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

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* 3 Ringkasan Atas: Delivering, Delivered, Achievement vs Target */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-blue-200/85 dark:border-blue-500/35 bg-[#f4f8ff] dark:bg-[#10203a] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-sky-300 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> SD Delivering
                </span>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Target: {fmtPct(row.targetDelivering)}
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">MTD</p>
                  <p className={`text-2xl font-extrabold tabular-nums ${isDelivMet ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-300"}`}>
                    {fmtPct(row.delivering.mtd)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">WTD · L1M</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                    {fmtPct(row.delivering.wtd)} · {fmtPct(row.delivering.l1m)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200/85 dark:border-emerald-500/35 bg-[#f2fbf7] dark:bg-[#0e2721] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <PackageCheck className="h-3.5 w-3.5" /> SD Delivered
                </span>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Target: {fmtPct(row.targetDelivered)}
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">MTD</p>
                  <p className={`text-2xl font-extrabold tabular-nums ${isDelvdMet ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-300"}`}>
                    {fmtPct(row.delivered.mtd)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">WTD · L1M</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                    {fmtPct(row.delivered.wtd)} · {fmtPct(row.delivered.l1m)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200/85 dark:border-amber-500/35 bg-[#fff9ef] dark:bg-[#241b12] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Achievement vs Target
              </p>
              <div className="mt-2.5 flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">MTD</p>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {row.achievementMtd !== null ? `${row.achievementMtd.toFixed(2)}%` : "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Last Date</p>
                  <p className="text-lg font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">
                    {row.achievementLastDate !== null ? `${row.achievementLastDate.toFixed(2)}%` : "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tren Mingguan L3W -> L2W -> L1W -> WTD -> MTD */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-3 text-left font-bold">Metrik Sameday</th>
                  <th className="py-2.5 px-3 text-center font-bold">Target</th>
                  <th className="py-2.5 px-3 text-center font-bold">MTD</th>
                  <th className="py-2.5 px-3 text-center font-bold">L1M</th>
                  <th className="py-2.5 px-3 text-center font-bold">WTD</th>
                  <th className="py-2.5 px-3 text-center font-bold">L1W</th>
                  <th className="py-2.5 px-3 text-center font-bold">L2W</th>
                  <th className="py-2.5 px-3 text-center font-bold">L3W</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {[
                  { name: "SD Delivering", tgt: row.targetDelivering, sec: row.delivering },
                  { name: "SD Delivered", tgt: row.targetDelivered, sec: row.delivered },
                ].map((item) => (
                  <tr key={item.name}>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                      {fmtPct(item.tgt)}
                    </td>
                    {[item.sec.mtd, item.sec.l1m, item.sec.wtd, item.sec.l1w, item.sec.l2w, item.sec.l3w].map(
                      (val, idx) => (
                        <td
                          key={idx}
                          className={`py-2.5 px-3 text-center font-bold ${getToneClass(val, item.tgt)}`}
                        >
                          {fmtPct(val)}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rincian Harian (14 Hari Terakhir) */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Riwayat Harian SD Delivering &amp; SD Delivered
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/80">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300">
                    <th className="py-2 px-3 text-left font-bold whitespace-nowrap">Tanggal</th>
                    <th className="py-2 px-3 text-center font-bold whitespace-nowrap">SD Delivering</th>
                    <th className="py-2 px-3 text-center font-bold whitespace-nowrap">Vs Target Deliv</th>
                    <th className="py-2 px-3 text-center font-bold whitespace-nowrap">SD Delivered</th>
                    <th className="py-2 px-3 text-center font-bold whitespace-nowrap">Vs Target Delvd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {deliveringDailyCols.map((col, idx) => {
                    const delivVal = row.delivering.daily[idx] ?? null;
                    const delvdVal = row.delivered.daily[idx] ?? null;
                    const dayLabel = col.label || deliveredDailyCols[idx]?.label || `Day ${idx + 1}`;
                    const delivGap =
                      delivVal !== null && row.targetDelivering !== null
                        ? delivVal - row.targetDelivering
                        : null;
                    const delvdGap =
                      delvdVal !== null && row.targetDelivered !== null
                        ? delvdVal - row.targetDelivered
                        : null;

                    return (
                      <tr key={col.key} className="hover:bg-gray-50/60">
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          {dayLabel}
                        </td>
                        <td
                          className={`py-2 px-3 text-center font-bold ${getToneClass(
                            delivVal,
                            row.targetDelivering
                          )}`}
                        >
                          {fmtPct(delivVal)}
                        </td>
                        <td className="py-2 px-3 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {delivGap === null ? "-" : `${delivGap >= 0 ? "+" : ""}${delivGap.toFixed(0)}%`}
                        </td>
                        <td
                          className={`py-2 px-3 text-center font-bold ${getToneClass(
                            delvdVal,
                            row.targetDelivered
                          )}`}
                        >
                          {fmtPct(delvdVal)}
                        </td>
                        <td className="py-2 px-3 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {delvdGap === null ? "-" : `${delvdGap >= 0 ? "+" : ""}${delvdGap.toFixed(0)}%`}
                        </td>
                      </tr>
                    );
                  })}
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
