import { todayWIB, normalizeToYMD } from "./dateUtils";
import { batchGetSheetData, getSheetData } from "./sheets";
import { normalizeDateKey, normalizeRawSheetRows } from "./productivityService";

const DATA_CLOSING_SHEET = "DATA_CLOSING";
const STREAK_FULL_MONTH_DAYS = 30;
const RAW_SHEET = (hubName: string) => `RAW_${hubName.toUpperCase().trim()}`;

const MONTH_NAMES_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export interface HubConsistencyInfo {
  isConsistent: boolean;
  reason: string;
  currentStreakDays: number;
  completedMonthLabel: string | null;
}

const EMPTY_CONSISTENCY: HubConsistencyInfo = {
  isConsistent: false,
  reason: "",
  currentStreakDays: 0,
  completedMonthLabel: null,
};

function shiftYMD(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function isFullMonthPresent(
  dates: Set<string>,
  year: number,
  month1to12: number
): boolean {
  const days = getDaysInMonth(year, month1to12);
  const ym = `${year}-${String(month1to12).padStart(2, "0")}`;
  for (let day = 1; day <= days; day++) {
    if (!dates.has(`${ym}-${String(day).padStart(2, "0")}`)) {
      return false;
    }
  }
  return true;
}

function extractProductivityDates(rawRows: string[][], today: string): Set<string> {
  const normalized = normalizeRawSheetRows(rawRows);
  const dates = new Set<string>();
  for (let i = 1; i < normalized.length; i++) {
    const row = normalized[i];
    if (!row || !String(row[0] ?? "").trim()) continue;
    const ymd = normalizeDateKey(row[2]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd <= today) {
      dates.add(ymd);
    }
  }
  return dates;
}

function intersectDates(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const d of a) {
    if (b.has(d)) out.add(d);
  }
  return out;
}

function evaluateDatesForHub(
  completeDates: Set<string>,
  today: string
): HubConsistencyInfo {
  if (completeDates.size === 0) return EMPTY_CONSISTENCY;

  const yesterday = shiftYMD(today, -1);

  // Hitung streak harian berturut-turut dimana Closing + Productivity sama-sama terisi
  let streak = 0;
  let cursor = completeDates.has(today)
    ? today
    : completeDates.has(yesterday)
      ? yesterday
      : "";
  while (cursor && completeDates.has(cursor)) {
    streak++;
    cursor = shiftYMD(cursor, -1);
  }

  const [ty, tm, td] = today.split("-").map(Number);
  const daysCurrentMonth = getDaysInMonth(ty, tm);
  const prevYear = tm === 1 ? ty - 1 : ty;
  const prevMonth = tm === 1 ? 12 : tm - 1;

  let completedMonthLabel: string | null = null;
  if (td === daysCurrentMonth && isFullMonthPresent(completeDates, ty, tm)) {
    completedMonthLabel = `${MONTH_NAMES_ID[tm - 1]} ${ty}`;
  } else if (isFullMonthPresent(completeDates, prevYear, prevMonth)) {
    completedMonthLabel = `${MONTH_NAMES_ID[prevMonth - 1]} ${prevYear}`;
  }

  if (completedMonthLabel) {
    return {
      isConsistent: true,
      reason: `Closing & Productivity penuh 1 bulan (${completedMonthLabel})`,
      currentStreakDays: streak,
      completedMonthLabel,
    };
  }

  if (streak >= STREAK_FULL_MONTH_DAYS) {
    return {
      isConsistent: true,
      reason: `Closing & Productivity konsisten ${streak} hari berturut-turut`,
      currentStreakDays: streak,
      completedMonthLabel: null,
    };
  }

  return {
    isConsistent: false,
    reason: "",
    currentStreakDays: streak,
    completedMonthLabel: null,
  };
}

/**
 * Hitung status konsistensi 1 bulan penuh (wajib DATA_CLOSING + Productivity RAW_<HUB>)
 * untuk daftar Hub tertentu (atau seluruh Hub di DATA_CLOSING jika targetHubs tidak diberikan).
 */
export async function getConsistentHubsMap(
  targetHubs?: string[]
): Promise<Map<string, HubConsistencyInfo>> {
  const sheetData = await getSheetData(DATA_CLOSING_SHEET);
  const today = todayWIB();

  const targetKeyToDisplay = new Map<string, string>();
  if (targetHubs) {
    for (const h of targetHubs) {
      const clean = String(h ?? "").trim();
      if (clean) targetKeyToDisplay.set(clean.toLowerCase(), clean);
    }
    if (targetKeyToDisplay.size === 0) return new Map();
  }

  const closingDatesByHub = new Map<string, Set<string>>();
  const displayNameByHubKey = new Map<string, string>();

  for (let i = 1; i < sheetData.length; i++) {
    const r = sheetData[i];
    if (!r || r.length < 2) continue;
    const rawHub = String(r[1] ?? "").trim();
    const hubKey = rawHub.toLowerCase();
    if (!hubKey) continue;
    if (targetHubs && !targetKeyToDisplay.has(hubKey)) continue;

    const ymd = normalizeToYMD(r[0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || ymd > today) continue;

    if (!displayNameByHubKey.has(hubKey)) {
      displayNameByHubKey.set(hubKey, targetKeyToDisplay.get(hubKey) || rawHub);
    }

    let set = closingDatesByHub.get(hubKey);
    if (!set) {
      set = new Set<string>();
      closingDatesByHub.set(hubKey, set);
    }
    set.add(ymd);
  }

  if (closingDatesByHub.size === 0) return new Map();

  // Ambil sheet RAW_<HUB> sekaligus dalam 1 batchGetSheetData call
  const hubKeys = Array.from(closingDatesByHub.keys());
  const rawSheetNames = hubKeys.map((k) => RAW_SHEET(displayNameByHubKey.get(k)!));
  const prodSheetsMap = await batchGetSheetData(rawSheetNames);

  const result = new Map<string, HubConsistencyInfo>();
  for (let i = 0; i < hubKeys.length; i++) {
    const hubKey = hubKeys[i];
    const closingDates = closingDatesByHub.get(hubKey)!;
    const prodRows = prodSheetsMap.get(rawSheetNames[i]) || [];
    const prodDates = extractProductivityDates(prodRows, today);
    const completeDates = intersectDates(closingDates, prodDates);
    result.set(hubKey, evaluateDatesForHub(completeDates, today));
  }
  return result;
}

export async function getHubConsistency(
  hubName: string | null | undefined
): Promise<HubConsistencyInfo> {
  const clean = String(hubName ?? "").trim();
  if (!clean) return EMPTY_CONSISTENCY;
  const map = await getConsistentHubsMap([clean]);
  return map.get(clean.toLowerCase()) ?? EMPTY_CONSISTENCY;
}
