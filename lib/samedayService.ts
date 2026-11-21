import { getExternalSheetValues } from "./sheets";

const SAMEDAY_SPREADSHEET_ID = "1QHANApljOZGnnvRz0XX_FwFjBnnLTU1y-XARhnbASNE";
const SAMEDAY_SHEET_RANGE = "'STD SD'!A1:BK120";
const DEFAULT_CL_EMAIL = "rizal.firlani@spxexpress.com";

export interface SamedayPeriodColumn {
  index: number;
  key: string;
  label: string;
  benchmarkPct: number | null;
}

export interface SamedaySectionMetrics {
  mtd: number | null;
  l1m: number | null;
  wtd: number | null;
  l1w: number | null;
  l2w: number | null;
  l3w: number | null;
  daily: (number | null)[];
}

export interface SamedayHubRow {
  region: string;
  cluster: string;
  plEmail: string;
  clEmail: string;
  namaHub: string;
  geoRegion: string;
  province: string;
  tier: string;
  targetDelivering: number | null;
  targetDelivered: number | null;
  delivering: SamedaySectionMetrics;
  delivered: SamedaySectionMetrics;
  achievementMtd: number | null;
  achievementLastDate: number | null;
}

export interface MonitorSamedayData {
  spreadsheetTitle: string;
  clEmail: string;
  reportDate: string | null;
  latestDataDate: string | null;
  deliveringSummaryCols: SamedayPeriodColumn[];
  deliveringDailyCols: SamedayPeriodColumn[];
  deliveredSummaryCols: SamedayPeriodColumn[];
  deliveredDailyCols: SamedayPeriodColumn[];
  summary: {
    totalHubs: number;
    avgDeliveringMtd: number | null;
    avgDeliveringWtd: number | null;
    avgDeliveredMtd: number | null;
    avgDeliveredWtd: number | null;
    avgAchvMtd: number | null;
    avgAchvLastDate: number | null;
    achievedCount: number;
    belowTargetCount: number;
    tierCounts: Record<string, number>;
  };
  rows: SamedayHubRow[];
}

function parsePct(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/%/g, "").replace(/,/g, ".");
  if (!cleaned || cleaned === "-" || cleaned === "#N/A" || cleaned === "#DIV/0!") {
    return null;
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100) / 100;
}

function extractBenchmarkPct(header: string): number | null {
  const m = header.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const num = Number(m[1].replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function formatShortDayHeader(rawHeader: string, colIndex: number): string {
  const trimmed = rawHeader.trim();
  const shortMonths: Record<string, string> = {
    january: "Jan",
    february: "Feb",
    march: "Mar",
    april: "Apr",
    may: "May",
    june: "Jun",
    july: "Jul",
    august: "Aug",
    september: "Sep",
    october: "Oct",
    november: "Nov",
    december: "Dec",
  };
  // Ambil tanggal paling akhir di string header (mis. "19 Nov", "17 November", atau "11/19/2026")
  const textDateMatch = trimmed.match(/(\d{1,2})\s+([A-Za-z]+)\s*$/);
  if (textDateMatch) {
    const day = textDateMatch[1];
    const monRaw = textDateMatch[2].toLowerCase();
    const mon = shortMonths[monRaw] || textDateMatch[2].slice(0, 3);
    return `${day} ${mon}`;
  }
  const slashMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const mNum = parseInt(slashMatch[1], 10);
    const dNum = parseInt(slashMatch[2], 10);
    const monNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (mNum >= 1 && mNum <= 12) {
      return `${dNum} ${monNames[mNum - 1]}`;
    }
  }
  return `D${colIndex}`;
}

function findGroupStart(r1: string[], keyword: string, fallback: number): number {
  const idx = r1.findIndex((cell) => cell.trim().toUpperCase().includes(keyword));
  return idx >= 0 ? idx : fallback;
}

function parseGroupColumns(
  r2: string[],
  dataRows: string[][],
  startCol: number,
  endColExclusive: number
): {
  summaryCols: Map<string, SamedayPeriodColumn>;
  dailyCols: SamedayPeriodColumn[];
} {
  const summaryCols = new Map<string, SamedayPeriodColumn>();
  const dailyCols: SamedayPeriodColumn[] = [];
  const summaryKeys = ["MTD", "L1M", "WTD", "L1W", "L2W", "L3W"];

  for (let c = startCol; c < endColExclusive; c++) {
    const h = (r2[c] || "").trim();
    if (!h || /^L1M\s+vs\s+L3W$/i.test(h)) continue;

    // Lewati kolom kosong tanpa header & tanpa nilai data
    const hasAnyValue = dataRows.some((r) => (r[c] || "").trim() !== "");
    if (!h && !hasAnyValue) continue;

    const matchedKey = summaryKeys.find((k) => new RegExp(`\\b${k}\\b`, "i").test(h));
    if (matchedKey && !summaryCols.has(matchedKey)) {
      summaryCols.set(matchedKey, {
        index: c,
        key: matchedKey,
        label: matchedKey,
        benchmarkPct: extractBenchmarkPct(h),
      });
    } else if (/\d/.test(h)) {
      const label = formatShortDayHeader(h, dailyCols.length + 1);
      dailyCols.push({
        index: c,
        key: `day_${c}`,
        label,
        benchmarkPct: extractBenchmarkPct(h),
      });
    }
  }

  return { summaryCols, dailyCols };
}

function avgOf(nums: (number | null)[]): number | null {
  const valid = nums.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

export async function getMonitorSamedayData(options?: {
  skipCache?: boolean;
}): Promise<MonitorSamedayData> {
  const allRows = await getExternalSheetValues(SAMEDAY_SPREADSHEET_ID, SAMEDAY_SHEET_RANGE, {
    skipCache: options?.skipCache,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const r1 = allRows[0] || [];
  const r2 = allRows[1] || [];
  const rawBody = allRows.slice(2);

  const clFilter = (r1[0] || DEFAULT_CL_EMAIL).trim().toLowerCase();

  // Ekstrak tanggal report & tanggal data terbaru dari R2[2]
  const metaDates = ((r2[2] || "").match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []).map((s) => s.trim());
  const reportDate = metaDates[1] || metaDates[0] || null;
  const latestDataDate = metaDates[2] || metaDates[1] || null;

  const targetStart = findGroupStart(r1, "TARGET", 10);
  const deliveringStart = findGroupStart(r1, "DELIVERING", 13);
  const deliveredStart = findGroupStart(r1, "DELIVERED", 36);
  const achvStart = findGroupStart(r1, "ACHIEVEMENT", 59);

  // Filter awal hanya baris hub yang valid (LM Name tidak kosong & sesuai CL Email di A1 jika ada)
  const validBody = rawBody.filter((r) => {
    const lmName = (r[5] || "").trim();
    if (!lmName) return false;
    if (clFilter && (r[4] || "").trim()) {
      return (r[4] || "").trim().toLowerCase() === clFilter;
    }
    return true;
  });

  const delivGroup = parseGroupColumns(r2, validBody, deliveringStart, deliveredStart);
  const delvdGroup = parseGroupColumns(r2, validBody, deliveredStart, achvStart);

  const summaryOrder = ["MTD", "L1M", "WTD", "L1W", "L2W", "L3W"];
  const toOrderedList = (m: Map<string, SamedayPeriodColumn>) =>
    summaryOrder.map((k) => m.get(k)).filter((x): x is SamedayPeriodColumn => Boolean(x));

  const readSection = (
    row: string[],
    group: { summaryCols: Map<string, SamedayPeriodColumn>; dailyCols: SamedayPeriodColumn[] }
  ): SamedaySectionMetrics => {
    const getVal = (k: string) => {
      const col = group.summaryCols.get(k);
      return col ? parsePct(row[col.index]) : null;
    };
    return {
      mtd: getVal("MTD"),
      l1m: getVal("L1M"),
      wtd: getVal("WTD"),
      l1w: getVal("L1W"),
      l2w: getVal("L2W"),
      l3w: getVal("L3W"),
      daily: group.dailyCols.map((c) => parsePct(row[c.index])),
    };
  };

  // Cari kolom achievement MTD & LAST DATE
  let achvMtdIdx = achvStart;
  let achvLastIdx = achvStart + 1;
  for (let c = achvStart; c < Math.max(r2.length, achvStart + 4); c++) {
    const h = (r2[c] || "").trim().toUpperCase();
    if (h === "MTD") achvMtdIdx = c;
    if (h === "LAST DATE") achvLastIdx = c;
  }

  const rows: SamedayHubRow[] = validBody.map((r) => ({
    region: (r[1] || "").trim(),
    cluster: (r[2] || "").trim(),
    plEmail: (r[3] || "").trim(),
    clEmail: (r[4] || "").trim(),
    namaHub: (r[5] || "").trim(),
    geoRegion: (r[6] || "").trim(),
    province: (r[7] || "").trim(),
    tier: (r[9] || "").trim() || "-",
    targetDelivering: parsePct(r[targetStart]),
    targetDelivered: parsePct(r[targetStart + 1]),
    delivering: readSection(r, delivGroup),
    delivered: readSection(r, delvdGroup),
    achievementMtd: parsePct(r[achvMtdIdx]),
    achievementLastDate: parsePct(r[achvLastIdx]),
  }));

  const tierCounts: Record<string, number> = {};
  let achievedCount = 0;
  let belowTargetCount = 0;
  for (const r of rows) {
    tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
    const refDelivered = r.delivered.mtd;
    const refTarget = r.targetDelivered;
    if (refDelivered !== null && refTarget !== null) {
      if (refDelivered >= refTarget) achievedCount++;
      else belowTargetCount++;
    }
  }

  return {
    spreadsheetTitle: "NEW LM JATIM 8 · STD SD",
    clEmail: clFilter || DEFAULT_CL_EMAIL,
    reportDate,
    latestDataDate,
    deliveringSummaryCols: toOrderedList(delivGroup.summaryCols),
    deliveringDailyCols: delivGroup.dailyCols,
    deliveredSummaryCols: toOrderedList(delvdGroup.summaryCols),
    deliveredDailyCols: delvdGroup.dailyCols,
    summary: {
      totalHubs: rows.length,
      avgDeliveringMtd: avgOf(rows.map((r) => r.delivering.mtd)),
      avgDeliveringWtd: avgOf(rows.map((r) => r.delivering.wtd)),
      avgDeliveredMtd: avgOf(rows.map((r) => r.delivered.mtd)),
      avgDeliveredWtd: avgOf(rows.map((r) => r.delivered.wtd)),
      avgAchvMtd: avgOf(rows.map((r) => r.achievementMtd)),
      avgAchvLastDate: avgOf(rows.map((r) => r.achievementLastDate)),
      achievedCount,
      belowTargetCount,
      tierCounts,
    },
    rows,
  };
}
