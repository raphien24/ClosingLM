"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DailyActiveMetrics } from "@/types/productivity";
import { X, Users, Calendar, Calculator, CheckCircle2, Info } from "lucide-react";

interface Props {
  dailyActive: DailyActiveMetrics;
  periodLabel?: string;
  onClose: () => void;
}

export function DailyActiveModal({ dailyActive, periodLabel, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"courier" | "daily">("courier");

  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  const couriers = dailyActive.courierBreakdown ?? [];
  const days = dailyActive.dailyBreakdown ?? [];
  const presentShifts = dailyActive.presentShifts ?? dailyActive.activeShifts;
  const leaveShifts = dailyActive.leaveShifts ?? 0;

  const rateColor =
    dailyActive.value >= 90
      ? "text-emerald-600"
      : dailyActive.value >= 80
      ? "text-amber-600"
      : "text-red-600";

  const totalPresentDed = days.reduce((s, d) => s + d.presentDedicated, 0);
  const totalLeaveDed = days.reduce((s, d) => s + d.leaveDedicated, 0);
  const totalPresentPlus = days.reduce((s, d) => s + d.presentPlus, 0);
  const totalCountedAllDays = days.reduce((s, d) => s + d.totalCounted, 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Detail Daily Active Rate
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>2WH · Dedicated + Kurir Plus</span>
                {periodLabel && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                      <Calendar className="h-3 w-3" />
                      {periodLabel}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Ringkasan 4 Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 p-3.5 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Daily Active Rate
              </p>
              <p className={`text-2xl font-extrabold mt-1 tabular-nums ${rateColor}`}>
                {dailyActive.value}%
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Avg {dailyActive.avgCouriersPerDay} kurir/hari
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Total Active Shifts
              </p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1 tabular-nums">
                {dailyActive.activeShifts.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{presentShifts.toLocaleString("id-ID")} hadir</span>
                {leaveShifts > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-400 text-amber-950 font-bold text-[10px]">
                    +{leaveShifts} cuti
                  </span>
                )}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Unique Headcount
              </p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1 tabular-nums">
                {dailyActive.uniqueHeadcount.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Kurir 2WH Ded + Plus
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-3.5 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Operating Days
              </p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1 tabular-nums">
                {dailyActive.operatingDays}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Hari ada aktivitas
              </p>
            </div>
          </div>

          {/* Formula Box */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-800">
              <Calculator className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Rumus Perhitungan</span>
            </div>
            <p className="text-blue-900">
              <strong>Daily Active Rate</strong> = (Shift Hadir + Cuti Rider Dedicated) ÷ (Unique Headcount × Operating Days) × 100%
            </p>
            <p className="text-blue-700 font-mono text-[11px]">
              = ({presentShifts} + {leaveShifts}) ÷ ({dailyActive.uniqueHeadcount} × {dailyActive.operatingDays}) × 100% ={" "}
              <strong>{dailyActive.value}%</strong>
            </p>
            <p className="text-[11px] text-blue-700 flex items-start gap-1.5 pt-0.5">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Tetap menghitung kurir baru (Grace Period 14H) dan hari cuti Rider Dedicated sebagai masuk pada Daily Active Rate, tanpa mempengaruhi skor Productivity.
              </span>
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("courier")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === "courier"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Rincian Per Kurir ({couriers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("daily")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === "daily"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Rincian Per Hari ({days.length})
            </button>
          </div>

          {/* Tab 1: Rincian Per Kurir */}
          {activeTab === "courier" && (
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
              {couriers.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  Belum ada data kurir 2WH Dedicated / Kurir Plus pada periode ini.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[42vh]">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                        <th className="px-3 py-2.5 text-left">Kurir</th>
                        <th className="px-3 py-2.5 text-left">Tipe</th>
                        <th className="px-3 py-2.5 text-center">Hadir</th>
                        <th className="px-3 py-2.5 text-center">Cuti</th>
                        <th className="px-3 py-2.5 text-center">Total Masuk</th>
                        <th className="px-3 py-2.5 text-left">% Aktif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {couriers.map((c) => {
                        const barColor =
                          c.activeRatePct >= 90
                            ? "bg-emerald-500"
                            : c.activeRatePct >= 80
                            ? "bg-amber-400"
                            : "bg-red-500";
                        return (
                          <tr key={c.courier_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-gray-900 text-xs sm:text-sm">
                                {c.courier_name}
                              </div>
                              <div className="text-[11px] text-gray-400">{c.courier_id}</div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  c.contract_type === "Dedicated"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {c.contract_type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-emerald-600 tabular-nums">
                              {c.presentDays}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums">
                              {c.leaveDays > 0 ? (
                                <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-amber-400 text-amber-950">
                                  {c.leaveDays}
                                </span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-gray-900 tabular-nums">
                              {c.countedDays}
                              <span className="text-[11px] font-normal text-gray-400 ml-0.5">
                                /{dailyActive.operatingDays}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2 min-w-[110px]">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${barColor}`}
                                    style={{ width: `${Math.min(c.activeRatePct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-gray-700 w-11 text-right tabular-nums">
                                  {c.activeRatePct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0">
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-900 text-xs">
                        <td className="px-3 py-2.5">TOTAL ({couriers.length} kurir)</td>
                        <td className="px-3 py-2.5 text-gray-400">-</td>
                        <td className="px-3 py-2.5 text-center text-emerald-600 tabular-nums">
                          {presentShifts}
                        </td>
                        <td className="px-3 py-2.5 text-center text-amber-600 tabular-nums">
                          {leaveShifts}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums">
                          {dailyActive.activeShifts}
                        </td>
                        <td className={`px-3 py-2.5 tabular-nums ${rateColor}`}>
                          {dailyActive.value}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Rincian Per Hari */}
          {activeTab === "daily" && (
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
              {days.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  Belum ada data harian pada periode ini.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[42vh]">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                        <th className="px-3 py-2.5 text-left">Hari &amp; Tanggal</th>
                        <th className="px-3 py-2.5 text-center">Ded. Hadir</th>
                        <th className="px-3 py-2.5 text-center">Ded. Cuti</th>
                        <th className="px-3 py-2.5 text-center">Plus Hadir</th>
                        <th className="px-3 py-2.5 text-center">Total Aktif</th>
                        <th className="px-3 py-2.5 text-right">% Harian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {days.map((d) => {
                        const isLeaveOnlyDay =
                          d.presentDedicated === 0 && d.presentPlus === 0 && d.leaveDedicated > 0;
                        return (
                          <tr key={d.dateKey} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="font-semibold text-gray-900">{d.dayName}</span>
                              <span className="text-xs text-gray-400 ml-1.5">{d.dateLabel}</span>
                              {isLeaveOnlyDay && (
                                <span className="ml-2 inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-400 text-amber-950">
                                  Cuti saja
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-emerald-600 tabular-nums">
                              {d.presentDedicated}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums">
                              {d.leaveDedicated > 0 ? (
                                <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-amber-400 text-amber-950">
                                  {d.leaveDedicated}
                                </span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-purple-600 tabular-nums">
                              {d.presentPlus}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-gray-900 tabular-nums">
                              {d.totalCounted}
                              <span className="text-[11px] font-normal text-gray-400 ml-0.5">
                                /{dailyActive.uniqueHeadcount}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-gray-800 tabular-nums">
                              {d.dailyRatePct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0">
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-900 text-xs">
                        <td className="px-3 py-2.5 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>TOTAL ({dailyActive.operatingDays} hari op.)</span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-emerald-600 tabular-nums">
                          {totalPresentDed}
                        </td>
                        <td className="px-3 py-2.5 text-center text-amber-600 tabular-nums">
                          {totalLeaveDed}
                        </td>
                        <td className="px-3 py-2.5 text-center text-purple-600 tabular-nums">
                          {totalPresentPlus}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums">
                          {totalCountedAllDays}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${rateColor}`}>
                          avg {dailyActive.avgCouriersPerDay}/hr
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
