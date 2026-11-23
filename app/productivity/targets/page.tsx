"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUserProfileDisplay } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Save,
  Target,
  AlertTriangle,
  CheckCircle,
  Anchor,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import { TargetAppeal } from "@/types/productivity";
import { parseTimestamp } from "@/lib/dateUtils";
import { format, startOfWeek, addWeeks } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  NauticalChartBackdrop,
  MaritimeTargetCompassIcon,
  SailorCompassIcon,
} from "@/components/productivity/MaritimeAnimations";

/** Format rentang Senin–Minggu agar mudah dibaca (mis. "9 – 15 Nov 2026" atau "26 Okt – 1 Nov 2026"). */
function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  if (monday.getFullYear() !== sunday.getFullYear()) {
    return `${format(monday, "d MMM yyyy", { locale: idLocale })} – ${format(sunday, "d MMM yyyy", { locale: idLocale })}`;
  }
  if (monday.getMonth() === sunday.getMonth()) {
    return `${format(monday, "d", { locale: idLocale })} – ${format(sunday, "d MMM yyyy", { locale: idLocale })}`;
  }
  return `${format(monday, "d MMM", { locale: idLocale })} – ${format(sunday, "d MMM yyyy", { locale: idLocale })}`;
}

function formatWeekRangeFromYMD(ymd: string): string {
  const m = new Date(`${ymd}T00:00:00`);
  return isNaN(m.getTime()) ? ymd : formatWeekRange(m);
}

function getWeekOptions(extraWeek?: string | null) {
  const weeks: { value: string; label: string }[] = [];
  const today = new Date();
  const thisMonday = startOfWeek(today, { weekStartsOn: 1 });
  for (let i = -24; i <= 4; i++) {
    const monday = addWeeks(thisMonday, i);
    const base = formatWeekRange(monday);
    const suffix = i === 0 ? " (Minggu ini)" : i === -1 ? " (Minggu lalu)" : "";
    weeks.push({
      value: format(monday, "yyyy-MM-dd"),
      label: `${base}${suffix}`,
    });
  }
  if (extraWeek && !weeks.some((w) => w.value === extraWeek)) {
    const m = new Date(extraWeek + "T00:00:00");
    if (!isNaN(m.getTime())) {
      weeks.push({
        value: extraWeek,
        label: formatWeekRange(m),
      });
    }
  }
  return weeks.reverse();
}

// Mapping fleet type sederhana
const FLEET_TYPES_TARGET = [
  { label: "Rider Dedicated",  contract: "Dedicated",  vehicle: "2WH" },
  { label: "Driver Dedicated", contract: "Dedicated",  vehicle: "4WH" },
  { label: "Rider Plus",       contract: "Kurir Plus", vehicle: "2WH" },
  { label: "Rider Mitra",      contract: "Mitra",      vehicle: "2WH" },
  { label: "Driver Mitra",     contract: "Mitra",      vehicle: "4WH" },
];

function AdjustTargetContent() {
  const { hubName, isReadOnlyAdmin } = useUserProfileDisplay();
  const searchParams = useSearchParams();
  const weekFromUrl = searchParams.get("week");

  const [appeals, setAppeals] = useState<TargetAppeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [weekStart,     setWeekStart]     = useState(
    weekFromUrl || format(startOfWeek(new Date(),{weekStartsOn:1}), "yyyy-MM-dd")
  );
  const [fleetTypeIdx,  setFleetTypeIdx]  = useState(0); // index ke FLEET_TYPES_TARGET
  const [targetValue,   setTargetValue]   = useState("");
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitStatus,  setSubmitStatus]  = useState<{type:"success"|"error"; msg:string}|null>(null);

  const selectedFleet = FLEET_TYPES_TARGET[fleetTypeIdx];

  const weekOptions = useMemo(() => getWeekOptions(weekFromUrl), [weekFromUrl]);

  useEffect(() => {
    if (weekFromUrl) setWeekStart(weekFromUrl);
  }, [weekFromUrl]);

  const fetchAppeals = async () => {
    setIsLoading(true);
    try {
      const res  = await fetch("/api/productivity/targets");
      const json = await res.json();
      if (json.success) setAppeals(json.appeals);
    } catch { toast.error("Gagal memuat data target."); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchAppeals(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weekStart || !targetValue) return;
    setIsSubmitting(true);
    setSubmitStatus(null);
    try {
      const res = await fetch("/api/productivity/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: weekStart,
          contract_type: selectedFleet.contract,
          vehicle_type: selectedFleet.vehicle,
          target: parseFloat(targetValue),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSubmitStatus({ type: "success", msg: "Target berhasil disimpan!" });
      setTargetValue("");
      await fetchAppeals();
    } catch (err) {
      setSubmitStatus({ type: "error", msg: err instanceof Error ? err.message : "Gagal" });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitStatus(null), 5000);
    }
  };

  const handleDelete = async (a: TargetAppeal) => {
    if (!confirm(`Hapus target ${a.contract_type} ${a.vehicle_type} minggu ${a.week_start}?`)) return;
    try {
      const res = await fetch("/api/productivity/targets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start:a.week_start, contract_type:a.contract_type, vehicle_type:a.vehicle_type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Target dihapus.");
      await fetchAppeals();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal"); }
  };

  const sortedAppeals = [...appeals]
    .filter((a) => a.week_start)
    .sort((a, b) => b.week_start.localeCompare(a.week_start));

  return (
    <div className="min-h-screen bg-[#e8eef5] dark:bg-transparent">
      <div className="w-full px-3 sm:px-6 py-4 space-y-5">
        {/* Maritime Captain's Brass Compass & Calibration Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#fffdf9] via-[#fdf9f3] to-[#f8efe3] dark:from-[#161c2c] dark:via-[#1c2334] dark:to-[#24212c] border border-slate-200/90 dark:border-slate-700/80 border-l-4 border-l-orange-500 dark:border-l-amber-400 text-slate-900 dark:text-white px-5 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.14)] dark:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.45)]">
          {/* Top metallic brass-gold horizon highlight */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-orange-500/75 via-amber-400/65 to-transparent" />
          <NauticalChartBackdrop variant="targets" />

          <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3.5">
              <MaritimeTargetCompassIcon />
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Adjust Target Produktivitas
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100/90 text-amber-800 border border-amber-300/70 dark:bg-amber-400/20 dark:text-amber-200 dark:border-amber-300/35">
                    Target Calibration
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5 flex-wrap font-medium">
                  <SailorCompassIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 flex-shrink-0" />
                  <span>Hub:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-300">{hubName}</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-slate-500 dark:text-slate-300">
                    Kalibrasi Target Appeal &amp; Haluan Kuota Fleet Mingguan
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 bg-amber-50/90 dark:bg-slate-800/80 backdrop-blur-xs border border-amber-300/70 dark:border-amber-400/35 rounded-xl px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200 shadow-2xs">
                <Anchor className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                <span>{sortedAppeals.length} Target Diset</span>
              </div>
              <Link
                href={`/productivity/weekly?week=${weekStart}`}
                className="inline-flex items-center gap-1.5 bg-white/90 hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 backdrop-blur-xs border border-slate-200/90 dark:border-slate-600/70 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-white transition-colors shadow-2xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-slate-500 dark:text-sky-200" />
                <span>Weekly KPI</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Form Kalibrasi Target (Hanya untuk user dengan hak tulis / Owner) */}
          {isReadOnlyAdmin ? (
            <div className="lg:col-span-5 bg-white/95 rounded-2xl border border-sky-200 dark:border-sky-500/35 border-t-[3px] border-t-sky-500 shadow-sm p-6 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center flex-shrink-0">
                  <Target className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-800">
                  Mode View Only ({hubName})
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Untuk Hub <strong>{hubName}</strong> Anda hanya memiliki akses <strong>View</strong> (tidak dapat menambah, mengubah, atau menghapus Target Produktivitas). Pindah ke Hub milik Anda sendiri lewat menu profil jika ingin mengubah target.
              </p>
            </div>
          ) : (
            <div className="lg:col-span-5 bg-white/95 rounded-2xl border border-slate-200/90 dark:border-slate-800 border-t-[3px] border-t-amber-500 dark:border-t-amber-400 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-amber-50/60 dark:from-slate-800/80 dark:to-amber-950/25 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100/90 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center ring-1 ring-amber-200/80 dark:ring-amber-700/40 flex-shrink-0">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-800">
                  Tambah / Update Target
                </h2>
                <p className="text-xs text-slate-500">
                  Atur target override fleet untuk minggu operasional
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Minggu</span>
                </label>
                <select
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-medium bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-colors"
                >
                  {weekOptions.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Tipe Fleet
                </label>
                <div className="flex flex-wrap gap-2">
                  {FLEET_TYPES_TARGET.map((ft, idx) => {
                    const isActive = fleetTypeIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFleetTypeIdx(idx)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? "bg-gradient-to-r from-[#0f2c59] to-[#1a4380] dark:from-blue-600 dark:to-sky-600 text-white shadow-sm border border-[#0f2c59] dark:border-blue-500"
                            : "bg-slate-100 text-slate-700 hover:bg-amber-100/60 border border-slate-200/80 dark:border-slate-700"
                        }`}
                      >
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 flex-shrink-0" />
                        )}
                        <span>{ft.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Target (delivered / shift)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    required
                    placeholder="Masukkan target (mis. 65)"
                    className="w-full pl-3.5 pr-24 py-2.5 text-sm font-semibold bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-colors tabular-nums"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[11px] font-semibold text-slate-400">
                    pkgs / shift
                  </span>
                </div>
              </div>

              {/* Ringkasan Fleet Terpilih */}
              <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Fleet Terpilih</span>
                <span className="font-bold text-slate-700">
                  {selectedFleet.contract} • {selectedFleet.vehicle}
                </span>
              </div>

              {submitStatus && (
                <div
                  className={`flex items-center gap-2 text-sm p-3 rounded-xl border ${
                    submitStatus.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:border-emerald-800/50"
                      : "bg-red-50 text-red-700 border-red-200/70 dark:border-red-800/50"
                  }`}
                >
                  {submitStatus.type === "success" ? (
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span>{submitStatus.msg}</span>
                </div>
              )}

              <Button
                type="submit"
                loading={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0f2c59] via-[#173f7a] to-[#1e4d8c] hover:from-[#0b2247] hover:to-[#163d73] dark:from-blue-600 dark:to-sky-600 dark:hover:from-blue-700 dark:hover:to-sky-700 shadow-md"
              >
                <Save className="h-4 w-4" /> Simpan Target
              </Button>
            </form>
            </div>
          )}

          {/* Tabel Target Tersimpan */}
          <div className="lg:col-span-7 bg-white/95 rounded-2xl border border-slate-200/90 dark:border-slate-800 border-t-[3px] border-t-[#134074] dark:border-t-sky-500 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-[#eef5ff] dark:from-slate-800/80 dark:to-sky-950/30 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-100/90 dark:bg-sky-900/40 text-[#134074] dark:text-sky-300 flex items-center justify-center ring-1 ring-sky-200/80 dark:ring-sky-700/40 flex-shrink-0">
                  <Anchor className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-800">
                    Target yang Sudah Diset — {hubName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Daftar target appeal mingguan yang berlaku untuk hub ini
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 dark:border-sky-700/50">
                {sortedAppeals.length} Record
              </span>
            </div>

            {isLoading ? (
              <div className="p-10 text-center text-slate-400 text-sm">
                Memuat daftar target...
              </div>
            ) : sortedAppeals.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
                  <Anchor className="h-5 w-5" />
                </div>
                <p className="text-slate-500 text-sm font-medium">
                  Belum ada target appeal yang diset.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#eff4fa] dark:bg-slate-800/85 border-b border-slate-200 dark:border-slate-700">
                      {[
                        "Minggu",
                        "Contract",
                        "Kendaraan",
                        "Target",
                        "Dibuat",
                        ...(!isReadOnlyAdmin ? ["Hapus"] : []),
                      ].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedAppeals.map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td
                          className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap"
                          title={a.week_start}
                        >
                          {formatWeekRangeFromYMD(a.week_start)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                              a.contract_type === "Dedicated"
                                ? "bg-blue-100 text-blue-700"
                                : a.contract_type.includes("Kurir")
                                ? "bg-purple-100 text-purple-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {a.contract_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                            {a.vehicle_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200/70 tabular-nums">
                            {a.target}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {a.created_at
                            ? parseTimestamp(a.created_at)?.toLocaleDateString("id-ID", {
                                timeZone: "Asia/Jakarta",
                              }) ?? a.created_at
                            : "-"}
                        </td>
                        {!isReadOnlyAdmin && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDelete(a)}
                              title="Hapus target"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdjustTargetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#e8eef5] dark:bg-transparent p-8 text-center text-slate-400">
          Loading...
        </div>
      }
    >
      <AdjustTargetContent />
    </Suspense>
  );
}
