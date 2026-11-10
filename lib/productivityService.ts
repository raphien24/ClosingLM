import { getSheetData, batchGetSheetData, appendRow, findRows, updateRow, ensureSheet, appendRows, updateRows } from "./sheets";
import {
  CourierRecord,
  CourierScheduleRow,
  ProductivityKpi,
  TargetAppeal,
  WeeklyThresholdSegment,
  WeeklyMitraSegment,
  WeeklyActionPlan,
  WeeklyActionPlanItem,
  getDefaultTarget,
} from "@/types/productivity";
import { format, startOfWeek } from "date-fns";
import { formatDateForSheet, serialToYMD } from "./dateUtils";
import { parseSheetNumber } from "./utils";
import { normalizeContractType, normalizeVehicleType } from "./fmsParser";

// ── Sheet name helpers ───────────────────────────────────────
// Satu sheet per hub: RAW_SOKO HUB, TARGETS_SOKO HUB, dll.
const RAW_SHEET    = (hubName: string) => `RAW_${hubName.toUpperCase().trim()}`;
const TARGETS_SHEET = (hubName: string) => `TARGETS_${hubName.toUpperCase().trim()}`;

// Header untuk sheet RAW per hub
const RAW_HEADER = [
  "district","courier_id","courier_name","date","driver_name",
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
  DISTRICT:0, COURIER_ID:1, COURIER_NAME:2, DATE:3, DRIVER_NAME:4,
  CONTRACT:5, VEHICLE:6, ZONE:7, ASSIGNED:8, ASSIGNED_TARGET:9,
  ASSIGNED_PROGRESS:10, DELIVERY_PROGRESS:11, HANDED_OVER:12,
  DELIVERED:13, DELIVERED_PCT:14, DELIVERING_COUNT:15,
  DELIVERING_PCT:16, FAILED:17, FAILED_PCT:18, STUCK:19, ONHOLD:20,
  SUBMITTED_AT:21, SUBMITTED_BY:22,
};

// ── Index kolom TARGETS sheet ────────────────────────────────
const TCOL = {
  WEEK_START:0, CONTRACT:1, VEHICLE:2, TARGET:3, CREATED_AT:4, CREATED_BY:5,
};

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
    district:            row[COL.DISTRICT]          || "",
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
  const createdAt = new Date().toISOString();
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
    const d = parseDate(r.date);
    if (!d) continue;
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 1 && r.assigned_target && r.assigned_target > 0) {
      const weekMondayStr = format(d, "yyyy-MM-dd");
      const key = `${weekMondayStr}_${r.contract_type}_${r.vehicle_type}`;
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
  await ensureSheet(RAW_SHEET(hubName), RAW_HEADER);
  const data = await getSheetData(RAW_SHEET(hubName));
  return data.slice(1)
    .filter((row) => row && row.length > 1 && row[COL.COURIER_ID])
    .map((row) => rowToRecord(row, hubName));
}

// ── KPI Metrics ──────────────────────────────────────────────

export async function getKpiMetrics(
  hubName: string,
  dateRange: { start: Date; end: Date },
  weekStart: string,
  filters: { contract?: string; vehicle?: string; excludeNew?: boolean } = {}
): Promise<ProductivityKpi> {
  const [allRaw, appeals] = await Promise.all([
    getRawData(hubName),
    getTargetAppeals(hubName),
  ]);
  const appealMap     = buildAppealMap(appeals);
  const mondayMap     = buildMondayTargetMap(allRaw);
  const allWeekActive = dedup(filterActive(allRaw, dateRange));

  const { hasL15D, uniqueDaysCount } = checkHubL15D(allRaw);
  const firstJoinMap = buildCourierFirstJoinMap(allRaw);

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

  // Daily Active Rate (Static: selalu 2WH · Dedicated + Kurir Plus, TETAP menghitung kurir baru)
  const da = allWeekActive.filter(
    (r) =>
      r.vehicle_type === "2WH" &&
      (r.contract_type === "Dedicated" || r.contract_type.includes("Kurir Plus"))
  );
  const uniqueHeadcount  = new Set(da.map((r) => r.courier_id)).size;
  const operatingDays    = new Set(
    da.map((r) => normalizeDateKey(r.date))
  ).size || 6;
  const dailyActiveRate  = uniqueHeadcount > 0 && operatingDays > 0
    ? (da.length / (uniqueHeadcount * operatingDays)) * 100 : 0;

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

  const kpi2wAchievement =
    dedicated2wh.shifts > 0 && kurirPlus2wh.shifts > 0
      ? Math.round(((dedicated2wh.achievement + kurirPlus2wh.achievement) / 2) * 10) / 10
      : dedicated2wh.shifts > 0
      ? dedicated2wh.achievement
      : kurirPlus2wh.achievement;

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
    dailyActive: {
      value: Math.round(dailyActiveRate*10)/10,
      activeShifts: da.length, uniqueHeadcount, operatingDays,
      avgCouriersPerDay: operatingDays>0 ? Math.round((da.length/operatingDays)*10)/10 : 0,
    },
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
  };
}

// ── Courier Schedule Table ───────────────────────────────────

export async function getCourierSchedule(
  hubName: string,
  dateRange: { start: Date; end: Date },
  weekStart: string,
  filters: { contract?:string; vehicle?:string; zone?:string; excludeNew?: boolean } = {}
): Promise<CourierScheduleRow[]> {
  const [allRaw, appeals] = await Promise.all([
    getRawData(hubName),
    getTargetAppeals(hubName),
  ]);
  const appealMap = buildAppealMap(appeals);
  const mondayMap = buildMondayTargetMap(allRaw);
  const active    = dedup(filterActive(allRaw, dateRange));

  const firstJoinMap = buildCourierFirstJoinMap(allRaw);

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

    return {
      ...row,
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
  weeklyBreakdown: { week: string; avgProductivity: number; shifts: number }[];
  missingTargetWeeks: string[];
  hasL15D?: boolean;
  dataDaysCount?: number;
  excludedNewCount?: number;
}> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const monthEnd   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const weekStartStr = format(startOfWeek(monthStart, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [allRaw, appeals] = await Promise.all([
    getRawData(hubName),
    getTargetAppeals(hubName),
  ]);
  const appealMap = buildAppealMap(appeals);
  const mondayMap = buildMondayTargetMap(allRaw);

  const { hasL15D, uniqueDaysCount } = checkHubL15D(allRaw);
  const firstJoinMap = buildCourierFirstJoinMap(allRaw);

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
    const d = parseDate(r.date);
    const shiftWeekStart = d
      ? format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd")
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

    return {
      avgProductivity: Math.round(avgProd * 10) / 10,
      target: Math.round(segTarget * 10) / 10,
      threshold75: Math.round(thr75 * 10) / 10,
      achievement: Math.round(ach * 10) / 10,
      totalShifts,
      totalDelivered,
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

  const core2whAchievement =
    dedicated2wh.totalShifts > 0 && kurirPlus2wh.totalShifts > 0
      ? Math.round(((dedicated2wh.achievement + kurirPlus2wh.achievement) / 2) * 10) / 10
      : dedicated2wh.totalShifts > 0
      ? dedicated2wh.achievement
      : kurirPlus2wh.achievement;

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

  // Bangun Daily Breakdown
  const dayMap = new Map<string, { dateObj: Date; delivered: number; shifts: number; targetSum: number }>();
  for (const r of active) {
    const dKey = normalizeDateKey(r.date);
    const dObj = parseDate(r.date);
    if (!dKey || !dObj) continue;
    const prev = dayMap.get(dKey) || { dateObj: dObj, delivered: 0, shifts: 0, targetSum: 0 };
    prev.delivered += r.delivered || 0;
    prev.shifts += 1;
    prev.targetSum += getShiftTarget(r);
    dayMap.set(dKey, prev);
  }

  const sortedDateKeys = Array.from(dayMap.keys()).sort((a, b) => a.localeCompare(b));
  const dailyBreakdown: DailyBreakdownRow[] = sortedDateKeys.map((dKey) => {
    const item = dayMap.get(dKey)!;
    const prod = item.shifts > 0 ? item.delivered / item.shifts : 0;
    const tgt  = item.shifts > 0 ? item.targetSum / item.shifts : 0;
    const ach  = tgt > 0 ? Math.min(100, (prod / tgt) * 100) : 0;
    return {
      dateKey: dKey,
      date: format(item.dateObj, "MM/dd/yyyy"),
      dayName: ID_DAY_NAMES[item.dateObj.getDay()],
      delivered: item.delivered,
      shifts: item.shifts,
      productivity: Math.round(prod * 10) / 10,
      target: Math.round(tgt * 10) / 10,
      achievement: Math.round(ach * 10) / 10,
    };
  });

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

  const uniqueHeadcount = new Set(allMonthCouriers.map((r) => r.courier_id)).size;
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
    const d = parseDate(r.date);
    if (!d) return;
    const wk = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    if (!weekMap[wk]) weekMap[wk] = { delivered: 0, shifts: 0 };
    weekMap[wk].delivered += r.delivered || 0;
    weekMap[wk].shifts++;
  });

  const sortedWeeks = Object.keys(weekMap).sort((a, b) => a.localeCompare(b));
  const missingTargetWeeks = sortedWeeks.filter(
    (wk) => !hasWeekTarget(wk, appealMap, mondayMap, { contract, vehicle })
  );

  return {
    totalDelivered,
    totalShifts,
    avgProductivity: Math.round(avgProductivity * 10) / 10,
    target: Math.round(avgTarget * 10) / 10,
    progress: Math.round(progress * 10) / 10,
    operatingDays,
    uniqueHeadcount,
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
  await ensureSheet(RAW_SHEET(hubName), RAW_HEADER);
  const submittedAt = new Date().toISOString();
  const row = [
    record.district, record.courier_id, record.courier_name, record.date,
    record.driver_name, record.contract_type, record.vehicle_type, record.zone_id,
    record.assigned??"", record.assigned_target??"",
    record.assigned_progress??"", record.delivery_progress??"",
    record.handed_over??"", record.delivered??"", record.delivered_pct??"",
    record.delivering_count??"", record.delivering_pct??"",
    record.failed_delivery??"", record.failed_delivery_pct??"",
    record.stuck_at_delivering??"", record.onhold??"",
    submittedAt, userEmail,
  ];

  const existing = await findRows(RAW_SHEET(hubName), [
    { columnIndex: COL.COURIER_ID, value: record.courier_id },
    { columnIndex: COL.DATE,       value: record.date },
  ]);

  if (existing.length > 0) {
    await updateRow(RAW_SHEET(hubName), existing[0], row);
    return { overwritten: true };
  } else {
    await appendRow(RAW_SHEET(hubName), row);
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

  await ensureSheet(RAW_SHEET(hubName), RAW_HEADER);
  const existing = await getSheetData(RAW_SHEET(hubName));

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

// ── Batch save: append-only, duplicate di-skip ──────────────
// Logic:
//   1. Baca existing sekali (1 API call) → bangun Set key duplicate
//   2. Filter record: hanya yang belum ada di sheet
//   3. appendRows sekali ke bawah (1 API call)
//   Tidak ada updateRow → tidak ada risiko overwrite row yang salah

export async function saveCourierRecordsBatch(
  records: Omit<CourierRecord, "nama_hub" | "submitted_at" | "submitted_by">[],
  hubName: string,
  userEmail: string
): Promise<{ saved: number; skipped: number }> {
  if (records.length === 0) return { saved: 0, skipped: 0 };

  await ensureSheet(RAW_SHEET(hubName), RAW_HEADER);
  const submittedAt = new Date().toISOString();

  // 1. Baca existing sekali
  const existing = await getSheetData(RAW_SHEET(hubName));

  // Bangun Set key: "courier_id_YYYY-MM-DD"
  const existingKeys = new Set<string>();
  // Bangun profil kurir untuk melengkapi data susulan
  const courierProfiles = new Map<string, { zone_id: string; assigned_target: number | null }>();

  for (let i = 1; i < existing.length; i++) {
    const row = existing[i];
    if (!row || !row[COL.COURIER_ID]) continue;
    const cid = String(row[COL.COURIER_ID]).trim();

    // Profil kurir
    const z   = String(row[COL.ZONE]            ?? "").trim();
    const tgt = n(row[COL.ASSIGNED_TARGET]);
    const prev = courierProfiles.get(cid);
    if (!prev) {
      courierProfiles.set(cid, { zone_id: z, assigned_target: tgt });
    } else {
      if (z)        prev.zone_id        = z;
      if (tgt && tgt > 0) prev.assigned_target = tgt;
    }

    // Key duplikat
    if (row[COL.DATE]) {
      existingKeys.add(`${cid}_${normalizeDateKey(String(row[COL.DATE]))}`);
    }
  }

  // 2. Filter: hanya record yang belum ada (duplicate di-skip)
  const toAppend: (string | number | null)[][] = [];

  for (const rawRecord of records) {
    const cid         = rawRecord.courier_id.trim();
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

    const key = `${cid}_${normalizeDateKey(enriched.date)}`;
    if (existingKeys.has(key)) continue; // duplicate → skip

    toAppend.push(buildRow(enriched, hubName, submittedAt, userEmail));
  }

  // 3. Append semua sekaligus ke bawah (1 API call)
  if (toAppend.length > 0) await appendRows(RAW_SHEET(hubName), toAppend);

  return {
    saved:   toAppend.length,
    skipped: records.length - toAppend.length,
  };
}

function buildRow(
  record: Omit<CourierRecord, "nama_hub" | "submitted_at" | "submitted_by">,
  hubName: string,
  submittedAt: string,
  userEmail: string
): (string | number | null)[] {
  return [
    record.district,
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

  const targetDateObj = new Date(targetDateYMD + "T00:00:00+07:00");
  const weekStart = format(
    startOfWeek(targetDateObj, { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );

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
    const rawRows = batchData.get(RAW_SHEET(hub)) || [];
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
