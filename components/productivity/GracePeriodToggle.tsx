"use client";

import { Info, UserCheck, ShieldAlert } from "lucide-react";

interface GracePeriodToggleProps {
  hasL15D: boolean;
  dataDaysCount?: number;
  enabled: boolean;
  onToggle: (nextState: boolean) => void;
  excludedCount?: number;
  className?: string;
}

export function GracePeriodToggle({
  hasL15D,
  dataDaysCount = 0,
  enabled,
  onToggle,
  excludedCount,
  className = "",
}: GracePeriodToggleProps) {
  const isAvailable = Boolean(hasL15D);

  const handleToggle = () => {
    if (!isAvailable) return;
    onToggle(!enabled);
  };

  const tooltipText = isAvailable
    ? enabled
      ? "Grace Period 14H Aktif: Kurir baru (2W/4W Dedicated & 2W Plus < 14 hari sejak join) tidak dihitung ke skor produktivitas, namun TETAP dihitung di Daily Active Rate."
      : "Klik untuk mengaktifkan Grace Period 14 Hari: Kecualikan kurir baru (< 14 hari) dari rata-rata produktivitas Hub."
    : `Fitur Grace Period 14 Hari dinonaktifkan: Memerlukan minimal data histori 15 hari (L15D). Database Hub saat ini baru memiliki ${dataDaysCount} hari data.`;

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all select-none ${
        !isAvailable
          ? "bg-slate-100 dark:bg-slate-800/85 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-85"
          : enabled
          ? "bg-[#ecfdf5] dark:bg-[#0b3328] border-emerald-300 dark:border-emerald-500/50 text-emerald-900 dark:text-emerald-100 shadow-2xs cursor-pointer hover:bg-[#d1fae5] dark:hover:bg-[#0f4032]"
          : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-600/80 text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/80"
      } ${className}`}
      onClick={handleToggle}
      title={tooltipText}
    >
      {/* Icon */}
      {isAvailable ? (
        <UserCheck
          className={`h-4 w-4 flex-shrink-0 ${
            enabled
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-slate-400 dark:text-slate-300"
          }`}
        />
      ) : (
        <ShieldAlert className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-400" />
      )}

      {/* Label & Status */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`font-semibold text-[11px] whitespace-nowrap ${
            enabled && isAvailable
              ? "text-emerald-900 dark:text-emerald-100"
              : ""
          }`}
        >
          Grace Period 14H
        </span>

        {/* L15D Status Badge */}
        {!isAvailable ? (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
            L15D ({dataDaysCount}/15 hari)
          </span>
        ) : (
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
              enabled
                ? "bg-[#a7f3d0] text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-200 border border-emerald-400/50 dark:border-emerald-400/40"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
            }`}
          >
            L15D Ready
          </span>
        )}

        {/* Count of excluded couriers if enabled */}
        {isAvailable && enabled && typeof excludedCount === "number" && excludedCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 dark:bg-emerald-500 text-white">
            {excludedCount} kurir
          </span>
        )}
      </div>

      {/* Switch Toggle */}
      <div
        className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center px-0.5 ml-1 flex-shrink-0 ${
          !isAvailable
            ? "bg-slate-200 dark:bg-slate-700"
            : enabled
            ? "bg-emerald-500"
            : "bg-slate-300 dark:bg-slate-600"
        }`}
      >
        <div
          className={`toggle-thumb w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform transform ${
            enabled && isAvailable ? "translate-x-3.5" : "translate-x-0"
          }`}
        />
      </div>
    </div>
  );
}
