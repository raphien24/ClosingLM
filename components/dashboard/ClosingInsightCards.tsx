"use client";

import { ClosingData } from "@/types/closing";
import { formatNumber } from "@/lib/utils";
import {
  AlertCircle,
  Truck,
  ArchiveX,
  Zap,
  PauseCircle,
  CheckCircle2,
} from "lucide-react";

interface Props {
  data: ClosingData[];
  isLoading?: boolean;
}

const REQUIRED_CLOSING_KEYS: (keyof ClosingData)[] = [
  "in_hub_transported",
  "in_hub_received",
  "in_hub_assigning",
  "in_hub_assigned",
  "fleet_delivering",
  "fleet_delivered",
  "fleet_oh_volume",
  "fleet_oh_total",
  "dedicated_actual_2wh",
  "kurir_plus_actual_2wh",
  "dedicated_actual_4wh",
  "mitra_actual_2wh",
  "mitra_actual_4wh",
  "backlog_total",
  "total_expedite",
  "parcel_sweeper_total",
  "parcel_sweeper_scanned_pct",
];

export function ClosingInsightCards({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-56 bg-white rounded-2xl border border-slate-200/80 p-4 animate-pulse"
          >
            <div className="h-4 w-36 bg-slate-200 rounded mb-3" />
            <div className="space-y-2">
              <div className="h-6 bg-slate-100 rounded" />
              <div className="h-6 bg-slate-100 rounded" />
              <div className="h-6 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 1. Hub yang belum mengisi report (belum submit ATAU masih ada kolom kosong)
  const incompleteHubs = data
    .map((row) => {
      if (!row.submitted_at) {
        return {
          nama_hub: row.nama_hub,
          emptyCount: REQUIRED_CLOSING_KEYS.length,
          isNotSubmitted: true,
        };
      }
      const emptyCols = REQUIRED_CLOSING_KEYS.filter(
        (k) => row[k] === null || row[k] === undefined
      );
      return {
        nama_hub: row.nama_hub,
        emptyCount: emptyCols.length,
        isNotSubmitted: false,
      };
    })
    .filter((item) => item.isNotSubmitted || item.emptyCount > 0);

  // 2. Hub dengan delivering belum clear (fleet_delivering > 0)
  const unclearedDelivering = data
    .filter((r) => (r.fleet_delivering ?? 0) > 0)
    .sort((a, b) => (b.fleet_delivering ?? 0) - (a.fleet_delivering ?? 0));

  // 3. TOP 5 Backlog paling tinggi (% Backlog terhadap Total Volume)
  const top5Backlog = data
    .filter((r) => (r.backlog_total ?? 0) > 0)
    .map((r) => {
      const totalVol = r.total_volume ?? 0;
      const backlog = r.backlog_total ?? 0;
      const pct = totalVol > 0 ? (backlog / totalVol) * 100 : 0;
      return {
        nama_hub: r.nama_hub,
        backlog,
        totalVol,
        pct: Math.round(pct * 10) / 10,
      };
    })
    .sort((a, b) => b.pct - a.pct || b.backlog - a.backlog)
    .slice(0, 5);

  // 4. TOP 5 Expedite (% Expedite dibanding Total Volume + tampilkan Total Expedite)
  const top5Expedite = data
    .filter((r) => (r.total_expedite ?? 0) > 0)
    .map((r) => {
      const totalVol = r.total_volume ?? 0;
      const expedite = r.total_expedite ?? 0;
      const pct = totalVol > 0 ? (expedite / totalVol) * 100 : 0;
      return {
        nama_hub: r.nama_hub,
        expedite,
        totalVol,
        pct: Math.round(pct * 10) / 10,
      };
    })
    .sort((a, b) => b.pct - a.pct || b.expedite - a.expedite)
    .slice(0, 5);

  // 5. Daftar Hub yang masih ada Gantungan Onhold (fleet_oh_volume > 0)
  const onholdHubs = data
    .filter((r) => (r.fleet_oh_volume ?? 0) > 0)
    .sort((a, b) => (b.fleet_oh_volume ?? 0) - (a.fleet_oh_volume ?? 0));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
      {/* Card 1: Hub Belum Mengisi Report */}
      <div className="hover-lift bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              Hub Belum Mengisi Report
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Belum submit / masih ada kolom kosong
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              incompleteHubs.length > 0
                ? "bg-rose-100 text-rose-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {incompleteHubs.length} Hub
          </span>
        </div>

        <div className="mt-3 flex-1 max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {incompleteHubs.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-center text-emerald-600 gap-1">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-xs font-semibold">
                Semua Hub Sudah Lengkap!
              </span>
            </div>
          ) : (
            incompleteHubs.map((h) => (
              <div
                key={h.nama_hub}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-rose-50/70 border border-rose-100 text-xs"
              >
                <span className="font-semibold text-slate-800 truncate">
                  {h.nama_hub}
                </span>
                <span className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">
                  {h.isNotSubmitted
                    ? "Belum Submit"
                    : `${h.emptyCount} Kolom Kosong`}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Card 2: Hub dengan Delivering Belum Clear */}
      <div className="hover-lift bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              Delivering Belum Clear
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Hub dengan kolom Delivering &gt; 0
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                unclearedDelivering.length > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {unclearedDelivering.length} Hub
            </span>
            <Truck className="h-4 w-4 text-amber-500" />
          </div>
        </div>

        <div className="mt-3 flex-1 max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {unclearedDelivering.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-center text-emerald-600 gap-1">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-xs font-semibold">
                Semua Delivering Sudah Clear (0)!
              </span>
            </div>
          ) : (
            unclearedDelivering.map((r) => (
              <div
                key={r.nama_hub}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-amber-50/70 border border-amber-100 text-xs"
              >
                <span className="font-semibold text-slate-800 truncate">
                  {r.nama_hub}
                </span>
                <span className="flex-shrink-0 font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  {formatNumber(r.fleet_delivering)} paket
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Card 3: TOP 5 Backlog Paling Tinggi */}
      <div className="hover-lift bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              TOP 5 Backlog Tertinggi
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              % Backlog terhadap Total Volume
            </p>
          </div>
          <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
            <ArchiveX className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex-1 space-y-1.5">
          {top5Backlog.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-center text-emerald-600 gap-1">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-xs font-semibold">
                Tidak Ada Backlog (0)!
              </span>
            </div>
          ) : (
            top5Backlog.map((item, idx) => (
              <div
                key={item.nama_hub}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${
                      idx === 0
                        ? "bg-rose-600 text-white"
                        : idx === 1
                        ? "bg-rose-500 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-800 truncate">
                    {item.nama_hub}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-slate-600 font-bold">
                    {formatNumber(item.backlog)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold text-[11px]">
                    {item.pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Card 4: TOP 5 Expedite */}
      <div className="hover-lift bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              TOP 5 Expedite Tertinggi
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              % Expedite terhadap Total Volume
            </p>
          </div>
          <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
            <Zap className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex-1 space-y-1.5">
          {top5Expedite.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-center text-emerald-600 gap-1">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-xs font-semibold">
                Tidak Ada Expedite (0)!
              </span>
            </div>
          ) : (
            top5Expedite.map((item, idx) => (
              <div
                key={item.nama_hub}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${
                      idx === 0
                        ? "bg-orange-600 text-white"
                        : idx === 1
                        ? "bg-orange-500 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-800 truncate">
                    {item.nama_hub}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-slate-600 font-bold">
                    {formatNumber(item.expedite)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-extrabold text-[11px]">
                    {item.pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Card 5: Daftar Hub Masih Ada Gantungan Onhold */}
      <div className="hover-lift bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              Gantungan On-Hold
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Hub dengan On-hold Volume &gt; 0
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                onholdHubs.length > 0
                  ? "bg-purple-100 text-purple-800"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {onholdHubs.length} Hub
            </span>
            <PauseCircle className="h-4 w-4 text-purple-600" />
          </div>
        </div>

        <div className="mt-3 flex-1 max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {onholdHubs.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-center text-emerald-600 gap-1">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-xs font-semibold">
                Tidak Ada Gantungan On-hold (0)!
              </span>
            </div>
          ) : (
            onholdHubs.map((r) => (
              <div
                key={r.nama_hub}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-purple-50/70 border border-purple-100 text-xs"
              >
                <span className="font-semibold text-slate-800 truncate">
                  {r.nama_hub}
                </span>
                <span className="flex-shrink-0 font-extrabold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md">
                  {formatNumber(r.fleet_oh_volume)} vol
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
