"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CourierScheduleRow, CourierDailyDetail } from "@/types/productivity";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  User,
  TrendingUp,
  Package,
  CheckCircle2,
  Calendar,
  CalendarOff,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { format, addDays } from "date-fns";
import toast from "react-hot-toast";

interface Props {
  data: CourierScheduleRow[];
  isLoading?: boolean;
  weekStart?: string;
  weekLabel?: string;
  onLeaveChange?: () => void | Promise<void>;
}

type SortKey = keyof CourierScheduleRow;
type SortDir = "asc" | "desc" | null;

const DAYS = [
  { key: "sen", label: "Sen", fullName: "Senin" },
  { key: "sel", label: "Sel", fullName: "Selasa" },
  { key: "rab", label: "Rab", fullName: "Rabu" },
  { key: "kam", label: "Kam", fullName: "Kamis" },
  { key: "jum", label: "Jum", fullName: "Jumat" },
  { key: "sab", label: "Sab", fullName: "Sabtu" },
  { key: "min", label: "Min", fullName: "Minggu" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

interface LeaveModalTarget {
  courier: CourierScheduleRow;
  dayKey: DayKey;
  dayName: string;
  dateKey: string;
  dateLabel: string;
  isCurrentlyLeave: boolean;
}

function isRiderDedicatedRow(row: CourierScheduleRow): boolean {
  return row.contract_type === "Dedicated" && row.vehicle_type === "2WH";
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

function ProductivityBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-green-500" : pct >= 90 ? "bg-yellow-500" : "bg-red-500";
  const textColor = pct >= 100 ? "text-green-700" : pct >= 90 ? "text-yellow-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-semibold w-12 text-right ${textColor}`}>{pct}%</span>
    </div>
  );
}

function DayDots({
  activeDays,
  leaveDays,
  interactive,
  onDayClick,
}: {
  activeDays: CourierScheduleRow["activeDays"];
  leaveDays?: CourierScheduleRow["leaveDays"];
  interactive?: boolean;
  onDayClick?: (key: DayKey, idx: number, isLeave: boolean) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {DAYS.map(({ key, label, fullName }, idx) => {
        const isActive = activeDays[key];
        const isLeave = !isActive && Boolean(leaveDays?.[key]);
        const canClick = Boolean(interactive && onDayClick && !isActive);

        const colorClass = isActive
          ? "bg-green-500 text-white"
          : isLeave
          ? "bg-amber-400 text-amber-950 font-bold ring-1 ring-amber-500/70"
          : "bg-gray-100 text-gray-400";

        const interactiveClass = canClick
          ? isLeave
            ? "cursor-pointer hover:bg-amber-300 hover:scale-105 transition-all"
            : "cursor-pointer hover:bg-amber-200 hover:text-amber-900 dark:hover:bg-amber-500/35 dark:hover:text-amber-200 hover:scale-105 transition-all"
          : "";

        const title = isActive
          ? `${fullName} · Aktif`
          : isLeave
          ? canClick
            ? `${fullName} · Cuti (Klik untuk batalkan)`
            : `${fullName} · Cuti`
          : canClick
          ? `${fullName} · Off (Klik untuk tandai cuti)`
          : `${fullName} · Off`;

        if (canClick) {
          return (
            <button
              key={key}
              type="button"
              title={title}
              onClick={(e) => {
                e.stopPropagation();
                onDayClick?.(key, idx, isLeave);
              }}
              className={`w-5 h-5 rounded text-[10px] font-medium flex items-center justify-center ${colorClass} ${interactiveClass}`}
            >
              {label[0]}
            </button>
          );
        }

        return (
          <div
            key={key}
            title={title}
            className={`w-5 h-5 rounded text-[10px] font-medium flex items-center justify-center ${colorClass}`}
          >
            {label[0]}
          </div>
        );
      })}
    </div>
  );
}

export function CourierTable({ data, isLoading, weekStart, weekLabel, onLeaveChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("productivityPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedCourier, setSelectedCourier] = useState<CourierScheduleRow | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<LeaveModalTarget | null>(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (leaveTarget && !leaveSubmitting) {
          setLeaveTarget(null);
        } else if (selectedCourier) {
          setSelectedCourier(null);
        }
      }
    };
    if (selectedCourier || leaveTarget) {
      window.addEventListener("keydown", onKeyDown);
    }
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCourier, leaveTarget, leaveSubmitting]);

  const handleOpenLeaveModal = (
    courier: CourierScheduleRow,
    dayKey: DayKey,
    dayIdx: number,
    isCurrentlyLeave: boolean
  ) => {
    if (!weekStart) return;
    const baseMonday = new Date(`${weekStart}T00:00:00`);
    if (isNaN(baseMonday.getTime())) return;
    const targetDate = addDays(baseMonday, dayIdx);
    const dateKey = format(targetDate, "yyyy-MM-dd");
    const dateLabel = `${String(targetDate.getDate()).padStart(2, "0")} ${MONTHS_ID[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
    setLeaveTarget({
      courier,
      dayKey,
      dayName: DAYS[dayIdx].fullName,
      dateKey,
      dateLabel,
      isCurrentlyLeave,
    });
  };

  const handleConfirmLeave = async () => {
    if (!leaveTarget || leaveSubmitting) return;
    setLeaveSubmitting(true);
    try {
      const isRemove = leaveTarget.isCurrentlyLeave;
      const res = await fetch("/api/productivity/leave", {
        method: isRemove ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courier_id: leaveTarget.courier.courier_id,
          courier_name: leaveTarget.courier.courier_name,
          date: leaveTarget.dateKey,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memperbarui status cuti.");
      }
      toast.success(
        isRemove
          ? `Cuti ${leaveTarget.courier.courier_name} (${leaveTarget.dayName}, ${leaveTarget.dateLabel}) dibatalkan.`
          : `${leaveTarget.courier.courier_name} ditandai cuti (${leaveTarget.dayName}, ${leaveTarget.dateLabel}).`
      );
      setLeaveTarget(null);
      await onLeaveChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui status cuti.");
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(key); setSortDir(null); }
      else setSortDir("asc");
    } else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1; if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number")
      return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const totalDeliveredSum = data.reduce((s, r) => s + r.totalDelivered, 0);
  const totalShiftsSum = data.reduce((s, r) => s + r.shiftsCount, 0);
  const weightedTargetSum = data.reduce((s, r) => s + r.target * r.shiftsCount, 0);
  const overallAvgDaily =
    totalShiftsSum > 0 ? Math.round((totalDeliveredSum / totalShiftsSum) * 10) / 10 : 0;
  const overallTarget =
    totalShiftsSum > 0 ? Math.round((weightedTargetSum / totalShiftsSum) * 10) / 10 : 0;
  const overallProdPct =
    overallTarget > 0 ? Math.round((overallAvgDaily / overallTarget) * 1000) / 10 : 0;
  const combinedActiveDays: CourierScheduleRow["activeDays"] = {
    sen: data.some((r) => r.activeDays.sen),
    sel: data.some((r) => r.activeDays.sel),
    rab: data.some((r) => r.activeDays.rab),
    kam: data.some((r) => r.activeDays.kam),
    jum: data.some((r) => r.activeDays.jum),
    sab: data.some((r) => r.activeDays.sab),
    min: data.some((r) => r.activeDays.min),
  };

  const TH = ({ label, sortable, sk }: { label: string; sortable?: boolean; sk?: SortKey }) => (
    <th
      onClick={sortable && sk ? () => handleSort(sk) : undefined}
      className={`px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap ${
        sortable ? "cursor-pointer hover:bg-gray-100" : ""
      } text-left`}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {sortable && sk && <SortIcon active={sortKey === sk} dir={sortDir} />}
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {["Kurir","Zone","Contract","Vehicle","Produktivitas","Target","Total Deliv","Productivity","Aktif","Shift"].map((h,i)=>(
                <th key={i} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {Array.from({length:5}).map((_,i)=>(
                <tr key={i} className="border-b border-gray-100">
                  {Array.from({length:10}).map((_,j)=>(
                    <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 animate-pulse rounded w-16"/></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-200 p-12 text-center bg-white">
        <p className="text-gray-400 text-sm">Belum ada data untuk periode ini.</p>
        <p className="text-gray-300 text-xs mt-1">Input data kurir di menu Input Data.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <TH label="Kurir"        sortable sk="courier_name" />
              <TH label="Zone"         sortable sk="zone_id" />
              <TH label="Contract"     sortable sk="contract_type" />
              <TH label="Kendaraan"    sortable sk="vehicle_type" />
              <TH label="Produktivitas vs Target" sortable sk="productivityPct" />
              <TH label="Target"       sortable sk="target" />
              <TH label="Total Deliv"  sortable sk="totalDelivered" />
              <TH label="Productivity" sortable sk="avgDaily" />
              <TH label="Hari Aktif"   sortable sk="shiftsCount" />
              <TH label="Shift"        sortable sk="shiftsCount" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row) => (
              <tr key={row.courier_id} className="hover:bg-gray-50 transition-colors">
                <td
                  className="px-3 py-2.5 cursor-pointer hover:bg-blue-50/50 transition-colors group"
                  onClick={() => setSelectedCourier(row)}
                  title={`Klik untuk melihat rincian produktivitas ${row.courier_name}`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-blue-600 group-hover:text-blue-700 group-hover:underline text-sm inline-flex items-center gap-1.5 transition-colors">
                        <span>{row.courier_name}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-blue-500 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </span>
                      {row.isNewCourier && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200"
                          title={`Kurir Baru bergabung ${row.firstJoinDate || ""} (Hari ke-${row.daysSinceJoin || 1}). Selama 14 hari tidak dihitung ke skor rata-rata Hub saat filter aktif.`}
                        >
                          Kurir Baru (H-{row.daysSinceJoin || 1})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 mt-0.5">{row.courier_id}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-gray-600 text-sm whitespace-nowrap">{row.zone_id || "-"}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    row.contract_type === "Dedicated" ? "bg-blue-100 text-blue-700"
                    : row.contract_type.includes("Kurir Plus") ? "bg-purple-100 text-purple-700"
                    : "bg-orange-100 text-orange-700"
                  }`}>
                    {row.contract_type}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-gray-600 text-sm">{row.vehicle_type}</td>
                <td className="px-3 py-2.5"><ProductivityBar pct={row.productivityPct} /></td>
                <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap tabular-nums">
                  {row.target}
                </td>
                <td className="px-3 py-2.5 font-medium text-gray-900 tabular-nums">
                  {row.totalDelivered.toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-2.5 font-semibold text-gray-900 tabular-nums">
                  {row.shiftsCount > 0 ? (row.totalDelivered / row.shiftsCount).toFixed(1) : "-"}
                </td>
                <td className="px-3 py-2.5">
                  <DayDots
                    activeDays={row.activeDays}
                    leaveDays={row.leaveDays}
                    interactive={Boolean(weekStart && isRiderDedicatedRow(row))}
                    onDayClick={(dayKey, dayIdx, isLeave) =>
                      handleOpenLeaveModal(row, dayKey, dayIdx, isLeave)
                    }
                  />
                </td>
                <td className="px-3 py-2.5 text-center text-gray-600 text-sm">{row.shiftsCount}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-900">
              <td className="px-3 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-extrabold text-gray-900">
                    TOTAL / RATA-RATA
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
                    {data.length} kurir
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 text-gray-400 text-sm">-</td>
              <td className="px-3 py-3 text-gray-400 text-sm">-</td>
              <td className="px-3 py-3 text-gray-400 text-sm">-</td>
              <td className="px-3 py-3">
                <ProductivityBar pct={overallProdPct} />
              </td>
              <td className="px-3 py-3 text-sm font-bold text-gray-700 whitespace-nowrap tabular-nums">
                {overallTarget}
              </td>
              <td className="px-3 py-3 font-extrabold text-blue-600 tabular-nums">
                {totalDeliveredSum.toLocaleString("id-ID")}
              </td>
              <td className="px-3 py-3 font-extrabold text-gray-900 tabular-nums">
                {totalShiftsSum > 0 ? (totalDeliveredSum / totalShiftsSum).toFixed(1) : "-"}
              </td>
              <td className="px-3 py-3">
                <DayDots activeDays={combinedActiveDays} />
              </td>
              <td className="px-3 py-3 text-center font-extrabold text-gray-900 text-sm tabular-nums">
                {totalShiftsSum.toLocaleString("id-ID")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between flex-wrap gap-2">
        <span>{data.length} kurir · Sorted by produktivitas</span>
        <span className="text-gray-400">
          💡 Klik nama kurir untuk detail · Klik hari abu pada Rider Dedicated untuk tandai cuti
        </span>
      </div>

      {/* Modal Detail Produktivitas Kurir */}
      {selectedCourier && (
        <CourierDetailModal
          courier={selectedCourier}
          weekStart={weekStart}
          weekLabel={weekLabel}
          onClose={() => setSelectedCourier(null)}
        />
      )}

      {/* Modal Pop-up Tandai / Batalkan Cuti */}
      {leaveTarget && (
        <LeaveConfirmModal
          target={leaveTarget}
          isSubmitting={leaveSubmitting}
          onConfirm={handleConfirmLeave}
          onClose={() => {
            if (!leaveSubmitting) setLeaveTarget(null);
          }}
        />
      )}
    </div>
  );
}

function CourierDetailModal({
  courier,
  weekStart,
  weekLabel,
  onClose,
}: {
  courier: CourierScheduleRow;
  weekStart?: string;
  weekLabel?: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Lock scroll on background body
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const detailsByDay = new Map<string, CourierDailyDetail>();
  for (const d of courier.dailyDetails || []) {
    detailsByDay.set(d.dayKey, d);
  }

  const mondayDate = weekStart ? new Date(weekStart + "T00:00:00") : null;

  const fullWeekRows = DAYS.map((day, idx) => {
    const detail = detailsByDay.get(day.key);
    const dateObj =
      mondayDate && !isNaN(mondayDate.getTime()) ? addDays(mondayDate, idx) : null;
    const dateLabel = detail?.dateLabel || (dateObj ? format(dateObj, "dd MMM yyyy") : "-");
    const isLeave = !detail && Boolean(courier.leaveDays?.[day.key]);
    return {
      dayKey: day.key,
      dayShort: day.label,
      dayName: day.fullName,
      dateLabel,
      active: Boolean(detail),
      isLeave,
      detail: detail || null,
    };
  });
  const leaveCount = fullWeekRows.filter((r) => r.isLeave).length;

  const maxDailyDeliv = Math.max(
    courier.target || 1,
    ...fullWeekRows.map((r) => r.detail?.delivered || 0),
    1
  );

  const isMitra = courier.contract_type === "Mitra";
  const isTargetGood = isMitra
    ? courier.avgDaily <= courier.target
    : courier.productivityPct >= 100;

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  {courier.courier_name}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    courier.contract_type === "Dedicated"
                      ? "bg-blue-100 text-blue-700"
                      : courier.contract_type.includes("Kurir Plus")
                      ? "bg-purple-100 text-purple-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {courier.contract_type}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                  {courier.vehicle_type}
                </span>
                {courier.isNewCourier && (
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-800 border border-teal-300 flex items-center gap-1"
                    title={`Bergabung ${courier.firstJoinDate || ""} (Hari ke-${courier.daysSinceJoin || 1} dari masa Grace Period 14 hari)`}
                  >
                    🌱 Kurir Baru (Hari ke-{courier.daysSinceJoin || 1})
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>ID: <strong className="text-gray-700">{courier.courier_id}</strong></span>
                <span>·</span>
                <span>Zone: <strong className="text-gray-700">{courier.zone_id || "-"}</strong></span>
                {weekLabel && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                      <Calendar className="h-3 w-3" />
                      {weekLabel}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            title="Tutup (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Avg Productivity */}
            <div className="rounded-xl border border-gray-200 p-3.5 bg-white">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold uppercase tracking-wider">Avg / Shift</span>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xl font-extrabold text-gray-900 mt-1">
                {courier.avgDaily}
                <span className="text-xs font-normal text-gray-400 ml-1">/ {courier.target}</span>
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${isTargetGood ? "text-green-600" : "text-red-600"}`}>
                {courier.productivityPct}% dari target
              </p>
            </div>

            {/* Total Delivered */}
            <div className="rounded-xl border border-gray-200 p-3.5 bg-white">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold uppercase tracking-wider">Total Deliv</span>
                <Package className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xl font-extrabold text-gray-900 mt-1">
                {courier.totalDelivered.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Handed Over: {courier.totalHandedOver.toLocaleString("id-ID")}
              </p>
            </div>

            {/* Success Rate */}
            <div className="rounded-xl border border-gray-200 p-3.5 bg-white">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold uppercase tracking-wider">Success Rate</span>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <p className={`text-xl font-extrabold mt-1 ${
                courier.successRate >= 95 ? "text-green-600" : courier.successRate >= 90 ? "text-yellow-600" : "text-red-600"
              }`}>
                {courier.successRate}%
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {courier.totalFailed || 0} failed · {courier.totalOnhold || 0} onhold
              </p>
            </div>

            {/* Shifts / Hari Aktif */}
            <div className="rounded-xl border border-gray-200 p-3.5 bg-white">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold uppercase tracking-wider">Hari Aktif</span>
                <Calendar className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-xl font-extrabold text-gray-900 mt-1">
                {courier.shiftsCount}
                <span className="text-xs font-normal text-gray-400 ml-1">/ 7 hari</span>
                {leaveCount > 0 && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-amber-950 align-middle">
                    +{leaveCount} cuti
                  </span>
                )}
              </p>
              <div className="mt-1.5">
                <DayDots activeDays={courier.activeDays} leaveDays={courier.leaveDays} />
              </div>
            </div>
          </div>

          {/* Visual 7-Day Bar Chart */}
          <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Grafik Pengiriman Harian (Senin – Minggu)
              </h3>
              <span className="text-xs text-gray-500">
                Target Harian: <strong className="text-gray-800">{courier.target}</strong> paket
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2 items-end h-32 pt-4">
              {fullWeekRows.map((r) => {
                const deliv = r.detail?.delivered || 0;
                const heightPct = r.active ? Math.max(10, Math.round((deliv / maxDailyDeliv) * 100)) : 0;
                const hitTarget = isMitra ? deliv <= courier.target : deliv >= courier.target;
                return (
                  <div key={r.dayKey} className="flex flex-col items-center h-full justify-end">
                    <span className="text-[11px] font-bold text-gray-700 mb-1">
                      {r.active ? deliv : "-"}
                    </span>
                    <div className="w-full max-w-[38px] bg-gray-200 rounded-t-md h-20 flex items-end overflow-hidden">
                      {r.active && (
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            hitTarget ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-gray-600 mt-1.5">
                      {r.dayShort}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Breakdown Table */}
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Rincian Produktivitas Harian
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                    <th className="px-3 py-2.5 text-left">Hari & Tanggal</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-left">Zone</th>
                    <th className="px-3 py-2.5 text-right">Assigned</th>
                    <th className="px-3 py-2.5 text-right">Handed Over</th>
                    <th className="px-3 py-2.5 text-right">Delivered</th>
                    <th className="px-3 py-2.5 text-right">Failed</th>
                    <th className="px-3 py-2.5 text-right">OnHold</th>
                    <th className="px-3 py-2.5 text-right">Success %</th>
                    <th className="px-3 py-2.5 text-left">Prod vs Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fullWeekRows.map((r) => {
                    const d = r.detail;
                    return (
                      <tr key={r.dayKey} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-semibold text-gray-900">{r.dayName}</span>
                          <span className="text-xs text-gray-400 ml-1.5">{r.dateLabel}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {r.active ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Aktif
                            </span>
                          ) : r.isLeave ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-amber-950">
                              Cuti
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-400">
                              Off
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {d ? d.zone_id : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-700">
                          {d ? d.assigned.toLocaleString("id-ID") : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-700">
                          {d ? d.handed_over.toLocaleString("id-ID") : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                          {d ? d.delivered.toLocaleString("id-ID") : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-red-600">
                          {d ? d.failed_delivery.toLocaleString("id-ID") : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-amber-600">
                          {d ? d.onhold.toLocaleString("id-ID") : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {d ? (
                            <span className={`font-semibold ${
                              d.successRate >= 95 ? "text-green-600" : d.successRate >= 90 ? "text-yellow-600" : "text-red-600"
                            }`}>
                              {d.successRate}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {d ? (
                            <ProductivityBar pct={d.productivityPct} />
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-900 text-xs">
                    <td className="px-3 py-2.5">TOTAL / RATA-RATA</td>
                    <td className="px-3 py-2.5 text-center">{courier.shiftsCount} Shift</td>
                    <td className="px-3 py-2.5">{courier.zone_id || "-"}</td>
                    <td className="px-3 py-2.5 text-right">
                      {(courier.totalAssigned || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {courier.totalHandedOver.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-blue-600">
                      {courier.totalDelivered.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-red-600">
                      {(courier.totalFailed || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-600">
                      {(courier.totalOnhold || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-green-600">
                      {courier.successRate}%
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-gray-800">
                        {courier.avgDaily} / {courier.target} ({courier.productivityPct}%)
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function LeaveConfirmModal({
  target,
  isSubmitting,
  onConfirm,
  onClose,
}: {
  target: LeaveModalTarget;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!mounted) return null;

  const isCancelMode = target.isCurrentlyLeave;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden animate-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isCancelMode ? "bg-rose-100 text-rose-600" : "bg-amber-400/30 text-amber-700 dark:text-amber-300"
              }`}
            >
              {isCancelMode ? (
                <CalendarOff className="h-4.5 w-4.5" />
              ) : (
                <Calendar className="h-4.5 w-4.5" />
              )}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900">
                {isCancelMode ? "Batalkan Status Cuti" : "Tandai Cuti Kurir"}
              </h3>
              <p className="text-xs text-gray-500">Rider Dedicated (2WH)</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">Kurir</span>
              <span className="font-bold text-gray-900 text-right">{target.courier.courier_name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">ID Kurir</span>
              <span className="text-xs font-mono text-gray-700">{target.courier.courier_id}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">Hari &amp; Tanggal</span>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {target.dayName}, {target.dateLabel}
              </span>
            </div>
          </div>

          {isCancelMode ? (
            <p className="text-xs text-gray-600 leading-relaxed">
              Apakah Anda yakin ingin membatalkan status cuti pada tanggal ini? Kotak hari akan kembali menjadi{" "}
              <strong className="text-gray-800">abu-abu (Off)</strong> dan tidak lagi dihitung sebagai masuk pada{" "}
              <strong className="text-gray-800">Daily Active Rate</strong>.
            </p>
          ) : (
            <p className="text-xs text-gray-600 leading-relaxed">
              Kurir yang ditandai cuti akan berubah menjadi <strong className="text-amber-700 dark:text-amber-300">kuning</strong> dan dihitung{" "}
              <strong className="text-gray-800">masuk</strong> pada perhitungan <strong className="text-gray-800">Daily Active Rate</strong>, namun{" "}
              <strong className="text-gray-800">tidak mempengaruhi</strong> perhitungan Productivity (weekly maupun monthly).
            </p>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 cursor-pointer ${
              isCancelMode
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-amber-400 hover:bg-amber-300 text-amber-950"
            }`}
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isCancelMode ? "Batalkan Cuti" : "Tandai Cuti"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
