import { getSheetData, batchGetSheetData, appendRow, findRows, updateRow, ensureSheet, appendRows, updateRows, deleteRowsByColumnValue, rewriteSheetRows, colorRowYellow, clearRowColors, dropFirstColumnIfHeaderMatches, listSheets, deleteSheetRow } from "./sheets";
import {
  CourierRecord,
  CourierLeaveRecord,
  CourierScheduleRow,
  DailyActiveCourierBreakdown,
  DailyActiveDayBreakdown,
  DailyActiveMetrics,
  ProductivityKpi,
  TargetAppeal,
  WeeklyThresholdSegment,
  WeeklyMitraSegment,
  WeeklyActionPlan,
  WeeklyActionPlanItem,
  getDefaultTarget,
} from "@/types/productivity";
import { format } from "date-fns";
import { getMondayYMD, nowWIBTimestamp, parseTimestamp, serialToYMD } from "./dateUtils";
import { parseSheetNumber } from "./utils";
import { normalizeContractType, normalizeVehicleType } from "./fmsParser";

// ── Sheet name helpers ───────────────────────────────────────
// Satu sheet per hub: RAW_SOKO HUB, TARGETS_SOKO HUB, dll.
const RAW_SHEET     = (hubName: string) => `RAW_${hubName.toUpperCase().trim()}`;
const TARGETS_SHEET = (hubName: string) => `TARGETS_${hubName.toUpperCase().trim()}`;
const LEAVE_SHEET   = "CUTI_LOG";

// Header untuk sheet RAW per hub (dimulai langsung dari courier_id di kolom A)
const RAW_HEADER = [
  "courier_id","courier_name","date","driver_name",
  "contract_type","vehicle_type","zone_id",
  "assigned","assigned_target","assigned_progress",
  "delivery_progress","handed_over","delivered","delivered_pct",
  "delivering_count","delivering_pct","failed_delivery","failed_delivery_pct",
  "stuck_at_delivering","onhold",
  "submitted_at","submitted_by",
];

// Header untuk sheet TARGETS per hub
const TARGETS_HEADER = [
  "week_start","contract_type","vehicle_type","target","created_at","created_by",
];

// ── Index kolom RAW sheet ────────────────────────────────────
const COL = {
  COURIER_ID:0, COURIER_NAME:1, DATE:2, DRIVER_NAME:3,
  CONTRACT:4, VEHICLE:5, ZONE:6, ASSIGNED:7, ASSIGNED_TARGET:8,
  ASSIGNED_PROGRESS:9, DELIVERY_PROGRESS:10, HANDED_OVER:11,
  DELIVERED:12, DELIVERED_PCT:13, DELIVERING_COUNT:14,
  DELIVERING_PCT:15, FAILED:16, FAILED_PCT:17, STUCK:18, ONHOLD:19,
  SUBMITTED_AT:20, SUBMITTED_BY:21,
};

const migratedRawSheets = new Set<string>();

/**
 * Pastikan sheet RAW_<HUB> memakai schema terbaru (tanpa kolom kosong "district" di kolom A).
 * Jika sheet lama masih punya header A="district" dan B="courier_id", hapus kolom A secara atomik 1 kali.
 */
async function ensureRawSheetReady(hubName: string): Promise<string> {
  const sheet = RAW_SHEET(hubName);
  await ensureSheet(sheet, RAW_HEADER);
  if (!migratedRawSheets.has(sheet)) {
    await dropFirstColumnIfHeaderMatches(sheet, "district", "courier_id");
    migratedRawSheets.add(sheet);
  }
  return sheet;
}

/** Lepas kolom A lama ("district" atau header kosong saat B1="courier_id") bila batchGet menemui sheet sebelum migrasi. */
export function normalizeRawSheetRows(rows: string[][]): string[][] {
  if (rows.length === 0) return rows;
  const h0 = String(rows[0]?.[0] ?? "").trim().toLowerCase();
  const h1 = String(rows[0]?.[1] ?? "").trim().toLowerCase();
  if (h0 === "district" || (h0 === "" && h1 === "courier_id")) {
    return rows.map((r) => r.slice(1));
  }
  return rows;
}

// ── Index kolom TARGETS sheet ────────────────────────────────
const TCOL = {
  WEEK_START:0, CONTRACT:1, VEHICLE:2, TARGET:3, CREATED_AT:4, CREATED_BY:5,
};

// ── Header & kolom CUTI_LOG sheet (tersembunyi) ──────────────
const LEAVE_HEADER = [
  "hub_name", "courier_id", "courier_name", "date", "created_at", "created_by",
];
const LCOL = {
  HUB_NAME: 0, COURIER_ID: 1, COURIER_NAME: 2, DATE: 3, CREATED_AT: 4, CREATED_BY: 5,
};

function isRiderDedicated(contractType: string, vehicleType: string): boolean {
  return contractType === "Dedicated" && vehicleType === "2WH";
}

/** Peta tipe armada terbaru per courier_id dari data RAW hub */
function buildCourierLatestFleetMap(
  allRaw: CourierRecord[]
): Map<string, { contract_type: string; vehicle_type: string; courier_name: string }> {
  const map = new Map<string, { contract_type: string; vehicle_type: string; courier_name: string; dateKey: string }>();
  for (const r of allRaw) {
    const cid = (r.courier_id || "").trim();
    if (!cid) continue;
    const dKey = normalizeDateKey(r.date);
    const prev = map.get(cid);
    if (!prev || (dKey && dKey >= prev.dateKey)) {
      map.set(cid, {
        contract_type: r.contract_type,
        vehicle_type: r.vehicle_type,
        courier_name: r.courier_name,
        dateKey: dKey,
      });
    }
  }
  const result = new Map<string, { contract_type: string; vehicle_type: string; courier_name: string }>();
  for (const [cid, val] of map.entries()) {
    result.set(cid, {
      contract_type: val.contract_type,
      vehicle_type: val.vehicle_type,
      courier_name: val.courier_name,
    });
  }
  return result;
}

/** Ambil daftar cuti Rider Dedicated untuk hub (dan rentang tanggal opsional) */
export async function getCourierLeaves(
  hubName: string,
  dateRange?: { start: Date; end: Date }
): Promise<CourierLeaveRecord[]> {
  const titles = await listSheets();
  if (!titles.includes(LEAVE_SHEET)) return [];

  const data = await getSheetData(LEAVE_SHEET);
  const normHub = hubName.toLowerCase().trim();
  const seen = new Map<string, CourierLeaveRecord>();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[LCOL.HUB_NAME] || !row[LCOL.COURIER_ID] || !row[LCOL.DATE]) continue;
    if (row[LCOL.HUB_NAME].toLowerCase().trim() !== normHub) continue;

    const dateKey = normalizeDateKey(row[LCOL.DATE]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    if (dateRange) {
      const d = parseDate(dateKey);
      if (!d || d < dateRange.start || d > dateRange.end) continue;
    }

    const courierId = row[LCOL.COURIER_ID].trim();
    const dedupKey = `${courierId}_${dateKey}`;
    seen.set(dedupKey, {
      hub_name: row[LCOL.HUB_NAME].trim(),
      courier_id: courierId,
      courier_name: (row[LCOL.COURIER_NAME] || "").trim(),
      date: dateKey,
      created_at: (row[LCOL.CREATED_AT] || "").trim(),
      created_by: (row[LCOL.CREATED_BY] || "").trim(),
    });
  }

  return Array.from(seen.values());
}

/** Simpan tanda cuti Rider Dedicated ke sheet tersembunyi CUTI_LOG */
export async function addCourierLeave(params: {
  hubName: string;
  courierId: string;
  courierName: string;
  date: string;
  userEmail: string;
}): Promise<{ added: boolean }> {
  const dateKey = normalizeDateKey(params.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Format tanggal cuti tidak valid (harus YYYY-MM-DD).");
  }
  const courierId = params.courierId.trim();
  if (!courierId) {
    throw new Error("Courier ID wajib diisi.");
  }

  // Validasi bahwa kurir memang Rider Dedicated di hub ini
  const allRaw = await getRawData(params.hubName);
  const fleetMap = buildCourierLatestFleetMap(allRaw);
  const fleet = fleetMap.get(courierId);
  const hasDedicated2whRecord = allRaw.some(
    (r) => r.courier_id.trim() === courierId && isRiderDedicated(r.contract_type, r.vehicle_type)
  );
  if (!hasDedicated2whRecord || (fleet && !isRiderDedicated(fleet.contract_type, fleet.vehicle_type))) {
    throw new Error("Tandai cuti hanya berlaku untuk kurir Rider Dedicated (Dedicated · 2WH).");
  }

  await ensureSheet(LEAVE_SHEET, LEAVE_HEADER, { hidden: true });
  const existing = await getSheetData(LEAVE_SHEET, { skipCache: true });
  const normHub = params.hubName.toLowerCase().trim();

  for (let i = 1; i < existing.length; i++) {
    const row = existing[i];
    if (!row) continue;
    if (
      (row[LCOL.HUB_NAME] || "").toLowerCase().trim() === normHub &&
      (row[LCOL.COURIER_ID] || "").trim() === courierId &&
      normalizeDateKey(row[LCOL.DATE]) === dateKey
    ) {
      return { added: false };
    }
  }

  const resolvedName = (params.courierName || fleet?.courier_name || "").trim();
  await appendRow(LEAVE_SHEET, [
    params.hubName.trim(),
    courierId,
    resolvedName,
    dateKey,
    nowWIBTimestamp(),
    params.userEmail,
  ]);
  return { added: true };
}

/** Hapus tanda cuti dari sheet tersembunyi CUTI_LOG */
export async function removeCourierLeave(params: {
  hubName: string;
  courierId: string;
  date: string;
}): Promise<{ removed: boolean }> {
  const dateKey = normalizeDateKey(params.date);
  const courierId = params.courierId.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !courierId) {
    throw new Error("Parameter courier_id dan date tidak valid.");
  }

  const titles = await listSheets();
  if (!titles.includes(LEAVE_SHEET)) return { removed: false };

  const data = await getSheetData(LEAVE_SHEET, { skipCache: true });
  const normHub = params.hubName.toLowerCase().trim();
  const matchingRowIndices: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    if (
      (row[LCOL.HUB_NAME] || "").toLowerCase().trim() === normHub &&
      (row[LCOL.COURIER_ID] || "").trim() === courierId &&
      normalizeDateKey(row[LCOL.DATE]) === dateKey
    ) {
      matchingRowIndices.push(i + 1); // 1-indexed
    }
  }

  if (matchingRowIndices.length === 0) return { removed: false };

  // Hapus dari bawah ke atas agar nomor baris tidak bergeser
  for (let idx = matchingRowIndices.length - 1; idx >= 0; idx--) {
    await deleteSheetRow(LEAVE_SHEET, matchingRowIndices[idx]);
  }
  return { removed: true };
}

// ── Helpers ──────────────────────────────────────────────────

function n(v: string | undefined): number | null {
  return parseSheetNumber(v);
}

/** Parse tanggal format MM/DD/YYYY, YYYY-MM-DD, atau serial number → Date (timezone Jakarta UTC+7) */
export function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (!s) return null;

  // Serial number dari Sheets (misal "46333")
  if (/^\d{5}$/.test(s)) {
    const num = Number(s);
    if (num > 40000 && num < 70000) {
      const ymd = serialToYMD(num);
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }
  }

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  // Format MM/DD/YYYY atau DD/MM/YYYY (default di sheet PRODUCTIVITY)
  const parts = s.split(/[\/\-]/);
  if (parts.length !== 3) return null;
  let [m, d, y] = parts.map(Number);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
  // Jika bagian pertama > 12, berarti tersimpan sebagai DD/MM/YYYY
  if (m > 12 && d <= 12) {
    const tmp = m;
    m = d;
    d = tmp;
  }
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Konversi row Sheets ke CourierRecord */
function rowToRecord(row: string[], hubName: string): CourierRecord {
  return {
    district:            "",
    courier_id:          row[COL.COURIER_ID]         || "",
    courier_name:        row[COL.COURIER_NAME]       || "",
    date:                row[COL.DATE]               || "",
    driver_name:         row[COL.DRIVER_NAME]        || "",
    contract_type:       normalizeContractType(row[COL.CONTRACT] || ""),
    vehicle_type:        normalizeVehicleType(row[COL.VEHICLE]   || ""),
    zone_id:             row[COL.ZONE]               || "",
    assigned:            n(row[COL.ASSIGNED]),
    assigned_target:     n(row[COL.ASSIGNED_TARGET]),
    assigned_progress:   n(row[COL.ASSIGNED_PROGRESS]),
    delivery_progress:   n(row[COL.DELIVERY_PROGRESS]),
    handed_over:         n(row[COL.HANDED_OVER]),
    delivered:           n(row[COL.DELIVERED]),
    delivered_pct:       n(row[COL.DELIVERED_PCT]),
    delivering_count:    n(row[COL.DELIVERING_COUNT]),
    delivering_pct:      n(row[COL.DELIVERING_PCT]),
    failed_delivery:     n(row[COL.FAILED]),
    failed_delivery_pct: n(row[COL.FAILED_PCT]),
    stuck_at_delivering: n(row[COL.STUCK]),
    onhold:              n(row[COL.ONHOLD]),
    nama_hub:            hubName,
    submitted_at:        row[COL.SUBMITTED_AT]       || "",
    submitted_by:        row[COL.SUBMITTED_BY]       || "",
  };
}

function filterActive(
  records: CourierRecord[],
  dateRange?: { start: Date; end: Date }
): CourierRecord[] {
  return records.filter((r) => {
    if (!r.delivered || r.delivered <= 0) return false;
    if (dateRange) {
      const d = parseDate(r.date);
      if (!d) return false;
      if (d < dateRange.start || d > dateRange.end) return false;
    }
    return true;
  });
}

/** Normalisasi tanggal ke YYYY-MM-DD agar pencocokan kurir+tanggal selalu konsisten */
export function normalizeDateKey(dateStr: string | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return (dateStr || "").trim();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Dedup: 1 kurir per tanggal (ambil baris terbaru jika ada duplikat) */
function dedup(records: CourierRecord[]): CourierRecord[] {
  const seen = new Map<string, CourierRecord>();
  for (const r of records) {
    const key = `${r.courier_id.trim()}_${normalizeDateKey(r.date)}`;
    seen.set(key, r);
  }
  return Array.from(seen.values());
}

// ── Grace Period 14 Hari (Kurir Baru) & L15D Database Helper ─────────

/**
 * Cek apakah kontrak kurir memenuhi syarat Grace Period 14 Hari:
 * - 2W Dedicated
 * - 4W Dedicated
 * - 2W Plus (Kurir Plus)
 */
export function isEligibleNewCourierContract(contractType: string, vehicleType: string): boolean {
  const c = (contractType || "").toLowerCase().trim();
  const v = (vehicleType || "").toUpperCase().trim();
  if (c.includes("dedicated") && v.includes("2WH")) return true;
  if (c.includes("dedicated") && v.includes("4WH")) return true;
  if ((c.includes("plus") || c.includes("kurir plus")) && v.includes("2WH")) return true;
  return false;
}

/**
 * Peta tanggal join pertama kali (earliest date) per courier_id dari database raw
 */
export function buildCourierFirstJoinMap(allRaw: CourierRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of allRaw) {
    if (!r.courier_id) continue;
    const ymd = normalizeDateKey(r.date);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const id = r.courier_id.trim();
    const curr = map.get(id);
    if (!curr || ymd < curr) {
      map.set(id, ymd);
    }
  }
  return map;
}

/**
 * Hitung selisih hari kalender sejak tanggal pertama join (1-indexed: hari ke-1, ke-2, dst)
 */
export function getDaysSinceJoin(currentDateStr: string, firstDateStr: string): number {
  const dCur = parseDate(currentDateStr);
  const dFirst = parseDate(firstDateStr);
  if (!dCur || !dFirst) return 999;
  const diffDays = Math.floor((dCur.getTime() - dFirst.getTime()) / (24 * 3600 * 1000));
  return Math.max(1, diffDays + 1);
}

/**
 * Cek apakah database Hub sudah memiliki histori L15D (minimal 15 hari)
 */
export function checkHubL15D(allRaw: CourierRecord[]): {
  hasL15D: boolean;
  uniqueDaysCount: number;
  daySpan: number;
} {
  const dates = new Set<string>();
  for (const r of allRaw) {
    const ymd = normalizeDateKey(r.date);
    if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      dates.add(ymd);
    }
  }
  const uniqueDaysCount = dates.size;
  let daySpan = 0;
  if (dates.size >= 2) {
    const sorted = Array.from(dates).sort();
    const minD = parseDate(sorted[0]);
    const maxD = parseDate(sorted[sorted.length - 1]);
    if (minD && maxD) {
      daySpan = Math.round((maxD.getTime() - minD.getTime()) / (24 * 3600 * 1000)) + 1;
    }
  }
  const hasL15D = uniqueDaysCount >= 15 || daySpan >= 15;
  return { hasL15D, uniqueDaysCount, daySpan };
}

// ── Appeal Targets ───────────────────────────────────────────

export async function getTargetAppeals(hubName: string): Promise<TargetAppeal[]> {
  await ensureSheet(TARGETS_SHEET(hubName), TARGETS_HEADER);
  const data = await getSheetData(TARGETS_SHEET(hubName));
  return data.slice(1)
    .filter((row) => row && row[TCOL.WEEK_START])
    .map((row) => ({
      week_start:    row[TCOL.WEEK_START]  || "",
      nama_hub:      hubName,
      contract_type: row[TCOL.CONTRACT]   || "",
      vehicle_type:  row[TCOL.VEHICLE]    || "",
      target:        parseFloat(row[TCOL.TARGET] || "0") || 0,
      created_at:    row[TCOL.CREATED_AT] || "",
      created_by:    row[TCOL.CREATED_BY] || "",
    }));
}

export async function submitTargetAppeal(
  appeal: TargetAppeal,
  userEmail: string
): Promise<void> {
  await ensureSheet(TARGETS_SHEET(appeal.nama_hub), TARGETS_HEADER);
  const createdAt = nowWIBTimestamp();
  const row = [
    appeal.week_start, appeal.contract_type, appeal.vehicle_type,
    appeal.target, createdAt, userEmail,
  ];

  const existing = await findRows(TARGETS_SHEET(appeal.nama_hub), [
    { columnIndex: TCOL.WEEK_START, value: appeal.week_start },
    { columnIndex: TCOL.CONTRACT,   value: appeal.contract_type },
    { columnIndex: TCOL.VEHICLE,    value: appeal.vehicle_type },
  ]);

  if (existing.length > 0) {
    await updateRow(TARGETS_SHEET(appeal.nama_hub), existing[0], row);
  } else {
    await appendRow(TARGETS_SHEET(appeal.nama_hub), row);
  }
}

export async function deleteTargetAppeal(
  hubName: string,
  weekStart: string,
  contractType: string,
  vehicleType: string
): Promise<void> {
  const existing = await findRows(TARGETS_SHEET(hubName), [
    { columnIndex: TCOL.WEEK_START, value: weekStart },
    { columnIndex: TCOL.CONTRACT,   value: contractType },
    { columnIndex: TCOL.VEHICLE,    value: vehicleType },
  ]);
  if (existing.length > 0) {
    await updateRow(TARGETS_SHEET(hubName), existing[0], ["","","","","",""]);
  }
}

/** Map appeal: "weekStart_contract_vehicle" → target */
function buildAppealMap(appeals: TargetAppeal[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of appeals) {
    if (a.target > 0) map.set(`${a.week_start}_${a.contract_type}_${a.vehicle_type}`, a.target);
  }
  return map;
}

/** Map Monday target dari data raw: "${weekStart}_${contract}_${vehicle}" → target */
function buildMondayTargetMap(records: CourierRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    const ymd = normalizeDateKey(r.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    if (getMondayYMD(ymd) === ymd && r.assigned_target && r.assigned_target > 0) {
      const key = `${ymd}_${r.contract_type}_${r.vehicle_type}`;
      if (!map.has(key)) map.set(key, r.assigned_target);
    }
  }
  return map;
}

function resolveTarget(
  record: Pick<CourierRecord, "contract_type"|"vehicle_type">,
  weekStart: string,
  appealMap: Map<string, number>,
  mondayMap: Map<string, number>
): number {
  const key = `${weekStart}_${record.contract_type}_${record.vehicle_type}`;
  if (appealMap.has(key)) return appealMap.get(key)!;
  if (mondayMap.has(key)) return mondayMap.get(key)!;
  return getDefaultTarget(record.contract_type, record.vehicle_type);
}

/** Cek apakah pada minggu weekStart sudah ada target hari Senin atau Appeal Target */
function hasWeekTarget(
  weekStart: string,
  appealMap: Map<string, number>,
  mondayMap: Map<string, number>,
  filters?: { contract?: string; vehicle?: string }
): boolean {
  const hasSpecificFilter =
    filters?.contract &&
    filters.contract !== "all" &&
    filters?.vehicle &&
    filters.vehicle !== "all";

  if (hasSpecificFilter) {
    const exactKey = `${weekStart}_${filters.contract}_${filters.vehicle}`;
    return appealMap.has(exactKey) || mondayMap.has(exactKey);
  }

  const prefix = `${weekStart}_`;
  for (const k of appealMap.keys()) {
    if (k.startsWith(prefix)) return true;
  }
  for (const k of mondayMap.keys()) {
    if (k.startsWith(prefix)) return true;
  }
  return false;
}

// ── Ambil raw data hub ───────────────────────────────────────

export async function getRawData(hubName: string): Promise<CourierRecord[]> {
  const sheet = await ensureRawSheetReady(hubName);
  const data = normalizeRawSheetRows(await getSheetData(sheet));
  return data.slice(1)
    .filter((row) => row && row.length > 0 && row[COL.COURIER_ID])
    .map((row) => rowToRecord(row, hubName));
}

/** Hitung jumlah kurir unik per tanggal (YYYY-MM-DD) yang sudah tersimpan di database RAW hub. */
export async function getProductivityDatesCoverage(hubName: string): Promise<{
  dates: Record<string, number>;
  lastDate: string | null;
}> {
  const allRaw = await getRawData(hubName);
  const couriersByDate = new Map<string, Set<string>>();

  for (const r of allRaw) {
    if (!r.courier_id) continue;
    const ymd = normalizeDateKey(r.date);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    let set = couriersByDate.get(ymd);
    if (!set) {
      set = new Set<string>();
      couriersByDate.set(ymd, set);
    }
    set.add(r.courier_id.trim());
  }

  const dates: Record<string, number> = {};
  let lastDate: string | null = null;
  for (const [ymd, set] of couriersByDate.entries()) {
    dates[ymd] = set.size;
    if (!lastDate || ymd > lastDate) {
      lastDate = ymd;
    }
  }

  return { dates, lastDate };
}

// ── KPI Metrics ──────────────────────────────────────────────

const DAILY_ACTIVE_DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DAILY_ACTIVE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function formatDateLabelId(dateKey: string): { dateLabel: string; dayName: string } {
  const d = parseDate(dateKey);
  if (!d) return { dateLabel: dateKey, dayName: "-" };
  const dateLabel = `${String(d.getUTCDate()).padStart(2, "0")} ${DAILY_ACTIVE_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const dayName = DAILY_ACTIVE_DAY_NAMES[d.getUTCDay()];
  return { dateLabel, dayName };
}

/**
 * Hitung metrik Daily Active Rate (selalu 2WH · Dedicated + Kurir Plus,
 * tetap menghitung kurir baru + cuti Rider Dedicated tanpa double-count)
 * beserta rincian per kurir & per hari untuk pop-up detail.
 */
function computeDailyActiveMetrics(
  activeRecords: CourierRecord[],
  leaves: CourierLeaveRecord[],
  allRaw: CourierRecord[],
  fallbackOperatingDays = 0
): DailyActiveMetrics {
  const da = activeRecords.filter(
    (r) =>
      r.vehicle_type === "2WH" &&
      (r.contract_type === "Dedicated" || r.contract_type.includes("Kurir Plus"))
  );
  const fleetMap = buildCourierLatestFleetMap(allRaw);
  const daActiveKeys = new Set(
    da.map((r) => `${r.courier_id.trim()}_${normalizeDateKey(r.date)}`)
  );
  const validLeaves = leaves.filter((l) => {
    const cid = l.courier_id.trim();
    const fleet = fleetMap.get(cid);
    if (!fleet || !isRiderDedicated(fleet.contract_type, fleet.vehicle_type)) return false;
    const key = `${cid}_${normalizeDateKey(l.date)}`;
    return !daActiveKeys.has(key);
  });
  const uniqueHeadcount = new Set([
    ...da.map((r) => r.courier_id.trim()),
    ...validLeaves.map((l) => l.courier_id.trim()),
  ]).size;
  const operatingDays =
    new Set(da.map((r) => normalizeDateKey(r.date))).size || fallbackOperatingDays;
  const presentShifts = da.length;
  const leaveShifts = validLeaves.length;
  const activeShifts = presentShifts + leaveShifts;
  const dailyActiveRate =
    uniqueHeadcount > 0 && operatingDays > 0
      ? (activeShifts / (uniqueHeadcount * operatingDays)) * 100
      : 0;

  // Rincian per kurir
  const courierMap = new Map<
    string,
    { courier_id: string; courier_name: string; contract_type: string; presentDays: number; leaveDays: number }
  >();
  for (const r of da) {
    const cid = r.courier_id.trim();
    const prev = courierMap.get(cid) || {
      courier_id: cid,
      courier_name: r.courier_name || cid,
      contract_type: r.contract_type.includes("Kurir Plus") ? "Kurir Plus" : "Dedicated",
      presentDays: 0,
      leaveDays: 0,
    };
    prev.presentDays += 1;
    if (r.courier_name) prev.courier_name = r.courier_name;
    courierMap.set(cid, prev);
  }
  for (const l of validLeaves) {
    const cid = l.courier_id.trim();
    const fleet = fleetMap.get(cid);
    const prev = courierMap.get(cid) || {
      courier_id: cid,
      courier_name: l.courier_name || fleet?.courier_name || cid,
      contract_type: "Dedicated",
      presentDays: 0,
      leaveDays: 0,
    };
    prev.leaveDays += 1;
    courierMap.set(cid, prev);
  }

  const courierBreakdown: DailyActiveCourierBreakdown[] = Array.from(courierMap.values())
    .map((c) => {
      const countedDays = c.presentDays + c.leaveDays;
      const activeRatePct =
        operatingDays > 0 ? Math.round((countedDays / operatingDays) * 1000) / 10 : 0;
      return {
        ...c,
        countedDays,
        activeRatePct,
      };
    })
    .sort((a, b) =>
      b.activeRatePct !== a.activeRatePct
        ? b.activeRatePct - a.activeRatePct
        : b.countedDays !== a.countedDays
        ? b.countedDays - a.countedDays
        : a.courier_name.localeCompare(b.courier_name)
    );

  // Rincian per hari
  const dayMap = new Map<
    string,
    { presentDedicated: number; leaveDedicated: number; presentPlus: number }
  >();
  for (const r of da) {
    const dKey = normalizeDateKey(r.date);
    if (!dKey) continue;
    const prev = dayMap.get(dKey) || { presentDedicated: 0, leaveDedicated: 0, presentPlus: 0 };
    if (r.contract_type.includes("Kurir Plus")) prev.presentPlus += 1;
    else prev.presentDedicated += 1;
    dayMap.set(dKey, prev);
  }
  for (const l of validLeaves) {
    const dKey = normalizeDateKey(l.date);
    if (!dKey) continue;
    const prev = dayMap.get(dKey) || { presentDedicated: 0, leaveDedicated: 0, presentPlus: 0 };
    prev.leaveDedicated += 1;
    dayMap.set(dKey, prev);
  }

  const dailyBreakdown: DailyActiveDayBreakdown[] = Array.from(dayMap.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((dateKey) => {
      const counts = dayMap.get(dateKey)!;
      const totalCounted =
        counts.presentDedicated + counts.leaveDedicated + counts.presentPlus;
      const dailyRatePct =
        uniqueHeadcount > 0
          ? Math.round((totalCounted / uniqueHeadcount) * 1000) / 10
          : 0;
      const { dateLabel, dayName } = formatDateLabelId(dateKey);
      return {
        dateKey,
        dateLabel,
        dayName,
        ...counts,
        totalCounted,
        dailyRatePct,
      };
    });

  return {
    value: Math.round(dailyActiveRate * 10) / 10,
    activeShifts,
    presentShifts,
    leaveShifts,
    uniqueHeadcount,
    operatingDays,
    avgCouriersPerDay:
      operatingDays > 0 ? Math.round((activeShifts / operatingDays) * 10) / 10 : 0,
    courierBreakdown,
    dailyBreakdown,
  };
}

function findLatestRawTimestamp(allRaw: CourierRecord[]): {
  latestDataDate: string | null;
  latestUploadAt: string | null;
} {
  let latestDataDate: string | null = null;
  let latestUploadDateObj: Date | null = null;
  for (const r of allRaw) {
    const ymd = normalizeDateKey(r.date);
    if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      if (!latestDataDate || ymd > latestDataDate) latestDataDate = ymd;
    }
    const ts = parseTimestamp(r.submitted_at);
    if (ts && (!latestUploadDateObj || ts.getTime() > latestUploadDateObj.getTime())) {
      latestUploadDateObj = ts;
    }
  }
  return {
    latestDataDate,
    latestUploadAt: latestUploadDateObj ? nowWIBTimestamp(latestUploadDateObj) : null,
  };
}

function computeCore2whAchievement(
  dedicatedAch: number,
  dedicatedShifts: number,
  kurirPlusAch: number,
  kurirPlusShifts: number
): number {
  if (dedicatedShifts > 0 && kurirPlusShifts > 0) {
    return Math.round(((dedicatedAch + kurirPlusAch) / 2) * 10) / 10;
  }
  if (dedicatedShifts > 0) return dedicatedAch;
  return kurirPlusAch;
}

export async function getKpiMetrics(
  hubName: string,
  dateRange: { start: Date; end: Date },
  weekStart: string,
  filters: { contract?: string; vehicle?: string; excludeNew?: boolean } = {}
): Promise<ProductivityKpi> {
  const [allRaw, appeals, weekLeaves] = await Promise.all([
    getRawData(hubName),
    getTargetAppeals(hubName),
    getCourierLeaves(hubName, dateRange),
  ]);
  const appealMap     = buildAppealMap(appeals);
  const mondayMap     = buildMondayTargetMap(allRaw);
  const allWeekActive = dedup(filterActive(allRaw, dateRange));

  const { hasL15D, uniqueDaysCount } = checkHubL15D(allRaw);
  const firstJoinMap = buildCourierFirstJoinMap(allRaw);

  // Cari tanggal data terbaru & timestamp upload terbaru di seluruh database hub (RAW_<HUB>)
  const { latestDataDate, latestUploadAt } = findLatestRawTimestamp(allRaw);

  // Cek apakah record berada dalam Grace Period 14 hari
  const isGracePeriodRecord = (r: CourierRecord): boolean => {
    if (!isEligibleNewCourierContract(r.contract_type, r.vehicle_type)) return false;
    const firstDate = firstJoinMap.get(r.courier_id.trim()) || r.date;
    return getDaysSinceJoin(r.date, firstDate) <= 14;
  };

  const shouldExcludeNew = Boolean(filters.excludeNew && hasL15D);

  const excludedNewCouriers = new Set<string>();
  if (shouldExcludeNew) {
    allWeekActive.forEach((r) => {
      if (isGracePeriodRecord(r)) {
        excludedNewCouriers.add(r.courier_id.trim());
      }
    });
  }

  // Active records untuk perhitungan produktivitas (jika toggle aktif, kurir baru dikeluarkan)
  const prodActive = shouldExcludeNew
    ? allWeekActive.filter((r) => !isGracePeriodRecord(r))
    : allWeekActive;

  const isFiltered =
    (filters.contract && filters.contract !== "all") ||
    (filters.vehicle && filters.vehicle !== "all");

  let active = prodActive;
  if (filters.contract && filters.contract !== "all") {
    active = active.filter((r) => r.contract_type === filters.contract);
  }
  if (filters.vehicle && filters.vehicle !== "all") {
    active = active.filter((r) => r.vehicle_type === filters.vehicle);
  }

  const activeShifts   = active.length;
  const totalDelivered = active.reduce((s, r) => s + (r.delivered || 0), 0);
  const weeklyAvg      = activeShifts > 0 ? totalDelivered / activeShifts : 0;
  const avgTarget      = activeShifts > 0
    ? active.reduce((s, r) => s + resolveTarget(r, weekStart, appealMap, mondayMap), 0) / activeShifts
    : isFiltered
    ? resolveTarget(
        {
          contract_type: filters.contract && filters.contract !== "all" ? filters.contract : "Dedicated",
          vehicle_type: filters.vehicle && filters.vehicle !== "all" ? filters.vehicle : "2WH",
        },
        weekStart,
        appealMap,
        mondayMap
      )
    : 0;
  const productivityProgress = avgTarget > 0 ? (weeklyAvg / avgTarget) * 100 : 0;

  // Daily Active Rate (Static: selalu 2WH · Dedicated + Kurir Plus, TETAP menghitung kurir baru + cuti Rider Dedicated)
  const dailyActive = computeDailyActiveMetrics(allWeekActive, weekLeaves, allRaw, 6);

  // Met Quota
  const cMap: Record<string, {d:number;s:number;ct:string;vt:string}> = {};
  active.forEach((r) => {
    if (!cMap[r.courier_id]) cMap[r.courier_id] = { d:0, s:0, ct:r.contract_type, vt:r.vehicle_type };
    cMap[r.courier_id].d += r.delivered || 0;
    cMap[r.courier_id].s++;
  });
  let metQuota = 0;
  const uniqueTotal = Object.keys(cMap).length;
  Object.values(cMap).forEach((c) => {
    const avg = c.s > 0 ? c.d / c.s : 0;
    const tgt = resolveTarget({ contract_type:c.ct, vehicle_type:c.vt }, weekStart, appealMap, mondayMap);
    if (avg >= tgt) metQuota++;
  });

  const totalHandedOver = active.reduce((s,r) => s+(r.handed_over||0),0);
  const totalFailed     = active.reduce((s,r) => s+(r.failed_delivery||0),0);
  const totalOnhold     = active.reduce((s,r) => s+(r.onhold||0),0);

  // ── After Threshold & Mitra Cards (berdasarkan seluruh data minggu ini) ──
  const buildWeeklyThresholdSeg = (
    contractType: string,
    vehicleType: string,
    predicate: (r: CourierRecord) => boolean
  ): WeeklyThresholdSegment => {
    const segRecords = prodActive.filter(predicate);
    const shifts = segRecords.length;
    const deliv = segRecords.reduce((s, r) => s + (r.delivered || 0), 0);
    const avg = shifts > 0 ? deliv / shifts : 0;
    const tgt = resolveTarget(
      { contract_type: contractType, vehicle_type: vehicleType },
      weekStart,
      appealMap,
      mondayMap
    );
    const thr75 = tgt * 0.75;
    const ach = shifts > 0 ? calcThresholdAchievement(avg, tgt) : 0;
    return {
      avgProductivity: Math.round(avg * 10) / 10,
      target: Math.round(tgt * 10) / 10,
      threshold75: Math.round(thr75 * 10) / 10,
      achievement: Math.round(ach * 10) / 10,
      totalDelivered: deliv,
      shifts,
    };
  };

  const buildWeeklyMitraSeg = (
    vehicleType: string
  ): WeeklyMitraSegment => {
    const segRecords = allWeekActive.filter(
      (r) => r.contract_type === "Mitra" && r.vehicle_type === vehicleType
    );
    const shifts = segRecords.length;
    const deliv = segRecords.reduce((s, r) => s + (r.delivered || 0), 0);
    const avg = shifts > 0 ? deliv / shifts : 0;
    const tgt = resolveTarget(
      { contract_type: "Mitra", vehicle_type: vehicleType },
      weekStart,
      appealMap,
      mondayMap
    );
    const avgRounded = Math.round(avg * 10) / 10;
    const vsTargetPct = tgt > 0 && shifts > 0 ? Math.round(((avg / tgt) * 100) * 10) / 10 : 0;
    return {
      avgProductivity: avgRounded,
      target: Math.round(tgt * 10) / 10,
      vsTargetPct,
      totalDelivered: deliv,
      shifts,
      isUnderTarget: avgRounded <= tgt,
    };
  };

  const dedicated2wh = buildWeeklyThresholdSeg(
    "Dedicated",
    "2WH",
    (r) => r.contract_type === "Dedicated" && r.vehicle_type === "2WH"
  );
  const kurirPlus2wh = buildWeeklyThresholdSeg(
    "Kurir Plus",
    "2WH",
    (r) => r.contract_type.includes("Kurir Plus") && r.vehicle_type === "2WH"
  );
  const dedicated4wh = buildWeeklyThresholdSeg(
    "Dedicated",
    "4WH",
    (r) => r.contract_type === "Dedicated" && r.vehicle_type === "4WH"
  );

  const kpi2wAchievement = computeCore2whAchievement(
    dedicated2wh.achievement,
    dedicated2wh.shifts,
    kurirPlus2wh.achievement,
    kurirPlus2wh.shifts
  );

  const riderMitra = buildWeeklyMitraSeg("2WH");
  const driverMitra = buildWeeklyMitraSeg("4WH");

  const plusProd = kurirPlus2wh.avgProductivity;
  const dedicatedProd = dedicated2wh.avgProductivity;
  const ratioPct =
    dedicatedProd > 0 ? Math.round(((plusProd / dedicatedProd) * 100) * 10) / 10 : 0;
  const diffPct = Math.round(Math.abs(100 - ratioPct) * 10) / 10;

  // ── Action Plan: Target besok agar avg = target/shift ──────────
  const buildActionPlanItem = (
    title: string,
    avg: number,
    target: number,
    days: number
  ): WeeklyActionPlanItem => {
    const d = Math.max(1, days);
    // Target Besok = Tgt × (Hari + 1) - Avg × Hari
    const targetBesok = Math.max(0, Math.round(target * (d + 1) - avg * d));
    const isAchieved = avg >= target;
    const progressPct = target > 0 ? Math.min(100, Math.round((avg / target) * 100)) : 0;
    return {
      title,
      targetBesok,
      avgSkrg: avg,
      target,
      status: isAchieved ? "On Track" : "Catch Up",
      progressPct,
      operatingDays: d,
    };
  };

  const ded2wDays = new Set(allWeekActive.filter(r => r.contract_type === "Dedicated" && r.vehicle_type === "2WH").map(r => normalizeDateKey(r.date))).size || 1;
  const kp2wDays  = new Set(allWeekActive.filter(r => r.contract_type.includes("Kurir Plus") && r.vehicle_type === "2WH").map(r => normalizeDateKey(r.date))).size || 1;
  const ded4wDays = new Set(allWeekActive.filter(r => r.contract_type === "Dedicated" && r.vehicle_type === "4WH").map(r => normalizeDateKey(r.date))).size || 1;

  const actionPlan: WeeklyActionPlan = {
    riderDed: buildActionPlanItem("Rider Ded.", dedicated2wh.avgProductivity, dedicated2wh.target, ded2wDays),
    riderPlus: buildActionPlanItem("Rider Plus", kurirPlus2wh.avgProductivity, kurirPlus2wh.target, kp2wDays),
    driverDed: buildActionPlanItem("Driver Ded.", dedicated4wh.avgProductivity, dedicated4wh.target, ded4wDays),
  };

  return {
    weeklyAvgProductivity: {
      value: Math.round(weeklyAvg*10)/10,
      target: Math.round(avgTarget*10)/10,
      progress: Math.round(productivityProgress*10)/10,
      totalDelivered, activeShifts,
    },
    dailyActive,
    metQuota: {
      count: metQuota, total: uniqueTotal,
      pct: uniqueTotal>0 ? Math.round((metQuota/uniqueTotal)*100) : 0,
    },
    summary: {
      totalDelivered, totalHandedOver,
      successRate: totalHandedOver>0 ? Math.round((totalDelivered/totalHandedOver)*1000)/10 : 0,
      totalFailed, totalOnhold,
    },
    afterThreshold: {
      kpi2w: {
        achievement: kpi2wAchievement,
        dedicated2wh,
        kurirPlus2wh,
      },
      kpi4w: {
        achievement: dedicated4wh.achievement,
        dedicated4wh,
      },
      riderMitra,
      driverMitra,
      allocation2wh: {
        ratioPct,
        diffPct,
        plusProd,
        dedicatedProd,
      },
      actionPlan,
    },
    missingWeekTarget: !hasWeekTarget(weekStart, appealMap, mondayMap, filters),
    hasL15D,
    dataDaysCount: uniqueDaysCount,
    excludedNewCount: excludedNewCouriers.size,
    databaseInfo: {
      latestDataDate,
      latestUploadAt,
      totalDays: uniqueDaysCount,
    },
  };
}

// ── Courier Schedule Table ───────────────────────────────────

export async function getCourierSchedule(
  hubName: string,
  dateRange: { start: Date; end: Date },
  weekStart: string,
  filters: { contract?:string; vehicle?:string; zone?:string; excludeNew?: boolean } = {}
): Promise<CourierScheduleRow[]> {
  const [allRaw, appeals, weekLeaves] = await Promise.all([
    getRawData(hubName),
    getTargetAppeals(hubName),
    getCourierLeaves(hubName, dateRange),
  ]);
  const appealMap = buildAppealMap(appeals);
  const mondayMap = buildMondayTargetMap(allRaw);
  const active    = dedup(filterActive(allRaw, dateRange));

  const firstJoinMap = buildCourierFirstJoinMap(allRaw);

  const leaveDatesByCourier = new Map<string, Set<string>>();
  for (const l of weekLeaves) {
    const cid = l.courier_id.trim();
    const dKey = normalizeDateKey(l.date);
    if (!cid || !dKey) continue;
    let set = leaveDatesByCourier.get(cid);
    if (!set) {
      set = new Set<string>();
      leaveDatesByCourier.set(cid, set);
    }
    set.add(dKey);
  }

  const DAY: (keyof CourierScheduleRow["activeDays"])[] = ["sen","sel","rab","kam","jum","sab","min"];
  const DAY_NAMES_BY_IDX = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  const groupMap: Record<string, CourierScheduleRow> = {};

  active.forEach((r) => {
    if (!groupMap[r.courier_id]) {
      groupMap[r.courier_id] = {
        courier_id: r.courier_id, courier_name: r.courier_name,
        district: r.district, zone_id: r.zone_id,
        contract_type: r.contract_type, vehicle_type: r.vehicle_type,
        shiftsCount:0, totalAssigned:0, totalDelivered:0, totalHandedOver:0,
        totalFailed:0, totalOnhold:0,
        avgDaily:0, target:0, productivityPct:0, successRate:0,
        activeDays:{sen:false,sel:false,rab:false,kam:false,jum:false,sab:false,min:false},
        leaveDays:{sen:false,sel:false,rab:false,kam:false,jum:false,sab:false,min:false},
        dailyDetails: [],
      };
    }
    const row = groupMap[r.courier_id];
    row.shiftsCount++;
    row.totalAssigned    = (row.totalAssigned || 0) + (r.assigned || 0);
    row.totalDelivered   += r.delivered || 0;
    row.totalHandedOver  += r.handed_over || 0;
    row.totalFailed      = (row.totalFailed || 0) + (r.failed_delivery || 0);
    row.totalOnhold      = (row.totalOnhold || 0) + (r.onhold || 0);
    const d = parseDate(r.date);
    if (d) {
      const dow = d.getUTCDay();
      const idx = dow === 0 ? 6 : dow - 1;
      const dayKey = DAY[idx];
      row.activeDays[dayKey] = true;

      const tgt = resolveTarget(r, weekStart, appealMap, mondayMap);
      const deliv = r.delivered || 0;
      const ho = r.handed_over || 0;
      const dateKey = normalizeDateKey(r.date);
      const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
      const dateLabel = `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

      row.dailyDetails!.push({
        dateKey,
        dateLabel,
        dayKey,
        dayName: DAY_NAMES_BY_IDX[idx],
        zone_id: r.zone_id || row.zone_id || "-",
        assigned: r.assigned || 0,
        handed_over: ho,
        delivered: deliv,
        failed_delivery: r.failed_delivery || 0,
        onhold: r.onhold || 0,
        successRate: ho > 0 ? Math.round((deliv / ho) * 1000) / 10 : 0,
        productivityPct: tgt > 0 ? Math.round((deliv / tgt) * 1000) / 10 : 0,
      });
    }
  });

  let rows = Object.values(groupMap).map((row) => {
    const sample = active.find((r) => r.courier_id === row.courier_id)!;
    const tgt = resolveTarget(sample, weekStart, appealMap, mondayMap);
    const avg = row.shiftsCount > 0 ? row.totalDelivered / row.shiftsCount : 0;
    const sortedDaily = (row.dailyDetails || []).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    // Informasi Grace Period
    const firstDate = firstJoinMap.get(row.courier_id.trim()) || (sortedDaily[0]?.dateKey || "");
    const latestDate = sortedDaily[sortedDaily.length - 1]?.dateKey || firstDate;
    const daysSince = getDaysSinceJoin(latestDate, firstDate);
    const isNew = isEligibleNewCourierContract(row.contract_type, row.vehicle_type) && daysSince <= 14;

    const leaveDays = { sen:false, sel:false, rab:false, kam:false, jum:false, sab:false, min:false };
    if (isRiderDedicated(row.contract_type, row.vehicle_type)) {
      const courierLeaveDates = leaveDatesByCourier.get(row.courier_id.trim());
      if (courierLeaveDates) {
        for (const dKey of courierLeaveDates) {
          const d = parseDate(dKey);
          if (!d) continue;
          const dow = d.getUTCDay();
          const idx = dow === 0 ? 6 : dow - 1;
          const dayKey = DAY[idx];
          if (!row.activeDays[dayKey]) {
            leaveDays[dayKey] = true;
          }
        }
      }
    }

    return {
      ...row,
      leaveDays,
      avgDaily:        Math.round(avg*10)/10,
      target:          tgt,
      productivityPct: tgt>0 ? Math.round((avg/tgt)*1000)/10 : 0,
      successRate:     row.totalHandedOver>0 ? Math.round((row.totalDelivered/row.totalHandedOver)*1000)/10 : 0,
      dailyDetails:    sortedDaily,
      isNewCourier:    isNew,
      daysSinceJoin:   daysSince,
      firstJoinDate:   firstDate,
    };
  });

  if (filters.contract && filters.contract !== "all") rows = rows.filter((r) => r.contract_type === filters.contract);
  if (filters.vehicle  && filters.vehicle  !== "all") rows = rows.filter((r) => r.vehicle_type  === filters.vehicle);
  if (filters.zone     && filters.zone     !== "all") rows = rows.filter((r) => r.zone_id       === filters.zone);

  return rows.sort((a,b) => b.productivityPct - a.productivityPct);
}

// ── Monthly Metrics ──────────────────────────────────────────

export interface CoreSegmentMetrics {
  avgProductivity: number;
  target: number;
  threshold75: number;
  achievement: number;
  totalShifts: number;
  totalDelivered: number;
  segmentDays?: number;
  avgCouriersPerDay?: number;
  shortfallPerCourier?: number;
  totalGapParcels?: number;
  catchUpTarget?: number;
}

export interface DailySegmentMetrics {
  cour: number;
  deliv: number;
  prod: number;
  targ: number;
  achv: number;
}

export interface DailyBreakdownRow {
  dateKey: string;      // YYYY-MM-DD
  date: string;         // MM/DD/YYYY
  dayName: string;      // Minggu, Senin, ...
  delivered: number;
  shifts: number;
  productivity: number;
  target: number;
  achievement: number;
  riderDedicated: DailySegmentMetrics;
  riderPlus: DailySegmentMetrics;
  driverDedicated: DailySegmentMetrics;
}

export interface DailyBreakdownTotals {
  riderDedicated: DailySegmentMetrics;
  riderPlus: DailySegmentMetrics;
  driverDedicated: DailySegmentMetrics;
}

export interface ActiveManpowerBreakdown {
  dedicated2wh: number;
  kurirPlus2wh: number;
  dedicated4wh: number;
  mitra: number;
}

function calcThresholdAchievement(avg: number, target: number): number {
  if (target <= 0) return 0;
  const thr = target * 0.75;
  if (avg <= thr) return 0;
  if (avg >= target) return 100;
  return ((avg - thr) / (target - thr)) * 100;
}

const ID_DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export async function getMonthlyMetrics(
  hubName: string,
  year: number,
  month: number,
  contract: string,
  vehicle: string,
  filters: { excludeNew?: boolean } = {}
): Promise<{
  totalDelivered: number;
  totalShifts: number;
  avgProductivity: number;
  target: number;
  progress: number;
  operatingDays: number;
  uniqueHeadcount: number;
  activeManpowerBreakdown: ActiveManpowerBreakdown;
  dailyActive: ProductivityKpi["dailyActive"];
  metQuota: number;
  totalCouriers: number;
  lastUpdate: string | null;
  core2wh: {
    achievement: number;
    dedicated: CoreSegmentMetrics;
    kurirPlus: CoreSegmentMetrics;
  };
  core4wh: {
    achievement: number;
    dedicated4wh: CoreSegmentMetrics;
  };
  dailyBreakdown: DailyBreakdownRow[];
  dailyBreakdownTotals: DailyBreakdownTotals;
  weeklyBreakdown: { week: string; avgProductivity: number; shifts: number }[];
  missingTargetWeeks: string[];
  hasL15D?: boolean;
  dataDaysCount?: number;
  excludedNewCount?: number;
}> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const monthEnd   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const weekStartStr = getMondayYMD(`${year}-${String(month).padStart(2, "0")}-01`);

  const [allRaw, appeals, monthLeaves] = await Promise.all([
    getRawData(hubName),
    getTargetAppeals(hubName),
    getCourierLeaves(hubName, { start: monthStart, end: monthEnd }),
  ]);
  const appealMap = buildAppealMap(appeals);
  const mondayMap = buildMondayTargetMap(allRaw);

  const { hasL15D, uniqueDaysCount } = checkHubL15D(allRaw);
  const firstJoinMap = buildCourierFirstJoinMap(allRaw);

  // Cari tanggal data terbaru & timestamp upload terbaru di seluruh database hub (RAW_<HUB>)
  const { latestDataDate, latestUploadAt } = findLatestRawTimestamp(allRaw);

  const allMonthActive = dedup(filterActive(allRaw, { start: monthStart, end: monthEnd }));

  // Cek apakah record berada dalam Grace Period 14 hari
  const isGracePeriodRecord = (r: CourierRecord): boolean => {
    if (!isEligibleNewCourierContract(r.contract_type, r.vehicle_type)) return false;
    const firstDate = firstJoinMap.get(r.courier_id.trim()) || r.date;
    return getDaysSinceJoin(r.date, firstDate) <= 14;
  };

  const shouldExcludeNew = Boolean(filters.excludeNew && hasL15D);

  const excludedNewCouriers = new Set<string>();
  if (shouldExcludeNew) {
    allMonthActive.forEach((r) => {
      if (isGracePeriodRecord(r)) {
        excludedNewCouriers.add(r.courier_id.trim());
      }
    });
  }

  // Active records untuk perhitungan produktivitas bulanan
  const prodMonthActive = shouldExcludeNew
    ? allMonthActive.filter((r) => !isGracePeriodRecord(r))
    : allMonthActive;

  // Hitung target setiap shift berdasarkan hari Senin di minggu shift tersebut (Senin–Minggu)
  const getShiftTarget = (r: { date: string; contract_type: string; vehicle_type: string }): number => {
    const dKey = normalizeDateKey(r.date);
    const shiftWeekStart = /^\d{4}-\d{2}-\d{2}$/.test(dKey)
      ? getMondayYMD(dKey)
      : weekStartStr;
    return resolveTarget(r, shiftWeekStart, appealMap, mondayMap);
  };

  // Helper untuk menghitung Core KPI per segmen (Dedicated 2WH, Kurir Plus 2WH, Dedicated 4WH)
  const buildCoreSegment = (
    records: CourierRecord[],
    fallbackContract: string,
    fallbackVehicle: string
  ): CoreSegmentMetrics => {
    const totalShifts = records.length;
    const totalDelivered = records.reduce((s, r) => s + (r.delivered || 0), 0);
    const avgProd = totalShifts > 0 ? totalDelivered / totalShifts : 0;

    // Rata-rata target harian dari hari operasional segmen tersebut di bulan ini
    const dayTargetMap = new Map<string, number>();
    for (const r of records) {
      const dKey = normalizeDateKey(r.date);
      if (dKey && !dayTargetMap.has(dKey)) {
        dayTargetMap.set(
          dKey,
          getShiftTarget({ date: r.date, contract_type: fallbackContract, vehicle_type: fallbackVehicle })
        );
      }
    }

    const segTarget =
      dayTargetMap.size > 0
        ? Array.from(dayTargetMap.values()).reduce((s, v) => s + v, 0) / dayTargetMap.size
        : resolveTarget(
            { contract_type: fallbackContract, vehicle_type: fallbackVehicle },
            weekStartStr,
            appealMap,
            mondayMap
          );

    const thr75 = segTarget * 0.75;
    const ach = totalShifts > 0 ? calcThresholdAchievement(avgProd, segTarget) : 0;
    const segmentDays = dayTargetMap.size;
    const avgCouriersPerDay = segmentDays > 0 ? Math.round(totalShifts / segmentDays) : 0;
    const rawShortfall = totalShifts > 0 ? Math.max(0, segTarget - avgProd) : 0;

    return {
      avgProductivity: Math.round(avgProd * 10) / 10,
      target: Math.round(segTarget * 10) / 10,
      threshold75: Math.round(thr75 * 10) / 10,
      achievement: Math.round(ach * 10) / 10,
      totalShifts,
      totalDelivered,
      segmentDays,
      avgCouriersPerDay,
      shortfallPerCourier: Math.round(rawShortfall * 10) / 10,
      totalGapParcels: totalShifts > 0 ? Math.round(rawShortfall * totalShifts) : 0,
      catchUpTarget: Math.round((segTarget + rawShortfall) * 10) / 10,
    };
  };

  const ded2whRecords = prodMonthActive.filter(
    (r) => r.contract_type === "Dedicated" && r.vehicle_type === "2WH"
  );
  const kp2whRecords = prodMonthActive.filter(
    (r) => r.contract_type.includes("Kurir Plus") && r.vehicle_type === "2WH"
  );
  const ded4whRecords = prodMonthActive.filter(
    (r) => r.contract_type === "Dedicated" && r.vehicle_type === "4WH"
  );

  const dedicated2wh = buildCoreSegment(ded2whRecords, "Dedicated", "2WH");
  const kurirPlus2wh = buildCoreSegment(kp2whRecords, "Kurir Plus", "2WH");
  const dedicated4wh = buildCoreSegment(ded4whRecords, "Dedicated", "4WH");

  const core2whAchievement = computeCore2whAchievement(
    dedicated2wh.achievement,
    dedicated2wh.totalShifts,
    kurirPlus2wh.achievement,
    kurirPlus2wh.totalShifts
  );

  // Filter data sesuai pilihan Contract Type & Vehicle Type untuk Summary Cards & Daily Breakdown
  let active = prodMonthActive;
  if (contract !== "all") active = active.filter((r) => r.contract_type === contract);
  if (vehicle  !== "all") active = active.filter((r) => r.vehicle_type  === vehicle);

  // Seluruh kurir aktif di bulan ini untuk Headcount (tetap menghitung kurir baru)
  let allMonthCouriers = allMonthActive;
  if (contract !== "all") allMonthCouriers = allMonthCouriers.filter((r) => r.contract_type === contract);
  if (vehicle  !== "all") allMonthCouriers = allMonthCouriers.filter((r) => r.vehicle_type  === vehicle);

  const totalDelivered  = active.reduce((s, r) => s + (r.delivered || 0), 0);
  const totalShifts     = active.length;
  const avgProductivity = totalShifts > 0 ? totalDelivered / totalShifts : 0;

  // Bangun Daily Breakdown gabungan (Rider Dedicated, Rider Plus, Driver Dedicated)
  const buildDailySegmentMetrics = (
    records: CourierRecord[],
    segContract: string,
    segVehicle: string
  ): DailySegmentMetrics => {
    const cour = records.length;
    const deliv = records.reduce((s, r) => s + (r.delivered || 0), 0);
    if (cour === 0) {
      return { cour: 0, deliv: 0, prod: 0, targ: 0, achv: 0 };
    }
    const rawProd = deliv / cour;
    const rawTarg = getShiftTarget({
      date: records[0].date,
      contract_type: segContract,
      vehicle_type: segVehicle,
    });
    const rawAchv = rawTarg > 0 ? (rawProd / rawTarg) * 100 : 0;
    return {
      cour,
      deliv,
      prod: Math.round(rawProd * 10) / 10,
      targ: Math.round(rawTarg * 10) / 10,
      achv: Math.round(rawAchv * 10) / 10,
    };
  };

  const dayMap = new Map<
    string,
    { dateObj: Date; delivered: number; shifts: number; targetSum: number; records: CourierRecord[] }
  >();
  for (const r of active) {
    const dKey = normalizeDateKey(r.date);
    const dObj = parseDate(r.date);
    if (!dKey || !dObj) continue;
    const prev = dayMap.get(dKey) || {
      dateObj: dObj,
      delivered: 0,
      shifts: 0,
      targetSum: 0,
      records: [],
    };
    prev.delivered += r.delivered || 0;
    prev.shifts += 1;
    prev.targetSum += getShiftTarget(r);
    prev.records.push(r);
    dayMap.set(dKey, prev);
  }

  const sortedDateKeys = Array.from(dayMap.keys()).sort((a, b) => a.localeCompare(b));
  const dailyBreakdown: DailyBreakdownRow[] = sortedDateKeys.map((dKey) => {
    const item = dayMap.get(dKey)!;
    const prod = item.shifts > 0 ? item.delivered / item.shifts : 0;
    const tgt  = item.shifts > 0 ? item.targetSum / item.shifts : 0;
    const ach  = tgt > 0 ? Math.min(100, (prod / tgt) * 100) : 0;

    const dayDed2wh = item.records.filter(
      (r) => r.contract_type === "Dedicated" && r.vehicle_type === "2WH"
    );
    const dayKp2wh = item.records.filter(
      (r) => r.contract_type.includes("Kurir Plus") && r.vehicle_type === "2WH"
    );
    const dayDed4wh = item.records.filter(
      (r) => r.contract_type === "Dedicated" && r.vehicle_type === "4WH"
    );

    return {
      dateKey: dKey,
      date: format(item.dateObj, "MM/dd/yyyy"),
      dayName: ID_DAY_NAMES[item.dateObj.getDay()],
      delivered: item.delivered,
      shifts: item.shifts,
      productivity: Math.round(prod * 10) / 10,
      target: Math.round(tgt * 10) / 10,
      achievement: Math.round(ach * 10) / 10,
      riderDedicated: buildDailySegmentMetrics(dayDed2wh, "Dedicated", "2WH"),
      riderPlus: buildDailySegmentMetrics(dayKp2wh, "Kurir Plus", "2WH"),
      driverDedicated: buildDailySegmentMetrics(dayDed4wh, "Dedicated", "4WH"),
    };
  });

  const buildTotalSegmentMetrics = (
    coreSeg: CoreSegmentMetrics
  ): DailySegmentMetrics => {
    const hasShifts = coreSeg.totalShifts > 0;
    const targ = hasShifts ? coreSeg.target : 0;
    const actualAchv =
      hasShifts && targ > 0
        ? Math.round((coreSeg.avgProductivity / targ) * 1000) / 10
        : 0;
    return {
      cour: coreSeg.totalShifts,
      deliv: coreSeg.totalDelivered,
      prod: coreSeg.avgProductivity,
      targ,
      achv: actualAchv,
    };
  };

  const dailyBreakdownTotals: DailyBreakdownTotals = {
    riderDedicated: buildTotalSegmentMetrics(dedicated2wh),
    riderPlus: buildTotalSegmentMetrics(kurirPlus2wh),
    driverDedicated: buildTotalSegmentMetrics(dedicated4wh),
  };

  const operatingDays = dailyBreakdown.length;

  // Monthly Target: rata-rata dari target harian di hari operasional (sesuai metode Soko)
  const avgTarget =
    operatingDays > 0
      ? dailyBreakdown.reduce((s, d) => s + d.target, 0) / operatingDays
      : resolveTarget(
          {
            contract_type: contract !== "all" ? contract : "Dedicated",
            vehicle_type: vehicle !== "all" ? vehicle : "2WH",
          },
          weekStartStr,
          appealMap,
          mondayMap
        );

  const progress = avgTarget > 0 ? Math.min(100, (avgProductivity / avgTarget) * 100) : 0;

  // Last Update dari tanggal terbaru di bulan ini (atau seluruh data jika bulan ini kosong)
  const allMonthDates = allMonthActive
    .map((r) => parseDate(r.date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastUpdate =
    allMonthDates.length > 0 ? format(allMonthDates[0], "d MMM yyyy") : null;

  const countUniqueCouriers = (records: CourierRecord[]): number =>
    new Set(records.map((r) => r.courier_id.trim()).filter(Boolean)).size;

  const uniqueHeadcount = countUniqueCouriers(allMonthCouriers);
  const activeManpowerBreakdown: ActiveManpowerBreakdown = {
    dedicated2wh: countUniqueCouriers(
      allMonthCouriers.filter(
        (r) => r.contract_type === "Dedicated" && r.vehicle_type === "2WH"
      )
    ),
    kurirPlus2wh: countUniqueCouriers(
      allMonthCouriers.filter(
        (r) => r.contract_type.includes("Kurir Plus") && r.vehicle_type === "2WH"
      )
    ),
    dedicated4wh: countUniqueCouriers(
      allMonthCouriers.filter(
        (r) => r.contract_type === "Dedicated" && r.vehicle_type === "4WH"
      )
    ),
    mitra: countUniqueCouriers(
      allMonthCouriers.filter((r) => r.contract_type === "Mitra")
    ),
  };
  const cMap: Record<string, { d: number; s: number; tSum: number }> = {};
  active.forEach((r) => {
    if (!cMap[r.courier_id]) cMap[r.courier_id] = { d: 0, s: 0, tSum: 0 };
    cMap[r.courier_id].d += r.delivered || 0;
    cMap[r.courier_id].s++;
    cMap[r.courier_id].tSum += getShiftTarget(r);
  });
  let metQuota = 0;
  Object.values(cMap).forEach((c) => {
    const courierAvg = c.s > 0 ? c.d / c.s : 0;
    const courierTgt = c.s > 0 ? c.tSum / c.s : avgTarget;
    if (c.s > 0 && courierAvg >= courierTgt) metQuota++;
  });

  const weekMap: Record<string, { delivered: number; shifts: number }> = {};
  allMonthActive.forEach((r) => {
    const dKey = normalizeDateKey(r.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dKey)) return;
    const wk = getMondayYMD(dKey);
    if (!weekMap[wk]) weekMap[wk] = { delivered: 0, shifts: 0 };
    weekMap[wk].delivered += r.delivered || 0;
    weekMap[wk].shifts++;
  });

  const sortedWeeks = Object.keys(weekMap).sort((a, b) => a.localeCompare(b));
  const missingTargetWeeks = sortedWeeks.filter(
    (wk) => !hasWeekTarget(wk, appealMap, mondayMap, { contract, vehicle })
  );

  const dailyActive = computeDailyActiveMetrics(allMonthActive, monthLeaves, allRaw, 0);

  return {
    totalDelivered,
    totalShifts,
    avgProductivity: Math.round(avgProductivity * 10) / 10,
    target: Math.round(avgTarget * 10) / 10,
    progress: Math.round(progress * 10) / 10,
    operatingDays,
    uniqueHeadcount,
    activeManpowerBreakdown,
    dailyActive,
    metQuota,
    totalCouriers: Object.keys(cMap).length,
    lastUpdate,
    core2wh: {
      achievement: core2whAchievement,
      dedicated: dedicated2wh,
      kurirPlus: kurirPlus2wh,
    },
    core4wh: {
      achievement: dedicated4wh.achievement,
      dedicated4wh,
    },
    dailyBreakdown,
    dailyBreakdownTotals,
    weeklyBreakdown: sortedWeeks.map((wk) => {
      const data = weekMap[wk];
      return {
        week: wk,
        avgProductivity: data.shifts > 0 ? Math.round((data.delivered / data.shifts) * 10) / 10 : 0,
        shifts: data.shifts,
      };
    }),
    missingTargetWeeks,
    hasL15D,
    dataDaysCount: uniqueDaysCount,
    excludedNewCount: excludedNewCouriers.size,
  };
}

// ── Input: simpan data kurir harian ─────────────────────────

export async function saveCourierRecord(
  record: Omit<CourierRecord,"nama_hub"|"submitted_at"|"submitted_by">,
  hubName: string,
  userEmail: string
): Promise<{ overwritten: boolean }> {
  const sheet = await ensureRawSheetReady(hubName);
  const submittedAt = nowWIBTimestamp();
  const row = buildRow(record, hubName, submittedAt, userEmail);

  const existing = await findRows(sheet, [
    { columnIndex: COL.COURIER_ID, value: record.courier_id },
    { columnIndex: COL.DATE,       value: record.date },
  ]);

  if (existing.length > 0) {
    await updateRow(sheet, existing[0], row);
    return { overwritten: true };
  } else {
    await appendRow(sheet, row);
    return { overwritten: false };
  }
}

/** Ambil daftar unik kurir untuk autocomplete input */
export async function getHubCouriers(hubName: string): Promise<{
  courier_id:string; courier_name:string; contract_type:string;
  vehicle_type:string; zone_id:string; district:string;
}[]> {
  const allRaw = await getRawData(hubName);
  const seen = new Map<string, CourierRecord>();
  for (const r of allRaw) {
    if (!seen.has(r.courier_id)) seen.set(r.courier_id, r);
  }
  return Array.from(seen.values()).map((r) => ({
    courier_id:    r.courier_id,   courier_name:  r.courier_name,
    contract_type: r.contract_type, vehicle_type: r.vehicle_type,
    zone_id:       r.zone_id,      district:      r.district,
  }));
}

// ── Cek apakah tanggal / kurir sudah ada di database ─────────

export async function checkExistingCourierRecords(
  records: { courier_id: string; date: string }[],
  hubName: string
): Promise<{
  existingOnDateCount: number;
  willOverwriteCount: number;
  newCount: number;
  overwriteKeys: string[]; // format: `${courier_id}_${YYYY-MM-DD}`
  courierProfiles: Record<string, { zone_id: string; assigned_target: number | null }>;
}> {
  if (records.length === 0) {
    return {
      existingOnDateCount: 0,
      willOverwriteCount: 0,
      newCount: 0,
      overwriteKeys: [],
      courierProfiles: {},
    };
  }

  const sheet = await ensureRawSheetReady(hubName);
  const existing = normalizeRawSheetRows(await getSheetData(sheet, { skipCache: true }));

  const targetDates = new Set(
    records.map((r) => normalizeDateKey(r.date)).filter((d) => d.length > 0)
  );
  const existingKeySet = new Set<string>();
  const existingOnDateSet = new Set<string>();
  const courierProfiles: Record<string, { zone_id: string; assigned_target: number | null }> = {};

  for (let i = 1; i < existing.length; i++) {
    const row = existing[i];
    if (!row || !row[COL.COURIER_ID]) continue;
    const cid = String(row[COL.COURIER_ID]).trim();

    // Simpan profil terbaru kurir (zone_id & assigned_target) dari histori sheet
    const z = String(row[COL.ZONE] ?? "").trim();
    const tgt = n(row[COL.ASSIGNED_TARGET]);
    if (!courierProfiles[cid]) {
      courierProfiles[cid] = { zone_id: z, assigned_target: tgt };
    } else {
      if (z) courierProfiles[cid].zone_id = z;
      if (tgt && tgt > 0) courierProfiles[cid].assigned_target = tgt;
    }

    if (!row[COL.DATE]) continue;
    const dKey = normalizeDateKey(String(row[COL.DATE]));
    if (!dKey) continue;
    const fullKey = `${cid}_${dKey}`;
    existingKeySet.add(fullKey);
    if (targetDates.has(dKey)) {
      existingOnDateSet.add(fullKey);
    }
  }

  const overwriteKeys: string[] = [];
  let newCount = 0;

  for (const r of records) {
    const dKey = normalizeDateKey(r.date);
    if (!dKey) {
      newCount++;
      continue;
    }
    const fullKey = `${r.courier_id.trim()}_${dKey}`;
    if (existingKeySet.has(fullKey)) {
      overwriteKeys.push(fullKey);
    } else {
      newCount++;
    }
  }

  return {
    existingOnDateCount: existingOnDateSet.size,
    willOverwriteCount: overwriteKeys.length,
    newCount,
    overwriteKeys,
    courierProfiles,
  };
}

// ── Batch save: clean replace per tanggal + marker kuning ───
// Logic:
//   1. Cek apakah ada data existing untuk tanggal yang di-upload
//   2. Jika ada → hapus semua row tanggal tersebut (clear rows by date)
//      → reset warna kuning lama
//   3. Append semua record baru ke bawah (1 API call)
//   4. Warnai 1 baris penanda kuning tepat di atas batch baru
//
// Returns: saved, deletedExisting (untuk peringatan di UI)

export async function saveCourierRecordsBatch(
  records: Omit<CourierRecord, "nama_hub" | "submitted_at" | "submitted_by">[],
  hubName: string,
  userEmail: string
): Promise<{ saved: number; deletedExisting: number }> {
  if (records.length === 0) return { saved: 0, deletedExisting: 0 };

  const sheet = await ensureRawSheetReady(hubName);
  const submittedAt = nowWIBTimestamp();

  // Ambil tanggal unik dari records yang akan di-upload
  // (biasanya semua sama, tapi handle edge case)
  const uploadDates = [...new Set(
    records.map((r) => normalizeDateKey(r.date))
  )];

  // 1. Baca existing terbaru (bypass cache) untuk profil kurir dan pisahkan row selain tanggal upload
  const existing = normalizeRawSheetRows(await getSheetData(sheet, { skipCache: true }));
  const courierProfiles = new Map<string, { zone_id: string; assigned_target: number | null }>();
  const uploadDateSet = new Set(uploadDates);

  let deletedExisting = 0;
  const keptRows: (string | number | null)[][] = [];
  for (let i = 1; i < existing.length; i++) {
    const row = existing[i];
    if (!row || !row[COL.COURIER_ID]) continue;

    const cid = String(row[COL.COURIER_ID]).trim();
    const z   = String(row[COL.ZONE]            ?? "").trim();
    const tgt = n(row[COL.ASSIGNED_TARGET]);
    const prev = courierProfiles.get(cid);
    if (!prev) {
      courierProfiles.set(cid, { zone_id: z, assigned_target: tgt });
    } else {
      if (z)              prev.zone_id         = z;
      if (tgt && tgt > 0) prev.assigned_target = tgt;
    }

    const rowDateKey = row[COL.DATE] ? normalizeDateKey(String(row[COL.DATE])) : "";
    if (rowDateKey && uploadDateSet.has(rowDateKey)) {
      deletedExisting++;
    } else {
      keptRows.push(row);
    }
  }

  // 2. Bangun rows baru (dengan enrichment profil kurir)
  const toAppend: (string | number | null)[][] = [];
  for (const rawRecord of records) {
    const cid          = rawRecord.courier_id.trim();
    const normContract = normalizeContractType(rawRecord.contract_type);
    const normVehicle  = normalizeVehicleType(rawRecord.vehicle_type);
    const profile      = courierProfiles.get(cid);

    const enriched = {
      ...rawRecord,
      contract_type:   normContract,
      vehicle_type:    normVehicle,
      zone_id:         rawRecord.zone_id || profile?.zone_id || "",
      assigned_target: rawRecord.assigned_target,
    };
    toAppend.push(buildRow(enriched, hubName, submittedAt, userEmail));
  }

  if (toAppend.length === 0) return { saved: 0, deletedExisting };

  // 3. Gabungkan + urutkan kronologis (lama -> baru) berdasarkan tanggal agar database selalu rapi berurutan
  const combined = [...keptRows, ...toAppend]
    .map((row, idx) => ({
      row,
      idx,
      key: normalizeDateKey(String(row[COL.DATE] ?? "")) || "9999-99-99",
    }))
    .sort((a, b) => (a.key !== b.key ? a.key.localeCompare(b.key) : a.idx - b.idx))
    .map((e) => e.row);

  await rewriteSheetRows(sheet, [RAW_HEADER, ...combined]);
  if (existing.length > 1) {
    await clearRowColors(sheet);
  }

  // 4. Warnai 1 baris penanda kuning tepat di awal batch tanggal yang baru disimpan (1-indexed)
  const firstBatchIdx = combined.findIndex((row) =>
    uploadDateSet.has(normalizeDateKey(String(row[COL.DATE] ?? "")))
  );
  if (firstBatchIdx >= 0) {
    await colorRowYellow(sheet, firstBatchIdx + 2);
  }

  return { saved: toAppend.length, deletedExisting };
}

function buildRow(
  record: Omit<CourierRecord, "nama_hub" | "submitted_at" | "submitted_by">,
  hubName: string,
  submittedAt: string,
  userEmail: string
): (string | number | null)[] {
  return [
    record.courier_id,
    record.courier_name,
    record.date,
    record.driver_name,
    record.contract_type,
    record.vehicle_type,
    record.zone_id,
    record.assigned ?? "",
    record.assigned_target ?? "",
    record.assigned_progress ?? "",
    record.delivery_progress ?? "",
    record.handed_over ?? "",
    record.delivered ?? "",
    record.delivered_pct ?? "",
    record.delivering_count ?? "",
    record.delivering_pct ?? "",
    record.failed_delivery ?? "",
    record.failed_delivery_pct ?? "",
    record.stuck_at_delivering ?? "",
    record.onhold ?? "",
    submittedAt,
    userEmail,
  ];
}

// ── Ambil Daily Productivity untuk banyak Hub pada tanggal tertentu ──
// Digunakan oleh Dashboard Closing (hanya 1 batchGet API call untuk semua hub)

export interface HubDailyProductivity {
  prod_2w_dedicated: number | null;
  prod_2w_kurir_plus: number | null;
  prod_4w_dedicated: number | null;
  prod_2w_mitra: number | null;
  prod_4w_mitra: number | null;
  target_2w_dedicated: number;
  target_2w_kurir_plus: number;
  target_4w_dedicated: number;
  target_2w_mitra: number;
  target_4w_mitra: number;
}

export async function getDailyProductivityByHubs(
  hubNames: string[],
  targetDateYMD: string
): Promise<Map<string, HubDailyProductivity>> {
  const result = new Map<string, HubDailyProductivity>();
  if (hubNames.length === 0 || !targetDateYMD) return result;

  const weekStart = getMondayYMD(targetDateYMD);

  const sheetNames: string[] = [];
  for (const hub of hubNames) {
    sheetNames.push(RAW_SHEET(hub));
    sheetNames.push(TARGETS_SHEET(hub));
  }

  const batchData = await batchGetSheetData(sheetNames);

  const calcAvg = (records: CourierRecord[]): number | null => {
    if (records.length === 0) return null;
    const totalDelivered = records.reduce((s, r) => s + (r.delivered || 0), 0);
    return Math.round((totalDelivered / records.length) * 10) / 10;
  };

  for (const hub of hubNames) {
    const hubKey = hub.toLowerCase().trim();
    const rawRows = normalizeRawSheetRows(batchData.get(RAW_SHEET(hub)) || []);
    const targetRows = batchData.get(TARGETS_SHEET(hub)) || [];

    // Bangun appealMap dari TARGETS_<HUB>
    const appeals: TargetAppeal[] = targetRows
      .slice(1)
      .filter((row) => row && row[TCOL.WEEK_START])
      .map((row) => ({
        week_start: row[TCOL.WEEK_START] || "",
        nama_hub: hub,
        contract_type: row[TCOL.CONTRACT] || "",
        vehicle_type: row[TCOL.VEHICLE] || "",
        target: parseFloat(row[TCOL.TARGET] || "0") || 0,
      }));
    const appealMap = buildAppealMap(appeals);

    // Bangun mondayMap & filter dayRecords dari RAW_<HUB>
    const mondayMap = new Map<string, number>();
    const dayRecords: CourierRecord[] = [];

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || !row[COL.COURIER_ID] || !row[COL.DATE]) continue;
      const dKey = normalizeDateKey(row[COL.DATE]);
      if (!dKey) continue;

      if (dKey === weekStart) {
        const tgt = n(row[COL.ASSIGNED_TARGET]);
        if (tgt && tgt > 0) {
          const ct = normalizeContractType(row[COL.CONTRACT] || "");
          const vt = normalizeVehicleType(row[COL.VEHICLE] || "");
          const mKey = `${weekStart}_${ct}_${vt}`;
          if (!mondayMap.has(mKey)) mondayMap.set(mKey, tgt);
        }
      }

      if (dKey === targetDateYMD) {
        const rec = rowToRecord(row, hubKey);
        if (rec.delivered && rec.delivered > 0) {
          dayRecords.push(rec);
        }
      }
    }

    const active = dedup(dayRecords);

    const ded2w = active.filter(
      (r) => r.vehicle_type === "2WH" && r.contract_type === "Dedicated"
    );
    const kp2w = active.filter(
      (r) => r.vehicle_type === "2WH" && r.contract_type.includes("Kurir Plus")
    );
    const ded4w = active.filter(
      (r) => r.vehicle_type === "4WH" && r.contract_type === "Dedicated"
    );
    const mitra2w = active.filter(
      (r) => r.vehicle_type === "2WH" && r.contract_type === "Mitra"
    );
    const mitra4w = active.filter(
      (r) => r.vehicle_type === "4WH" && r.contract_type === "Mitra"
    );

    result.set(hubKey, {
      prod_2w_dedicated: calcAvg(ded2w),
      prod_2w_kurir_plus: calcAvg(kp2w),
      prod_4w_dedicated: calcAvg(ded4w),
      prod_2w_mitra: calcAvg(mitra2w),
      prod_4w_mitra: calcAvg(mitra4w),
      target_2w_dedicated:
        Math.round(
          resolveTarget(
            { contract_type: "Dedicated", vehicle_type: "2WH" },
            weekStart,
            appealMap,
            mondayMap
          ) * 10
        ) / 10,
      target_2w_kurir_plus:
        Math.round(
          resolveTarget(
            { contract_type: "Kurir Plus", vehicle_type: "2WH" },
            weekStart,
            appealMap,
            mondayMap
          ) * 10
        ) / 10,
      target_4w_dedicated:
        Math.round(
          resolveTarget(
            { contract_type: "Dedicated", vehicle_type: "4WH" },
            weekStart,
            appealMap,
            mondayMap
          ) * 10
        ) / 10,
      target_2w_mitra:
        Math.round(
          resolveTarget(
            { contract_type: "Mitra", vehicle_type: "2WH" },
            weekStart,
            appealMap,
            mondayMap
          ) * 10
        ) / 10,
      target_4w_mitra:
        Math.round(
          resolveTarget(
            { contract_type: "Mitra", vehicle_type: "4WH" },
            weekStart,
            appealMap,
            mondayMap
          ) * 10
        ) / 10,
    });
  }

  return result;
}

// ── Ringkasan Produktivitas Seluruh Hub (Weekly + Monthly 2WH & 4WH KPI) ────

export interface HubSegmentDetail {
  shifts: number;
  delivered: number;
  avgProductivity: number;
  target: number;
  threshold75: number;
  achievement: number;
  activeDays: number;
  avgCouriersPerDay: number;
  shortfallPerCourier: number;
  totalGapParcels: number;
  catchUpTarget: number;
}

export interface HubPeriodProductivity {
  kpi2wh: number;
  kpi4wh: number;
  dedicated2whAch: number;
  kurirPlus2whAch: number;
  dedicated4whAch: number;
  shifts2wh: number;
  shifts4wh: number;
  segments: {
    dedicated2wh: HubSegmentDetail;
    kurirPlus2wh: HubSegmentDetail;
    dedicated4wh: HubSegmentDetail;
    mitra2wh: HubSegmentDetail;
    mitra4wh: HubSegmentDetail;
  };
}

export interface HubProductivitySummary {
  namaHub: string;
  lastDataDate: string | null;
  lastUploadAt: string | null;
  hasL15D: boolean;
  weekly: HubPeriodProductivity;
  monthly: HubPeriodProductivity;
}

function buildHubSegmentDetail(
  segRecords: CourierRecord[],
  segTarget: number
): HubSegmentDetail {
  const shifts = segRecords.length;
  const delivered = segRecords.reduce((s, r) => s + (r.delivered || 0), 0);
  const avg = shifts > 0 ? delivered / shifts : 0;
  const dayKeys = new Set<string>();
  for (const r of segRecords) {
    const dk = normalizeDateKey(r.date);
    if (dk) dayKeys.add(dk);
  }
  const activeDays = dayKeys.size;
  const avgCouriersPerDay = activeDays > 0 ? Math.round(shifts / activeDays) : 0;
  const rawShortfall = shifts > 0 ? Math.max(0, segTarget - avg) : 0;
  const ach = shifts > 0 ? Math.round(calcThresholdAchievement(avg, segTarget) * 10) / 10 : 0;

  return {
    shifts,
    delivered,
    avgProductivity: Math.round(avg * 10) / 10,
    target: Math.round(segTarget * 10) / 10,
    threshold75: Math.round(segTarget * 0.75 * 10) / 10,
    achievement: ach,
    activeDays,
    avgCouriersPerDay,
    shortfallPerCourier: Math.round(rawShortfall * 10) / 10,
    totalGapParcels: shifts > 0 ? Math.round(rawShortfall * shifts) : 0,
    catchUpTarget: Math.round((segTarget + rawShortfall) * 10) / 10,
  };
}

/**
 * Menghitung capaian Weekly Productivity (2WH & 4WH KPI) dan Monthly Productivity
 * (2WH & 4WH KPI) sekaligus tanggal update data terakhir untuk seluruh Hub
 * menggunakan 1x panggilan batch Google Sheets.
 */
export async function getAllHubsProductivitySummary(
  hubNames: string[],
  weekStart: string,
  year: number,
  month: number,
  options: { excludeNew?: boolean } = {}
): Promise<HubProductivitySummary[]> {
  if (hubNames.length === 0) return [];

  const [wy, wm, wd] = weekStart.split("-").map(Number);
  const weekRange = {
    start: new Date(Date.UTC(wy, wm - 1, wd, 0, 0, 0)),
    end: new Date(Date.UTC(wy, wm - 1, wd + 6, 23, 59, 59, 999)),
  };
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const monthFallbackWeek = getMondayYMD(`${year}-${String(month).padStart(2, "0")}-01`);

  const sheetNames: string[] = [];
  for (const hub of hubNames) {
    sheetNames.push(RAW_SHEET(hub));
    sheetNames.push(TARGETS_SHEET(hub));
  }

  const batchData = await batchGetSheetData(sheetNames);

  return hubNames.map((hub) => {
    const rawRows = normalizeRawSheetRows(batchData.get(RAW_SHEET(hub)) || []);
    const allRaw: CourierRecord[] = rawRows
      .slice(1)
      .filter((row) => row && row.length > 0 && row[COL.COURIER_ID])
      .map((row) => rowToRecord(row, hub));

    const targetRows = batchData.get(TARGETS_SHEET(hub)) || [];
    const appeals: TargetAppeal[] = targetRows
      .slice(1)
      .filter((row) => row && row[TCOL.WEEK_START])
      .map((row) => ({
        week_start: row[TCOL.WEEK_START] || "",
        nama_hub: hub,
        contract_type: row[TCOL.CONTRACT] || "",
        vehicle_type: row[TCOL.VEHICLE] || "",
        target: parseFloat(row[TCOL.TARGET] || "0") || 0,
      }));

    const appealMap = buildAppealMap(appeals);
    const mondayMap = buildMondayTargetMap(allRaw);
    const { hasL15D } = checkHubL15D(allRaw);
    const firstJoinMap = buildCourierFirstJoinMap(allRaw);
    const { latestDataDate, latestUploadAt } = findLatestRawTimestamp(allRaw);

    const shouldExcludeNew = Boolean(options.excludeNew && hasL15D);
    const isGracePeriodRecord = (r: CourierRecord): boolean => {
      if (!isEligibleNewCourierContract(r.contract_type, r.vehicle_type)) return false;
      const firstDate = firstJoinMap.get(r.courier_id.trim()) || r.date;
      return getDaysSinceJoin(r.date, firstDate) <= 14;
    };

    // 1. Weekly Productivity (Senin–Minggu)
    const allWeekActive = dedup(filterActive(allRaw, weekRange));
    const prodWeek = shouldExcludeNew
      ? allWeekActive.filter((r) => !isGracePeriodRecord(r))
      : allWeekActive;

    const calcWeeklySeg = (
      contractType: string,
      vehicleType: string,
      predicate: (r: CourierRecord) => boolean
    ): HubSegmentDetail => {
      const segRecords = prodWeek.filter(predicate);
      const tgt = resolveTarget(
        { contract_type: contractType, vehicle_type: vehicleType },
        weekStart,
        appealMap,
        mondayMap
      );
      return buildHubSegmentDetail(segRecords, tgt);
    };

    const wDed2wh = calcWeeklySeg(
      "Dedicated",
      "2WH",
      (r) => r.contract_type === "Dedicated" && r.vehicle_type === "2WH"
    );
    const wKp2wh = calcWeeklySeg(
      "Kurir Plus",
      "2WH",
      (r) => r.contract_type.includes("Kurir Plus") && r.vehicle_type === "2WH"
    );
    const wDed4wh = calcWeeklySeg(
      "Dedicated",
      "4WH",
      (r) => r.contract_type === "Dedicated" && r.vehicle_type === "4WH"
    );
    const wMitra2wh = calcWeeklySeg(
      "Mitra",
      "2WH",
      (r) => r.contract_type === "Mitra" && r.vehicle_type === "2WH"
    );
    const wMitra4wh = calcWeeklySeg(
      "Mitra",
      "4WH",
      (r) => r.contract_type === "Mitra" && r.vehicle_type === "4WH"
    );

    const weeklyKpi2wh = computeCore2whAchievement(
      wDed2wh.achievement,
      wDed2wh.shifts,
      wKp2wh.achievement,
      wKp2wh.shifts
    );

    // 2. Monthly Productivity (Tanggal 1..Akhir Bulan)
    const allMonthActive = dedup(filterActive(allRaw, { start: monthStart, end: monthEnd }));
    const prodMonth = shouldExcludeNew
      ? allMonthActive.filter((r) => !isGracePeriodRecord(r))
      : allMonthActive;

    const getShiftTarget = (r: { date: string; contract_type: string; vehicle_type: string }): number => {
      const dKey = normalizeDateKey(r.date);
      const shiftWeekStart = /^\d{4}-\d{2}-\d{2}$/.test(dKey)
        ? getMondayYMD(dKey)
        : monthFallbackWeek;
      return resolveTarget(r, shiftWeekStart, appealMap, mondayMap);
    };

    const calcMonthlySeg = (
      contractType: string,
      vehicleType: string,
      predicate: (r: CourierRecord) => boolean
    ): HubSegmentDetail => {
      const segRecords = prodMonth.filter(predicate);
      const dayTargetMap = new Map<string, number>();
      for (const r of segRecords) {
        const dKey = normalizeDateKey(r.date);
        if (dKey && !dayTargetMap.has(dKey)) {
          dayTargetMap.set(
            dKey,
            getShiftTarget({ date: r.date, contract_type: contractType, vehicle_type: vehicleType })
          );
        }
      }
      const segTarget =
        dayTargetMap.size > 0
          ? Array.from(dayTargetMap.values()).reduce((s, v) => s + v, 0) / dayTargetMap.size
          : resolveTarget(
              { contract_type: contractType, vehicle_type: vehicleType },
              monthFallbackWeek,
              appealMap,
              mondayMap
            );

      return buildHubSegmentDetail(segRecords, segTarget);
    };

    const mDed2wh = calcMonthlySeg(
      "Dedicated",
      "2WH",
      (r) => r.contract_type === "Dedicated" && r.vehicle_type === "2WH"
    );
    const mKp2wh = calcMonthlySeg(
      "Kurir Plus",
      "2WH",
      (r) => r.contract_type.includes("Kurir Plus") && r.vehicle_type === "2WH"
    );
    const mDed4wh = calcMonthlySeg(
      "Dedicated",
      "4WH",
      (r) => r.contract_type === "Dedicated" && r.vehicle_type === "4WH"
    );
    const mMitra2wh = calcMonthlySeg(
      "Mitra",
      "2WH",
      (r) => r.contract_type === "Mitra" && r.vehicle_type === "2WH"
    );
    const mMitra4wh = calcMonthlySeg(
      "Mitra",
      "4WH",
      (r) => r.contract_type === "Mitra" && r.vehicle_type === "4WH"
    );

    const monthlyKpi2wh = computeCore2whAchievement(
      mDed2wh.achievement,
      mDed2wh.shifts,
      mKp2wh.achievement,
      mKp2wh.shifts
    );

    return {
      namaHub: hub,
      lastDataDate: latestDataDate,
      lastUploadAt: latestUploadAt,
      hasL15D,
      weekly: {
        kpi2wh: weeklyKpi2wh,
        kpi4wh: wDed4wh.achievement,
        dedicated2whAch: wDed2wh.achievement,
        kurirPlus2whAch: wKp2wh.achievement,
        dedicated4whAch: wDed4wh.achievement,
        shifts2wh: wDed2wh.shifts + wKp2wh.shifts,
        shifts4wh: wDed4wh.shifts,
        segments: {
          dedicated2wh: wDed2wh,
          kurirPlus2wh: wKp2wh,
          dedicated4wh: wDed4wh,
          mitra2wh: wMitra2wh,
          mitra4wh: wMitra4wh,
        },
      },
      monthly: {
        kpi2wh: monthlyKpi2wh,
        kpi4wh: mDed4wh.achievement,
        dedicated2whAch: mDed2wh.achievement,
        kurirPlus2whAch: mKp2wh.achievement,
        dedicated4whAch: mDed4wh.achievement,
        shifts2wh: mDed2wh.shifts + mKp2wh.shifts,
        shifts4wh: mDed4wh.shifts,
        segments: {
          dedicated2wh: mDed2wh,
          kurirPlus2wh: mKp2wh,
          dedicated4wh: mDed4wh,
          mitra2wh: mMitra2wh,
          mitra4wh: mMitra4wh,
        },
      },
    };
  });
}
