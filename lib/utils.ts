import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ClosingData, AnomalyField, ClosingRowWithAnomalies } from "@/types/closing";
import { format } from "date-fns";
import { normalizeToYMD } from "./dateUtils";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  if (!date) return "-";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [y, m, d] = date.trim().split("-");
    return `${d}/${m}/${y}`;
  }
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return format(d, "dd/MM/yyyy");
}

export function formatDateISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}%`;
}

// ── Validasi anomali & cross-validation bisnis ───────────────
export function detectAnomalies(
  row: Partial<ClosingData>,
  previousData?: ClosingData | null
): AnomalyField[] {
  const anomalies: AnomalyField[] = [];

  if (!row.nama_hub?.trim())
    anomalies.push({ field: "nama_hub", reason: "Nama hub kosong" });

  // Semua 17 field angka wajib diisi (tidak boleh kosong / null)
  const requiredFields: { key: keyof ClosingData; label: string }[] = [
    { key: "in_hub_transported",          label: "Transported" },
    { key: "in_hub_received",             label: "Received" },
    { key: "in_hub_assigning",            label: "Assigning" },
    { key: "in_hub_assigned",             label: "Assigned" },
    { key: "fleet_delivering",            label: "Delivering (Volume)" },
    { key: "fleet_delivered",             label: "Delivered" },
    { key: "fleet_oh_volume",             label: "On-hold Volume" },
    { key: "fleet_oh_total",              label: "On-hold Total" },
    { key: "dedicated_actual_2wh",        label: "Dedicated 2WH" },
    { key: "kurir_plus_actual_2wh",       label: "Kurir Plus 2WH" },
    { key: "dedicated_actual_4wh",        label: "Dedicated 4WH" },
    { key: "mitra_actual_2wh",            label: "Mitra 2WH" },
    { key: "mitra_actual_4wh",            label: "Mitra 4WH" },
    { key: "backlog_total",               label: "Backlog" },
    { key: "total_expedite",              label: "To Expedite" },
    { key: "parcel_sweeper_total",        label: "Parcel Sweeper Total" },
    { key: "parcel_sweeper_scanned_pct",  label: "Parcel Sweeper Scanned (%)" },
  ];
  for (const rf of requiredFields) {
    const val = row[rf.key];
    if (val === null || val === undefined || (typeof val === "number" && isNaN(val))) {
      anomalies.push({ field: rf.key, reason: `${rf.label} belum terisi` });
    }
  }

  // Non-negatif
  for (const rf of requiredFields) {
    const v = row[rf.key] as number | null | undefined;
    if (v !== null && v !== undefined && v < 0)
      anomalies.push({ field: rf.key, reason: `${rf.label} tidak boleh negatif (${v})` });
  }

  // Persentase Parcel Sweeper harus 0 - 100%
  if (
    row.parcel_sweeper_scanned_pct != null &&
    row.parcel_sweeper_scanned_pct > 100
  ) {
    anomalies.push({
      field: "parcel_sweeper_scanned_pct",
      reason: `Parcel Sweeper Scanned (%) tidak boleh lebih dari 100% (${row.parcel_sweeper_scanned_pct}%)`,
    });
  }

  // Cross-check 1: On-hold Volume <= On-hold Total
  if (
    row.fleet_oh_volume != null &&
    row.fleet_oh_total != null &&
    row.fleet_oh_volume > row.fleet_oh_total
  ) {
    anomalies.push({
      field: "fleet_oh_volume",
      reason: `OH Volume (${row.fleet_oh_volume}) > OH Total (${row.fleet_oh_total}) — kolom tertukar?`,
    });
  }

  return anomalies;
}

export function addAnomaliesToRows(
  rows: Partial<ClosingData>[]
): ClosingRowWithAnomalies[] {
  return rows.map((row) => ({ ...row, anomalies: detectAnomalies(row) }));
}

// ── Konversi ClosingData ↔ Sheets row ───────────────────────
// Urutan WAJIB sama persis dengan header DATA_CLOSING (27 kolom)
export function closingDataToRow(
  data: ClosingData,
  submittedAt: string,
  submittedBy: string
): (string | number | null)[] {
  return [
    normalizeToYMD(data.tanggal),             // [0]
    data.nama_hub,                            // [1]
    data.in_hub_transported         ?? "",    // [2]
    data.in_hub_received            ?? "",    // [3]
    data.in_hub_assigning           ?? "",    // [4]
    data.in_hub_assigned            ?? "",    // [5]
    data.fleet_delivering           ?? "",    // [6]
    data.fleet_delivered            ?? "",    // [7]
    data.fleet_oh_volume            ?? "",    // [8]
    data.fleet_oh_total             ?? "",    // [9]
    data.dedicated_actual_2wh       ?? "",    // [10]
    data.kurir_plus_actual_2wh      ?? "",    // [11]
    data.dedicated_actual_4wh       ?? "",    // [12]
    data.mitra_actual_2wh           ?? "",    // [13]
    data.mitra_actual_4wh           ?? "",    // [14]
    data.backlog_total              ?? "",    // [15]
    data.backlog_to_buyer           ?? "",    // [16]
    data.backlog_to_seller          ?? "",    // [17]
    data.backlog_to_transfer        ?? "",    // [18]
    data.expedite                   ?? "",    // [19]
    data.super_expedite             ?? "",    // [20]
    data.total_expedite             ?? "",    // [21]
    submittedAt,                              // [22]
    submittedBy,                              // [23]
    data.parcel_sweeper_total       ?? "",    // [24]
    data.parcel_sweeper_scanned_pct ?? "",    // [25]
    (data.manual_fields || []).join(","),     // [26]
  ];
}

/**
 * Parse angka dari nilai cell Sheets (UNFORMATTED_VALUE ataupun legacy string)
 */
export function parseSheetNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  const s = String(v).trim();
  if (!s || s === "-") return null;
  // Jika sudah angka murni (hasil UNFORMATTED_VALUE)
  const direct = Number(s);
  if (!isNaN(direct)) return direct;
  // Fallback untuk string terformat lama
  let clean = s.replace(/[%\s]/g, "");
  if (clean.includes(".") && clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    const parts = clean.split(",");
    clean = parts[1]?.length <= 2 ? clean.replace(",", ".") : clean.replace(/,/g, "");
  } else if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts[1]?.length === 3) clean = clean.replace(/\./g, "");
  }
  const f = parseFloat(clean);
  return isNaN(f) ? null : f;
}

export function rowToClosingData(row: string[]): ClosingData {
  const n = parseSheetNumber;
  return {
    tanggal:                    normalizeToYMD(row[0] || ""),
    nama_hub:                   row[1]  || "",
    in_hub_transported:         n(row[2]),
    in_hub_received:            n(row[3]),
    in_hub_assigning:           n(row[4]),
    in_hub_assigned:            n(row[5]),
    fleet_delivering:           n(row[6]),
    fleet_delivered:            n(row[7]),
    fleet_oh_volume:            n(row[8]),
    fleet_oh_total:             n(row[9]),
    dedicated_actual_2wh:       n(row[10]),
    kurir_plus_actual_2wh:      n(row[11]),
    dedicated_actual_4wh:       n(row[12]),
    mitra_actual_2wh:           n(row[13]),
    mitra_actual_4wh:           n(row[14]),
    backlog_total:              n(row[15]),
    backlog_to_buyer:           n(row[16]),
    backlog_to_seller:          n(row[17]),
    backlog_to_transfer:        n(row[18]),
    expedite:                   n(row[19]),
    super_expedite:             n(row[20]),
    total_expedite:             n(row[21]),
    submitted_at:               row[22] || "",
    submitted_by:               row[23] || "",
    parcel_sweeper_total:       n(row[24]),
    parcel_sweeper_scanned_pct: n(row[25]),
    manual_fields:              (row[26] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

// ── Color coding ─────────────────────────────────────────────
export type RowColor = "green" | "yellow" | "red" | "orange" | "default";

export function getRowColor(
  delivered: number | null | undefined,
  transported: number | null | undefined,
  hasData: boolean
): RowColor {
  if (!hasData) return "orange";
  if (delivered === null || delivered === undefined) return "default";
  if (transported === null || transported === undefined || transported === 0) return "default";
  const rate = (delivered / transported) * 100;
  if (rate >= 98) return "green";
  if (rate >= 95) return "yellow";
  return "red";
}

export function getRowColorClass(color: RowColor): string {
  switch (color) {
    case "green":  return "bg-green-50 hover:bg-green-100";
    case "yellow": return "bg-yellow-50 hover:bg-yellow-100";
    case "red":    return "bg-red-50 hover:bg-red-100";
    case "orange": return "bg-orange-50 hover:bg-orange-100";
    default:       return "hover:bg-gray-50";
  }
}
