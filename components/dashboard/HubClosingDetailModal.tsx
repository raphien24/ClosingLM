"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Building2,
  Clock,
  UserCheck,
  PackageCheck,
  Truck,
  Users,
  TrendingUp,
  AlertTriangle,
  ScanLine,
  CheckCircle2,
} from "lucide-react";
import { ClosingData } from "@/types/closing";
import { formatDate, formatNumber } from "@/lib/utils";
import { parseTimestamp } from "@/lib/dateUtils";

interface HubClosingDetailModalProps {
  row: ClosingData | null;
  onClose: () => void;
}

function MetricRow({
  label,
  value,
  isManual = false,
  suffix = "",
  decimals = 0,
  valueClass = "text-gray-900",
}: {
  label: string;
  value: number | null | undefined;
  isManual?: boolean;
  suffix?: string;
  decimals?: number;
  valueClass?: string;
}) {
  const formatted =
    value === null || value === undefined
      ? "-"
      : decimals > 0
      ? formatNumber(value, decimals).replace(/,0$/, "") + suffix
      : formatNumber(value, 0) + suffix;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${
        isManual
          ? "bg-purple-50/70 border-purple-200"
          : "bg-gray-50/80 border-gray-100"
      }`}
    >
      <span className="text-gray-600 font-medium">{label}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`font-bold tabular-nums ${value === null || value === undefined ? "text-gray-400" : valueClass}`}>
          {formatted}
        </span>
        {isManual && (
          <span
            className="px-1 py-0 text-[9px] font-bold text-purple-700 bg-purple-200/80 rounded"
            title="Diinput / diedit manual"
          >
            M
          </span>
        )}
      </span>
    </div>
  );
}

function ProdRow({
  label,
  value,
  target,
  invertTarget = false,
}: {
  label: string;
  value: number | null | undefined;
  target: number | null | undefined;
  invertTarget?: boolean;
}) {
  const hasVal = value !== null && value !== undefined;
  const hasTarget = target !== null && target !== undefined && target > 0;
  const isGreen =
    hasVal && hasTarget
      ? invertTarget
        ? value! <= target!
        : value! >= target!
      : true;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50/80 border border-gray-100 text-xs">
      <div className="min-w-0">
        <span className="text-gray-700 font-medium">{label}</span>
        {hasTarget && (
          <span className="ml-1.5 text-[10px] text-gray-400">
            (Target {invertTarget ? "≤" : "≥"} {target})
          </span>
        )}
      </div>
      {hasVal ? (
        <span
          className={`px-2 py-0.5 rounded border text-[11px] font-bold tabular-nums ${
            isGreen
              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
              : "bg-red-100 text-red-700 border-red-300"
          }`}
        >
          {formatNumber(value, 1).replace(/,0$/, "")}
        </span>
      ) : (
        <span className="text-gray-400 font-bold">-</span>
      )}
    </div>
  );
}

export function HubClosingDetailModal({ row, onClose }: HubClosingDetailModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!row) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [row, onClose]);

  if (!mounted || !row) return null;

  const hasData = !!row.submitted_at;
  const manualSet = new Set(row.manual_fields || []);
  const manualCount = manualSet.size;
  const updateTime = row.submitted_at
    ? parseTimestamp(row.submitted_at)?.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      }) ?? row.submitted_at
    : null;

  const deliveryRate =
    row.fleet_delivered != null && row.in_hub_transported && row.in_hub_transported > 0
      ? (row.fleet_delivered / row.in_hub_transported) * 100
      : null;

  const rateBadgeClass =
    deliveryRate === null
      ? "bg-gray-100 text-gray-600"
      : deliveryRate >= 98
      ? "bg-emerald-100 text-emerald-800"
      : deliveryRate >= 95
      ? "bg-amber-100 text-amber-800"
      : "bg-rose-100 text-rose-700";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hub-detail-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-sky-700" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="hub-detail-modal-title"
                  className="text-base sm:text-lg font-extrabold text-gray-900 truncate"
                >
                  {row.nama_hub}
                </h2>
                {hasData ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="h-3 w-3" />
                    Sudah Closing
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                    <AlertTriangle className="h-3 w-3" />
                    Belum Submit
                  </span>
                )}
                {deliveryRate !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${rateBadgeClass}`}>
                    Delivery {deliveryRate.toFixed(1)}%
                  </span>
                )}
                {manualCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                    {manualCount} Input Manual
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                <span>Tanggal: <strong className="text-gray-700">{formatDate(row.tanggal)}</strong></span>
                {updateTime && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    Update {updateTime} WIB
                  </span>
                )}
                {row.submitted_by && (
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-gray-400" />
                    {row.submitted_by}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail closing"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/70 transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {!hasData && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-800 flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
              <span>
                <strong>{row.nama_hub}</strong> belum mengirimkan laporan closing untuk tanggal{" "}
                <strong>{formatDate(row.tanggal)}</strong>.
              </span>
            </div>
          )}

          {/* Ringkasan Cepat */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Total Volume</p>
              <p className="mt-1 text-xl font-extrabold text-indigo-700 tabular-nums">
                {formatNumber(row.total_volume)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Fleet Delivered</p>
              <p className="mt-1 text-xl font-extrabold text-emerald-700 tabular-nums">
                {formatNumber(row.fleet_delivered)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Total Backlog</p>
              <p className="mt-1 text-xl font-extrabold text-rose-700 tabular-nums">
                {formatNumber(row.backlog_total)}
                {row.backlog_pct != null && (
                  <span className="ml-1.5 text-xs font-bold text-rose-600">
                    ({row.backlog_pct.toFixed(1)}%)
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-xl border border-orange-200/80 bg-orange-50/50 p-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Total Expedite</p>
              <p className="mt-1 text-xl font-extrabold text-orange-700 tabular-nums">
                {formatNumber(row.total_expedite)}
              </p>
            </div>
          </div>

          {/* Detail per Seksi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* In Hub Status */}
            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <PackageCheck className="h-4 w-4 text-sky-600" />
                In Hub Status
              </h3>
              <MetricRow label="Transported (Volume)" value={row.in_hub_transported} isManual={manualSet.has("in_hub_transported")} />
              <MetricRow label="Received (Volume)" value={row.in_hub_received} isManual={manualSet.has("in_hub_received")} />
              <MetricRow label="Assigning (Volume)" value={row.in_hub_assigning} isManual={manualSet.has("in_hub_assigning")} />
              <MetricRow label="Assigned (Volume)" value={row.in_hub_assigned} isManual={manualSet.has("in_hub_assigned")} />
            </div>

            {/* Fleet Status */}
            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Truck className="h-4 w-4 text-amber-600" />
                Fleet Status
              </h3>
              <MetricRow label="Delivering (Volume)" value={row.fleet_delivering} isManual={manualSet.has("fleet_delivering")} />
              <MetricRow label="Delivered" value={row.fleet_delivered} isManual={manualSet.has("fleet_delivered")} valueClass="text-emerald-700" />
              <MetricRow label="On-hold Volume" value={row.fleet_oh_volume} isManual={manualSet.has("fleet_oh_volume")} />
              <MetricRow label="On-hold Total" value={row.fleet_oh_total} isManual={manualSet.has("fleet_oh_total")} />
            </div>

            {/* Fleet Head Counts */}
            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Users className="h-4 w-4 text-indigo-600" />
                Fleet Head Counts
              </h3>
              <MetricRow label="Dedicated 2WH" value={row.dedicated_actual_2wh} isManual={manualSet.has("dedicated_actual_2wh")} />
              <MetricRow label="Kurir Plus 2WH" value={row.kurir_plus_actual_2wh} isManual={manualSet.has("kurir_plus_actual_2wh")} />
              <MetricRow label="Dedicated 4WH" value={row.dedicated_actual_4wh} isManual={manualSet.has("dedicated_actual_4wh")} />
              <MetricRow label="Mitra 2WH" value={row.mitra_actual_2wh} isManual={manualSet.has("mitra_actual_2wh")} />
              <MetricRow label="Mitra 4WH" value={row.mitra_actual_4wh} isManual={manualSet.has("mitra_actual_4wh")} />
            </div>

            {/* Daily Productivity */}
            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Daily Productivity
              </h3>
              <ProdRow label="2W Dedicated" value={row.prod_2w_dedicated} target={row.target_2w_dedicated} />
              <ProdRow label="2W Kurir Plus" value={row.prod_2w_kurir_plus} target={row.target_2w_kurir_plus} />
              <ProdRow label="4W Dedicated" value={row.prod_4w_dedicated} target={row.target_4w_dedicated} />
              <ProdRow label="2W Mitra" value={row.prod_2w_mitra} target={row.target_2w_mitra} invertTarget />
              <ProdRow label="4W Mitra" value={row.prod_4w_mitra} target={row.target_4w_mitra} invertTarget />
            </div>
          </div>

          {/* Backlog Breakdown & Parcel Sweeper */}
          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <ScanLine className="h-4 w-4 text-rose-600" />
              Backlog, Expedite &amp; Parcel Sweeper
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <MetricRow label="Backlog Total" value={row.backlog_total} isManual={manualSet.has("backlog_total")} valueClass="text-red-700" />
              <MetricRow label="Backlog % vs Volume" value={row.backlog_pct} suffix="%" decimals={1} valueClass="text-rose-600" />
              <MetricRow label="Total Expedite" value={row.total_expedite} isManual={manualSet.has("total_expedite")} valueClass="text-orange-600" />
              <MetricRow label="Parcel Sweeper Total" value={row.parcel_sweeper_total} isManual={manualSet.has("parcel_sweeper_total")} />
              <MetricRow label="PS Scanned (%)" value={row.parcel_sweeper_scanned_pct} isManual={manualSet.has("parcel_sweeper_scanned_pct")} suffix="%" decimals={1} valueClass="text-blue-700" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 text-xs text-gray-500">
          <span>Tekan <kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-mono text-[10px]">Esc</kbd> atau klik di luar jendela untuk menutup</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
