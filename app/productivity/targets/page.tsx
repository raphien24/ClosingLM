"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Trash2, Save, Target, AlertTriangle, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { TargetAppeal } from "@/types/productivity";
import { parseTimestamp } from "@/lib/dateUtils";
import { format, startOfWeek, addWeeks } from "date-fns";
import { id as idLocale } from "date-fns/locale";

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
  const { hubName } = useAuth();
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
    <div className="w-full px-3 sm:px-6 py-5 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
          <Target className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Adjust Target Produktivitas</h1>
          <p className="text-sm text-gray-500">Hub: <span className="font-medium text-orange-600">{hubName}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Tambah / Update Target</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Minggu</label>
              <select value={weekStart} onChange={(e)=>setWeekStart(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400">
                {weekOptions.map((w)=>(
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Tipe Fleet</label>
              <div className="flex flex-wrap gap-1.5">
                {FLEET_TYPES_TARGET.map((ft, idx) => (
                  <button key={idx} type="button" onClick={() => setFleetTypeIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      fleetTypeIdx === idx
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {ft.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Target (delivered / shift)
              </label>
              <input type="number" step="0.01" min="1" value={targetValue}
                onChange={(e)=>setTargetValue(e.target.value)} required
                placeholder="Masukkan target (mis. 65)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>

            {submitStatus && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
                submitStatus.type==="success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {submitStatus.type==="success" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {submitStatus.msg}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full">
              <Save className="h-4 w-4" /> Simpan Target
            </Button>
          </form>
        </div>

        {/* Existing appeals */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Target yang Sudah Diset — {hubName}</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Memuat...</div>
          ) : sortedAppeals.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Belum ada target appeal yang diset.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Minggu","Contract","Kendaraan","Target","Dibuat","Hapus"].map((h)=>(
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedAppeals.map((a, i)=>(
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap" title={a.week_start}>
                        {formatWeekRangeFromYMD(a.week_start)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          a.contract_type==="Dedicated" ? "bg-blue-100 text-blue-700"
                          : a.contract_type.includes("Kurir") ? "bg-purple-100 text-purple-700"
                          : "bg-orange-100 text-orange-700"
                        }`}>{a.contract_type}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{a.vehicle_type}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{a.target}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">
                        {a.created_at
                          ? (parseTimestamp(a.created_at)?.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) ?? a.created_at)
                          : "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={()=>handleDelete(a)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdjustTargetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <AdjustTargetContent />
    </Suspense>
  );
}
