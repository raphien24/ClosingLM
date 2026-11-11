/**
 * Parser untuk file export FMS Fleet Productivity (Excel/CSV)
 *
 * Struktur kolom berdasarkan file asli (19 kolom, 0-indexed):
 * [0]  Driver Name          → "[ID] NAMA KURIR"
 * [1]  Contract Type
 * [2]  Vehicle Type
 * [3]  Zone ID
 * [4]  Assigned             → number
 * [5]  Assigned Target      → number
 * [6]  Assigned Progress    → string (">= Prob. Target" / "<Prob. Target")
 * [7]  Delivery Progress    → string percent ("100.00%")
 * [8]  Handed Over          → number
 * [9]  Delivered (#)        → number
 * [10] Delivered (%)        → string percent ("94.12%")
 * [11] Delivering (#)       → number
 * [12] Delivering (%)       → string percent
 * [13] Failed Delivery (#)  → number
 * [14] Failed Delivery (%)  → string percent
 * [15] Stuck at Delivering  → number
 * [16] Onhold               → number
 * [17] First Delivering Time → "2026-11-07 07:31:10" → ambil tanggal
 * [18] Time Since Last Delivery → diabaikan
 */

export interface FmsRow {
  courier_id: string;
  courier_name: string;
  contract_type: string;
  vehicle_type: string;
  zone_id: string;
  date: string;              // MM/DD/YYYY untuk konsistensi dengan sistem
  assigned: number | null;
  assigned_target: number | null;
  assigned_progress: string | null;
  delivery_progress: string | null;
  handed_over: number | null;
  delivered: number | null;
  delivered_pct: number | null;
  delivering_count: number | null;
  delivering_pct: number | null;
  failed_delivery: number | null;
  failed_delivery_pct: number | null;
  stuck_at_delivering: number | null;
  onhold: number | null;
}

export interface FmsParseResult {
  rows: FmsRow[];
  errors: string[];
  dateDetected: string | null; // YYYY-MM-DD dari file
  formatDetected?: "daily_fleet" | "historical_performance";
  skippedOffCount?: number;    // Jumlah kurir dengan Attend Days = 0 (off / resign)
}

/**
 * Normalisasi Contract Type dari berbagai menu FMS menjadi standar sistem:
 * "Dedicated" | "Kurir Plus" | "Mitra"
 */
export function normalizeContractType(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  if (/dedicated/i.test(s)) return "Dedicated";
  if (/courier\s*plus|kurir\s*plus/i.test(s)) return "Kurir Plus";
  if (/mitra/i.test(s)) return "Mitra";
  return s;
}

/**
 * Normalisasi Vehicle Type dari berbagai menu FMS menjadi standar sistem:
 * "2WH" | "4WH"
 */
export function normalizeVehicleType(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  if (/2wh|motorbike|motor/i.test(s)) return "2WH";
  if (/4wh|blindvan|van|car|mobil/i.test(s)) return "4WH";
  return s;
}

/**
 * Konversi YYYY-MM-DD → MM/DD/YYYY
 */
export function ymdToMmDdYyyy(ymd: string): string {
  const match = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return ymd;
  const [, y, m, d] = match;
  return `${m}/${d}/${y}`;
}

/**
 * Parse "[684739] EKO PUJI WAHYUDI" → { id: "684739", name: "EKO PUJI WAHYUDI" }
 */
function parseCourierCell(raw: string): { id: string; name: string } {
  if (!raw) return { id: "", name: "" };
  const match = raw.trim().match(/^\[(\d+)\]\s*(.+)$/);
  if (match) {
    return {
      id:   match[1].trim(),
      name: match[2].trim(),
    };
  }
  return { id: "", name: raw.trim() };
}

/**
 * Parse "2026-11-07 07:31:10" → "2026-11-07" (YYYY-MM-DD)
 * Juga handle Date object dari xlsx (jika cellDates: true)
 */
function parseDeliveryDateYMD(raw: unknown): string | null {
  if (!raw) return null;

  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    const y = raw.getFullYear();
    return `${y}-${m}-${d}`;
  }

  const s = String(raw).trim();
  if (!s || s === "-") return null;

  const datePart = s.split(/[ T]/)[0];
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return null;
}

/** Parse angka dari berbagai format cell */
function n(v: unknown): number | null {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[%,]/g, "").trim();
  const f = parseFloat(s);
  return isNaN(f) ? null : f;
}

/** Deteksi apakah baris adalah header */
function isHeaderRow(row: unknown[]): boolean {
  const first = String(row[0] || "").trim().toLowerCase();
  return (
    first === "driver name" ||
    first === "driver" ||
    first === "nama" ||
    first === "courier" ||
    (first === "" && String(row[1] || "").toLowerCase().includes("contract"))
  );
}

/**
 * Parse array of raw rows dari xlsx.utils.sheet_to_json({ header: 1 })
 * Mendukung 2 format:
 * 1. "daily_fleet"            : Export harian dari Fleet Productivity (19 kolom, ada First Delivering Time)
 * 2. "historical_performance" : Export hari sebelumnya / Driver Performance (44 kolom, ada Attend Days, tanpa kolom tanggal)
 */
export function parseFmsRows(rawRows: unknown[][], manualDateYMD?: string | null): FmsParseResult {
  const rows: FmsRow[] = [];
  const errors: string[] = [];
  let dateDetected: string | null = null;
  let formatDetected: "daily_fleet" | "historical_performance" = "daily_fleet";
  let skippedOffCount = 0;
  const dailyDateCounts = new Map<string, number>();

  // Default index kolom berdasarkan export standar FMS (19 kolom)
  const colIdx = {
    driver: 0,
    contract: 1,
    vehicle: 2,
    zone: 3,
    assigned: 4,
    assignedTarget: 5,
    assignedProgress: 6,
    deliveryProgress: 7,
    handedOver: 8,
    delivered: 9,
    deliveredPct: 10,
    deliveringCount: 11,
    deliveringPct: 12,
    failedDelivery: 13,
    failedDeliveryPct: 14,
    stuckAtDelivering: 15,
    onhold: 16,
    firstDeliveringTime: 17,
    // Khusus format historical_performance
    attendDays: -1,
  };

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length < 5) continue;

    // Jika baris header, petakan ulang index kolom secara dinamis
    if (isHeaderRow(row)) {
      const headersLower = row.map((c) => String(c ?? "").trim().toLowerCase());
      const isHistorical = headersLower.some(
        (h) => h === "attend days" || h.includes("number of parcels delivered")
      );

      if (isHistorical) {
        formatDetected = "historical_performance";
        dateDetected = manualDateYMD || null;
        colIdx.zone = -1;
        colIdx.assignedTarget = -1;
        colIdx.assignedProgress = -1;
        colIdx.deliveryProgress = -1;
        colIdx.handedOver = -1;
        colIdx.deliveringCount = -1;
        colIdx.deliveringPct = -1;
        colIdx.failedDelivery = -1;
        colIdx.failedDeliveryPct = -1;
        colIdx.stuckAtDelivering = -1;
        colIdx.firstDeliveringTime = -1;
      }

      row.forEach((cell, idx) => {
        const h = String(cell ?? "").trim().toLowerCase();
        if (!h) return;
        if (h === "driver name" || h === "driver" || h === "nama" || h === "courier") colIdx.driver = idx;
        else if (h.includes("contract")) colIdx.contract = idx;
        else if (h.includes("vehicle")) colIdx.vehicle = idx;
        else if (h.includes("zone")) colIdx.zone = idx;
        else if (h === "attend days") colIdx.attendDays = idx;
        else if (h === "assigned" || h.includes("number of parcels assigned")) colIdx.assigned = idx;
        else if (h.includes("assigned target")) colIdx.assignedTarget = idx;
        else if (h.includes("assigned progress")) colIdx.assignedProgress = idx;
        else if (h.includes("delivery progress")) colIdx.deliveryProgress = idx;
        else if (h.includes("handed over")) colIdx.handedOver = idx;
        else if (
          h === "delivered (#)" ||
          h === "delivered" ||
          h.includes("number of parcels delivered(1 to")
        ) {
          colIdx.delivered = idx;
        } else if (h === "delivered (%)" || h === "delivery success rate(%)") {
          colIdx.deliveredPct = idx;
        } else if (h.includes("delivering (#)")) colIdx.deliveringCount = idx;
        else if (h.includes("delivering (%)")) colIdx.deliveringPct = idx;
        else if (h.includes("failed delivery (#)") || h === "failed delivery") colIdx.failedDelivery = idx;
        else if (h.includes("failed delivery (%)")) colIdx.failedDeliveryPct = idx;
        else if (h.includes("stuck")) colIdx.stuckAtDelivering = idx;
        else if (
          h.includes("onhold") ||
          h.includes("on hold") ||
          h.includes("number of parcels on-hold")
        ) {
          colIdx.onhold = idx;
        } else if (h.includes("first delivering")) colIdx.firstDeliveringTime = idx;
      });
      continue;
    }

    // Kolom Driver Name harus ada dan berformat [ID] NAMA
    const courierRaw = String(row[colIdx.driver] ?? "").trim();
    if (!courierRaw || courierRaw === "") continue;

    const { id: courier_id, name: courier_name } = parseCourierCell(courierRaw);

    // Kalau tidak ada bracket ID, skip (mungkin baris footer/total)
    if (!courier_id) {
      if (courier_name && !/total|summary|grand/i.test(courier_name)) {
        errors.push(`Baris ${i + 1}: format kurir tidak valid — "${courierRaw}" (harusnya [ID] NAMA)`);
      }
      continue;
    }

    // ── Format 2: Historical Performance (ada Attend Days, tanpa tanggal) ──
    if (formatDetected === "historical_performance") {
      const attendDays = colIdx.attendDays >= 0 ? n(row[colIdx.attendDays]) : 1;
      // Jika Attend Days <= 0 berarti kurir sedang off atau sudah resign → lewati
      if (!attendDays || attendDays <= 0) {
        skippedOffCount++;
        continue;
      }

      const assignedVal = colIdx.assigned >= 0 ? n(row[colIdx.assigned]) : null;
      const deliveredVal = colIdx.delivered >= 0 ? n(row[colIdx.delivered]) : null;
      const deliveredPctVal = colIdx.deliveredPct >= 0 ? n(row[colIdx.deliveredPct]) : null;
      const onholdVal = colIdx.onhold >= 0 ? n(row[colIdx.onhold]) : 0;
      const failedVal =
        assignedVal !== null && deliveredVal !== null
          ? Math.max(0, assignedVal - deliveredVal - (onholdVal ?? 0))
          : 0;
      const failedPctVal =
        assignedVal && assignedVal > 0
          ? Math.round((failedVal / assignedVal) * 10000) / 100
          : 0;

      const parsedDate = manualDateYMD ? ymdToMmDdYyyy(manualDateYMD) : "";

      rows.push({
        courier_id,
        courier_name,
        contract_type:       normalizeContractType(String(row[colIdx.contract] ?? "")),
        vehicle_type:        normalizeVehicleType(String(row[colIdx.vehicle] ?? "")),
        zone_id:             "", // Akan dilengkapi otomatis dari histori kurir di database
        date:                parsedDate,
        assigned:            assignedVal,
        assigned_target:     null, // Akan dilengkapi otomatis dari histori / default target
        assigned_progress:   null,
        delivery_progress:   deliveredPctVal !== null ? `${deliveredPctVal}%` : null,
        handed_over:         assignedVal,
        delivered:           deliveredVal,
        delivered_pct:       deliveredPctVal,
        delivering_count:    0,
        delivering_pct:      0,
        failed_delivery:     failedVal,
        failed_delivery_pct: failedPctVal,
        stuck_at_delivering: 0,
        onhold:              onholdVal,
      });
      continue;
    }

    // ── Format 1: Daily Fleet Export ──
    const firstDelivRaw = row[colIdx.firstDeliveringTime];
    const rowYmd = parseDeliveryDateYMD(firstDelivRaw);

    if (!rowYmd) {
      const delivCount = n(row[colIdx.delivered]);
      // Jika delivered > 0 tapi First Delivering Time kosong, baru catat warning
      if (delivCount && delivCount > 0) {
        errors.push(`Baris ${i + 1} [${courier_id} ${courier_name}]: kolom "First Delivering Time" kosong padahal Delivered=${delivCount}`);
      }
      continue;
    }

    dailyDateCounts.set(rowYmd, (dailyDateCounts.get(rowYmd) ?? 0) + 1);
    const parsedDate = ymdToMmDdYyyy(rowYmd);

    rows.push({
      courier_id,
      courier_name,
      contract_type:       normalizeContractType(String(row[colIdx.contract] ?? "")),
      vehicle_type:        normalizeVehicleType(String(row[colIdx.vehicle] ?? "")),
      zone_id:             String(row[colIdx.zone] ?? "").trim(),
      date:                parsedDate,
      assigned:            n(row[colIdx.assigned]),
      assigned_target:     n(row[colIdx.assignedTarget]),
      assigned_progress:   String(row[colIdx.assignedProgress] ?? "").trim() || null,
      delivery_progress:   String(row[colIdx.deliveryProgress] ?? "").trim() || null,
      handed_over:         n(row[colIdx.handedOver]),
      delivered:           n(row[colIdx.delivered]),
      delivered_pct:       n(row[colIdx.deliveredPct]),
      delivering_count:    n(row[colIdx.deliveringCount]),
      delivering_pct:      n(row[colIdx.deliveringPct]),
      failed_delivery:     n(row[colIdx.failedDelivery]),
      failed_delivery_pct: n(row[colIdx.failedDeliveryPct]),
      stuck_at_delivering: n(row[colIdx.stuckAtDelivering]),
      onhold:              n(row[colIdx.onhold]),
    });
  }

  // Untuk Format Daily Fleet: pakai 1 tanggal mayoritas (First Delivering Time) agar 1 kurir carryover kemarin
  // tidak memecah uploadDates dan menghapus seluruh data tanggal sebelumnya di database.
  if (formatDetected === "daily_fleet" && rows.length > 0 && dailyDateCounts.size > 0) {
    const sorted = [...dailyDateCounts.entries()].sort((a, b) =>
      b[1] !== a[1] ? b[1] - a[1] : b[0].localeCompare(a[0])
    );
    const modalYmd = sorted[0][0];
    dateDetected = modalYmd;
    const uniformDate = ymdToMmDdYyyy(modalYmd);
    for (const r of rows) {
      r.date = uniformDate;
    }
  }

  return { rows, errors, dateDetected, formatDetected, skippedOffCount };
}
