"use client";

import { useState } from "react";
import { ClosingData, AnomalyField } from "@/types/closing";
import { detectAnomalies } from "@/lib/utils";
import { AlertTriangle, LayoutGrid, Table as TableIcon } from "lucide-react";

interface OcrRow extends Partial<ClosingData> {
  anomalies?: AnomalyField[];
}

interface Props {
  rows: OcrRow[];
  onUpdate: (i: number, field: keyof ClosingData, value: string) => void;
  previousData?: ClosingData | null;
  manualFields?: string[];
  fieldConfidence?: Record<string, number>;
}

const COLS: { key: keyof ClosingData; label: string; type: "text" | "number"; group: string }[] = [
  // In Hub Status
  { key: "in_hub_transported",    label: "Transported",        type: "number", group: "In Hub Status" },
  { key: "in_hub_received",       label: "Received",           type: "number", group: "In Hub Status" },
  { key: "in_hub_assigning",      label: "Assigning",          type: "number", group: "In Hub Status" },
  { key: "in_hub_assigned",       label: "Assigned",           type: "number", group: "In Hub Status" },
  // Fleet Status
  { key: "fleet_delivering",      label: "Delivering (Volume)", type: "number", group: "Fleet Status" },
  { key: "fleet_delivered",       label: "Delivered",          type: "number", group: "Fleet Status" },
  { key: "fleet_oh_volume",       label: "On-hold Volume",     type: "number", group: "Fleet Status" },
  { key: "fleet_oh_total",        label: "On-hold Total",      type: "number", group: "Fleet Status" },
  // Fleet Head Counts
  { key: "dedicated_actual_2wh",  label: "Dedicated 2WH",      type: "number", group: "Fleet Head Counts" },
  { key: "kurir_plus_actual_2wh", label: "Kurir Plus 2WH",     type: "number", group: "Fleet Head Counts" },
  { key: "dedicated_actual_4wh",  label: "Dedicated 4WH",      type: "number", group: "Fleet Head Counts" },
  { key: "mitra_actual_2wh",      label: "Mitra 2WH",          type: "number", group: "Fleet Head Counts" },
  { key: "mitra_actual_4wh",      label: "Mitra 4WH",          type: "number", group: "Fleet Head Counts" },
  // Backlog & Expedite
  { key: "backlog_total",              label: "Backlog",             type: "number", group: "Backlog & Expedite" },
  { key: "total_expedite",             label: "To Expedite",         type: "number", group: "Backlog & Expedite" },
  // Parcel Sweeper
  { key: "parcel_sweeper_total",       label: "Total",               type: "number", group: "Parcel Sweeper" },
  { key: "parcel_sweeper_scanned_pct", label: "Scanned (%)",         type: "number", group: "Parcel Sweeper" },
];

const GROUPS = [
  "In Hub Status",
  "Fleet Status",
  "Fleet Head Counts",
  "Backlog & Expedite",
  "Parcel Sweeper",
];

export function OcrPreviewTable({ rows, onUpdate, previousData, manualFields = [], fieldConfidence = {} }: Props) {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const row = rows[0] || {};
  const manualSet = new Set(manualFields);

  // Hitung catatan wajib real-time setiap kali user mengedit angka
  const liveAnomalies = detectAnomalies(row, previousData);

  const anomalyMap = new Map<keyof ClosingData, string>();
  for (const a of liveAnomalies) {
    if (!anomalyMap.has(a.field)) anomalyMap.set(a.field, a.reason);
  }

  return (
    <div className="space-y-4">
      {/* Banner catatan validasi (memblokir simpan jika masih ada) */}
      {liveAnomalies.length > 0 && (
        <div className="anomaly-banner bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800">
          <div className="flex items-center gap-2 font-semibold mb-1.5">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span>
              Terdapat {liveAnomalies.length} catatan yang wajib dilengkapi/diperbaiki sebelum bisa menyimpan data:
            </span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-red-700">
            {liveAnomalies.map((a, idx) => (
              <li key={idx}>{a.reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Toggle mode tampilan */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Klik pada kotak angka untuk mengoreksi hasil pembacaan.
        </p>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "cards" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Form Grup
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "table" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" /> Tabel
          </button>
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GROUPS.map((group) => {
            const groupCols = COLS.filter((c) => c.group === group);
            return (
              <div key={group} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 border-b border-gray-200 pb-2">
                  {group}
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {groupCols.map((col) => {
                    const val = row[col.key] as number | string | null | undefined;
                    const warn = anomalyMap.get(col.key);
                    const isEmpty = val === null || val === undefined || val === "";
                    const isManual = manualSet.has(col.key);
                    return (
                      <div key={col.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <label className="block text-xs font-medium text-gray-600 truncate" title={col.label}>
                            {col.label}
                          </label>
                          {fieldConfidence[col.key] != null && (
                            <span
                              className={`text-[10px] font-semibold ${
                                fieldConfidence[col.key] >= 80
                                  ? "text-green-600"
                                  : fieldConfidence[col.key] >= 60
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                              title="Keyakinan OCR field ini (hasil cocok-silang 2 bacaan)"
                            >
                              {Math.round(fieldConfidence[col.key])}%
                            </span>
                          )}
                          {isManual && (
                            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded">
                              Manual
                            </span>
                          )}
                        </div>
                        <input
                          type={col.type}
                          value={val == null ? "" : String(val)}
                          placeholder="0"
                          onChange={(e) => onUpdate(0, col.key, e.target.value)}
                          step={col.type === "number" ? "any" : undefined}
                          title={warn || (isManual ? "Angka ini diketik manual oleh user" : undefined)}
                          className={`w-full px-2.5 py-1.5 text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
                            warn
                              ? "border-amber-400 bg-amber-50/70 text-gray-900 focus:ring-amber-400"
                              : isEmpty
                              ? "border-gray-200 bg-white text-gray-700 focus:ring-blue-400"
                              : isManual
                              ? "border-purple-400 bg-purple-50/40 text-purple-950 focus:ring-purple-400"
                              : "border-green-300 bg-white text-gray-900 focus:ring-blue-400"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {c.group && <span className="text-gray-300 dark:text-slate-400 mr-1 font-normal">{c.group} /</span>}
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, ri) => (
                  <tr key={ri} className="bg-white hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-xs text-gray-400">{ri + 1}</td>
                    {COLS.map((col) => {
                      const val = r[col.key] as string | number | null | undefined;
                      const warn = anomalyMap.get(col.key);
                      return (
                        <td key={col.key} className="px-2 py-1.5">
                          <input
                            type={col.type}
                            value={val == null ? "" : String(val)}
                            placeholder=""
                            onChange={(e) => onUpdate(ri, col.key, e.target.value)}
                            step={col.type === "number" ? "any" : undefined}
                            title={warn || (fieldConfidence[col.key] != null ? `Keyakinan OCR: ${Math.round(fieldConfidence[col.key])}%` : undefined)}
                            className={`w-full min-w-[78px] px-2 py-1 text-sm rounded border focus:outline-none focus:ring-1 ${
                              warn
                                ? "border-amber-400 bg-amber-50 text-gray-900 focus:ring-amber-400"
                                : "border-gray-200 bg-white text-gray-700 focus:ring-blue-400"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
