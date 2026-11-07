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
          ? "bg-slate-100/90 border-slate-200 text-slate-400 cursor-not-allowed opacity-80"
          : enabled
          ? "bg-emerald-50/90 border-emerald-300 text-emerald-900 shadow-2xs cursor-pointer hover:bg-emerald-100/70"
          : "bg-white border-slate-200 text-slate-600 shadow-2xs cursor-pointer hover:bg-slate-50"
      } ${className}`}
      onClick={handleToggle}
      title={tooltipText}
    >
      {/* Icon */}
      {isAvailable ? (
        <UserCheck
          className={`h-4 w-4 flex-shrink-0 ${
            enabled ? "text-emerald-600" : "text-slate-400"
          }`}
        />
      ) : (
        <ShieldAlert className="h-4 w-4 flex-shrink-0 text-slate-400" />
      )}

      {/* Label & Status */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-semibold text-[11px] whitespace-nowrap">
          Grace Period 14H
        </span>

        {/* L15D Status Badge */}
        {!isAvailable ? (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600 border border-slate-300">
            L15D ({dataDaysCount}/15 hari)
          </span>
        ) : (
          <span
            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
              enabled
                ? "bg-emerald-200/80 text-emerald-800"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            L15D Ready
          </span>
        )}

        {/* Count of excluded couriers if enabled */}
        {isAvailable && enabled && typeof excludedCount === "number" && excludedCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
            {excludedCount} kurir
          </span>
        )}
      </div>

      {/* Switch Toggle */}
      <div
        className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center px-0.5 ml-1 flex-shrink-0 ${
          !isAvailable
            ? "bg-slate-200"
            : enabled
            ? "bg-emerald-500"
            : "bg-slate-300"
        }`}
      >
        <div
          className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform transform ${
            enabled && isAvailable ? "translate-x-3.5" : "translate-x-0"
          }`}
        />
      </div>
    </div>
  );
}
