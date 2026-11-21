import { NextRequest } from "next/server";
import { auth } from "./auth";
import { isOwnerAdminEmail } from "./authConstants";
import { normalizeToYMD, parseTimestamp, todayWIB } from "./dateUtils";
import { getDailyProductivityByHubs, HubDailyProductivity } from "./productivityService";
import { getSeaTalkWebhookUrl, getSetting, setSetting } from "./settingsService";
import { getSheetData } from "./sheets";
import { getAllHubs, getAllUserMappings, splitHubList } from "./userMapping";
import { detectAnomalies, formatDate, formatNumber, rowToClosingData } from "./utils";
import {
  DailySummaryHubRow,
  generateDailySummaryImageBase64,
} from "./seatalkSummaryImage";
import { ClosingData } from "@/types/closing";

const DATA_CLOSING_SHEET = "DATA_CLOSING";
const SEATALK_MAX_TEXT_BYTES = 3800;
const LAST_REMINDER_KEY = "seatalk_last_reminder_ymd";
const LAST_SUMMARY_KEY = "seatalk_last_summary_ymd";

const EXPECTED_API_KEY =
  process.env.AUTO_UPLOAD_API_KEY || "spx-soko-jtt08-secure-2026";

export function shiftYMD(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/**
 * Validasi otorisasi untuk cron endpoints:
 * Menerima x-api-key, Authorization: Bearer <CRON_SECRET>, ?api_key=..., atau sesi Owner login.
 */
export async function isAuthorizedCronOrOwner(req: NextRequest): Promise<boolean> {
  const apiKey =
    req.headers.get("x-api-key") ||
    req.nextUrl.searchParams.get("api_key") ||
    "";
  if (apiKey && apiKey === EXPECTED_API_KEY) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const session = await auth();
  if (session?.user?.email && isOwnerAdminEmail(session.user.email)) {
    return true;
  }
  return false;
}

interface HubPicInfo {
  emails: string[];
  names: string[];
}

async function buildHubPicMap(): Promise<Map<string, HubPicInfo>> {
  const mappings = await getAllUserMappings();
  const map = new Map<string, { emails: Set<string>; names: Set<string> }>();

  for (const m of mappings) {
    if (m.status !== "active" || !m.email) continue;
    const hubs = splitHubList(m.nama_hub);
    for (const h of hubs) {
      const key = h.toLowerCase().trim();
      if (!key) continue;
      let entry = map.get(key);
      if (!entry) {
        entry = { emails: new Set<string>(), names: new Set<string>() };
        map.set(key, entry);
      }
      entry.emails.add(m.email.trim().toLowerCase());
      if (m.nama_user?.trim()) {
        entry.names.add(m.nama_user.trim());
      }
    }
  }

  const out = new Map<string, HubPicInfo>();
  for (const [k, v] of map.entries()) {
    out.set(k, {
      emails: Array.from(v.emails),
      names: Array.from(v.names),
    });
  }
  return out;
}

function formatPicMentions(info?: HubPicInfo): string {
  if (!info || info.emails.length === 0) return "";
  return " " + info.emails.map((e) => `@${e}`).join(" ");
}

function splitUtf8Chunks(text: string, maxBytes: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (Buffer.byteLength(candidate, "utf8") <= maxBytes) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      if (Buffer.byteLength(line, "utf8") <= maxBytes) {
        current = line;
      } else {
        chunks.push(Buffer.from(line, "utf8").subarray(0, maxBytes).toString("utf8"));
        current = "";
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function sendSeaTalkImageMessage(
  webhookUrl: string,
  base64Content: string
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag: "image",
      image_base64: {
        content: base64Content,
      },
    }),
  });

  const text = await res.text();
  let json: { code?: number; message?: string } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Abaikan response non-JSON
  }

  if (!res.ok || (json?.code !== undefined && json.code !== 0)) {
    throw new Error(
      `SeaTalk webhook image error (${res.status}): ${json?.message || text || "Unknown"}`
    );
  }
}

export async function sendSeaTalkTextMessage(
  webhookUrl: string,
  content: string
): Promise<{ ok: boolean }> {
  const chunks = splitUtf8Chunks(content, SEATALK_MAX_TEXT_BYTES);

  for (let i = 0; i < chunks.length; i++) {
    // Jangan kirim mentioned_email_list agar SeaTalk tidak menaruh daftar @mention di bagian atas pesan;
    // mention @email sudah ditampilkan inline tepat di samping nama masing-masing Hub.
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag: "text",
        text: {
          content: chunks[i],
          at_all: false,
        },
      }),
    });

    const text = await res.text();
    let json: { code?: number; message?: string } | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Abaikan response non-JSON
    }

    if (!res.ok || (json?.code !== undefined && json.code !== 0)) {
      throw new Error(
        `SeaTalk webhook error (${res.status}): ${json?.message || text || "Unknown"}`
      );
    }
  }

  return { ok: true };
}

async function loadClosingSnapshotForDate(targetDate: string): Promise<{
  allHubs: string[];
  closingByHub: Map<string, ClosingData>;
  prodByHub: Map<string, HubDailyProductivity>;
  picByHub: Map<string, HubPicInfo>;
}> {
  const [sheetData, allHubs, picByHub] = await Promise.all([
    getSheetData(DATA_CLOSING_SHEET, { skipCache: true }),
    getAllHubs(),
    buildHubPicMap(),
  ]);

  const closingByHub = new Map<string, ClosingData>();
  for (let i = 1; i < sheetData.length; i++) {
    const r = sheetData[i];
    if (!r || r.length < 2) continue;
    if (normalizeToYMD(r[0]) !== targetDate) continue;
    const parsed = rowToClosingData(r);
    const key = parsed.nama_hub.toLowerCase().trim();
    if (!key) continue;

    const prev = closingByHub.get(key);
    if (
      !prev ||
      (parseTimestamp(parsed.submitted_at)?.getTime() ?? 0) >=
        (parseTimestamp(prev.submitted_at)?.getTime() ?? 0)
    ) {
      closingByHub.set(key, parsed);
    }
  }

  const prodByHub = await getDailyProductivityByHubs(allHubs, targetDate).catch(
    () => new Map<string, HubDailyProductivity>()
  );

  return { allHubs, closingByHub, prodByHub, picByHub };
}

function hasAnyProductivityValue(prod?: HubDailyProductivity): boolean {
  if (!prod) return false;
  return (
    prod.prod_2w_dedicated !== null ||
    prod.prod_2w_kurir_plus !== null ||
    prod.prod_4w_dedicated !== null ||
    prod.prod_2w_mitra !== null ||
    prod.prod_4w_mitra !== null
  );
}

/**
 * Job 1 (23:20 WIB): Reminder ke SeaTalk men-tag PIC Hub yang belum closing hari ini.
 */
export async function runClosingReminderJob(options?: {
  targetDate?: string;
  force?: boolean;
  dryRun?: boolean;
}) {
  const targetDate = normalizeToYMD(options?.targetDate || todayWIB());

  if (!options?.force && !options?.dryRun) {
    const lastSent = await getSetting(LAST_REMINDER_KEY, { skipCache: true });
    if (lastSent?.value === targetDate) {
      return {
        skipped: true,
        reason: `Reminder untuk tanggal ${targetDate} sudah pernah dikirim.`,
        targetDate,
      };
    }
  }

  const webhookUrl = await getSeaTalkWebhookUrl({ skipCache: true });
  if (!webhookUrl && !options?.dryRun) {
    throw new Error("Webhook SeaTalk belum dikonfigurasi di menu Settings.");
  }

  const { allHubs, closingByHub, picByHub } =
    await loadClosingSnapshotForDate(targetDate);

  const missingHubs: { hub: string; picText: string; emails: string[] }[] = [];
  let closedCount = 0;
  const mentionEmails = new Set<string>();

  for (const hubName of allHubs) {
    const key = hubName.toLowerCase().trim();
    const row = closingByHub.get(key);
    if (row?.submitted_at) {
      closedCount++;
    } else {
      const pic = picByHub.get(key);
      for (const em of pic?.emails || []) mentionEmails.add(em);
      missingHubs.push({
        hub: hubName,
        picText: formatPicMentions(pic),
        emails: pic?.emails || [],
      });
    }
  }

  missingHubs.sort((a, b) => a.hub.localeCompare(b.hub, "id"));

  const lines: string[] =
    missingHubs.length === 0
      ? [
          `✅ REMINDER CLOSING 23:20 WIB — JTT08`,
          `Tanggal: ${formatDate(targetDate)}`,
          `Selamat! Semua ${allHubs.length} Hub sudah mengisi Closing hari ini.`,
        ]
      : [
          `⏰ REMINDER CLOSING HARIAN (23:20 WIB) — JTT08`,
          `Tanggal: ${formatDate(targetDate)}`,
          `Progres Saat Ini: ${closedCount}/${allHubs.length} Hub Sudah Closing • ${missingHubs.length} Hub Belum Closing`,
          "",
          `⚠️ HUB BELUM CLOSING (Mohon segera submit sebelum 23:59 WIB):`,
          ...missingHubs.map((item, idx) => `${idx + 1}. ${item.hub}${item.picText}`),
        ];

  const messageText = lines.join("\n");
  const mentionList = Array.from(mentionEmails);

  if (!options?.dryRun) {
    await sendSeaTalkTextMessage(webhookUrl, messageText);
    await setSetting({
      key: LAST_REMINDER_KEY,
      value: targetDate,
      updatedBy: "cron-reminder-2320",
    });
  }

  return {
    skipped: false,
    targetDate,
    totalHubs: allHubs.length,
    closedCount,
    missingCount: missingHubs.length,
    mentionedCount: mentionList.length,
    preview: messageText,
  };
}

/**
 * Job 2 (00:05 WIB): Summary otomatis keseluruhan Hub (kemarin), termasuk mention PIC untuk:
 * - Belum mengisi report Closing
 * - Report tidak lengkap / ada kolom kosong (termasuk Productivity kosong)
 * - Masih ada gantungan Delivering (fleet_delivering > 0)
 * - Masih ada gantungan On-Hold (fleet_oh_volume > 0)
 */
export async function runDailySummaryJob(options?: {
  targetDate?: string;
  force?: boolean;
  dryRun?: boolean;
}) {
  // Jam 00:05 WIB merangkum operasional hari kemarin (H-1) secara default
  const defaultDate = shiftYMD(todayWIB(), -1);
  const targetDate = normalizeToYMD(options?.targetDate || defaultDate);

  if (!options?.force && !options?.dryRun) {
    const lastSent = await getSetting(LAST_SUMMARY_KEY, { skipCache: true });
    if (lastSent?.value === targetDate) {
      return {
        skipped: true,
        reason: `Summary untuk tanggal ${targetDate} sudah pernah dikirim.`,
        targetDate,
      };
    }
  }

  const webhookUrl = await getSeaTalkWebhookUrl({ skipCache: true });
  if (!webhookUrl && !options?.dryRun) {
    throw new Error("Webhook SeaTalk belum dikonfigurasi di menu Settings.");
  }

  const { allHubs, closingByHub, prodByHub, picByHub } =
    await loadClosingSnapshotForDate(targetDate);

  let closedCount = 0;
  let totalVolumeAll = 0;
  let totalDeliveredAll = 0;
  let totalBacklogAll = 0;
  let totalExpediteAll = 0;
  let totalDeliveringAll = 0;
  let totalOhVolAll = 0;
  let prodFilledCount = 0;
  let manualHubCount = 0;

  const hubRows: DailySummaryHubRow[] = [];
  const missingClosing: { hub: string; picText: string; hasProd: boolean }[] = [];
  const incompleteOrEmpty: { hub: string; picText: string; note: string }[] = [];
  const deliveringGantungan: { hub: string; picText: string; count: number }[] = [];
  const onholdGantungan: { hub: string; picText: string; vol: number; total: number }[] = [];

  const mentionEmails = new Set<string>();
  const addHubPics = (hubKey: string) => {
    const pic = picByHub.get(hubKey);
    for (const em of pic?.emails || []) mentionEmails.add(em);
  };

  for (const hubName of allHubs) {
    const key = hubName.toLowerCase().trim();
    const row = closingByHub.get(key);
    const prod = prodByHub.get(key);
    const hasProd = hasAnyProductivityValue(prod);
    if (hasProd) prodFilledCount++;

    const pic = picByHub.get(key);
    const picText = formatPicMentions(pic);

    if (!row || !row.submitted_at) {
      addHubPics(key);
      missingClosing.push({ hub: hubName, picText, hasProd });
      hubRows.push({
        hub: hubName,
        closingStatus: "Belum",
        missingCols: 0,
        hasProd,
        volume: 0,
        delivered: 0,
        delivering: 0,
        ohVol: 0,
        backlog: 0,
      });
      continue;
    }

    closedCount++;
    if ((row.manual_fields?.length || 0) > 0) {
      manualHubCount++;
    }

    const vol =
      (row.in_hub_transported || 0) +
      (row.in_hub_received || 0) +
      (row.in_hub_assigning || 0) +
      (row.in_hub_assigned || 0) +
      (row.fleet_delivering || 0) +
      (row.fleet_delivered || 0) +
      (row.fleet_oh_volume || 0);

    totalVolumeAll += vol;
    totalDeliveredAll += row.fleet_delivered || 0;
    totalBacklogAll += row.backlog_total || 0;
    totalExpediteAll += row.total_expedite || 0;
    totalDeliveringAll += row.fleet_delivering || 0;
    totalOhVolAll += row.fleet_oh_volume || 0;

    // Cek report kosong / kurang (kolom closing wajib kosong atau belum upload productivity)
    const anomalies = detectAnomalies(row);
    hubRows.push({
      hub: hubName,
      closingStatus: anomalies.length > 0 ? "Kurang" : "OK",
      missingCols: anomalies.length,
      hasProd,
      volume: vol,
      delivered: row.fleet_delivered || 0,
      delivering: row.fleet_delivering || 0,
      ohVol: row.fleet_oh_volume || 0,
      backlog: row.backlog_total || 0,
    });
    const missingNotes: string[] = [];
    if (anomalies.length > 0) {
      missingNotes.push(`Closing belum lengkap (${anomalies.length} kolom)`);
    }
    if (!hasProd) {
      missingNotes.push("Productivity kosong");
    }
    if (missingNotes.length > 0) {
      addHubPics(key);
      incompleteOrEmpty.push({
        hub: hubName,
        picText,
        note: missingNotes.join(" & "),
      });
    }

    if ((row.fleet_delivering || 0) > 0) {
      addHubPics(key);
      deliveringGantungan.push({
        hub: hubName,
        picText,
        count: row.fleet_delivering || 0,
      });
    }

    if ((row.fleet_oh_volume || 0) > 0) {
      addHubPics(key);
      onholdGantungan.push({
        hub: hubName,
        picText,
        vol: row.fleet_oh_volume || 0,
        total: row.fleet_oh_total || row.fleet_oh_volume || 0,
      });
    }
  }

  hubRows.sort((a, b) => a.hub.localeCompare(b.hub, "id"));
  missingClosing.sort((a, b) => a.hub.localeCompare(b.hub, "id"));
  incompleteOrEmpty.sort((a, b) => a.hub.localeCompare(b.hub, "id"));
  deliveringGantungan.sort((a, b) => b.count - a.count || a.hub.localeCompare(b.hub, "id"));
  onholdGantungan.sort((a, b) => b.vol - a.vol || a.hub.localeCompare(b.hub, "id"));

  const backlogPctAll =
    totalVolumeAll > 0 ? ((totalBacklogAll / totalVolumeAll) * 100).toFixed(1) : "0.0";

  const lines: string[] = [
    `📊 DAILY SUMMARY CLOSING REPORT (00:05 WIB) — JTT08`,
    `Tanggal Operasional: ${formatDate(targetDate)}`,
    `Status Submit: ${closedCount}/${allHubs.length} Hub Closing • ${prodFilledCount}/${allHubs.length} Hub Productivity`,
    `Total Keseluruhan: Vol ${formatNumber(totalVolumeAll)} | Delvd ${formatNumber(totalDeliveredAll)} | Backlog ${formatNumber(totalBacklogAll)} (${backlogPctAll}%) | Expedite ${formatNumber(totalExpediteAll)} | OH Vol ${formatNumber(totalOhVolAll)}`,
    "",
    `❌ BELUM MENGISI REPORT (${missingClosing.length} Hub):`,
    ...(missingClosing.length > 0
      ? missingClosing.map(
          (h, idx) =>
            `${idx + 1}. ${h.hub}${h.picText}${h.hasProd ? " (Closing kosong)" : " (Closing & Productivity kosong)"}`
        )
      : ["- Semua Hub sudah mengisi Closing -"]),
    "",
    `⚠️ REPORT KOSONG / BELUM LENGKAP (${incompleteOrEmpty.length} Hub):`,
    ...(incompleteOrEmpty.length > 0
      ? incompleteOrEmpty.map((h, idx) => `${idx + 1}. ${h.hub}${h.picText} [${h.note}]`)
      : ["- Semua Hub yang closing datanya lengkap termasuk Productivity -"]),
    "",
    `🚚 MASIH ADA GANTUNGAN DELIVERING (${deliveringGantungan.length} Hub):`,
    ...(deliveringGantungan.length > 0
      ? deliveringGantungan.map(
          (h, idx) => `${idx + 1}. ${h.hub}${h.picText}: ${formatNumber(h.count)} pkt`
        )
      : ["- Clear, tidak ada gantungan Delivering (0) -"]),
    "",
    `⏸️ MASIH ADA GANTUNGAN ON-HOLD (${onholdGantungan.length} Hub):`,
    ...(onholdGantungan.length > 0
      ? onholdGantungan.map(
          (h, idx) =>
            `${idx + 1}. ${h.hub}${h.picText}: ${formatNumber(h.vol)} pkt (OH Total ${formatNumber(h.total)})`
        )
      : ["- Clear, tidak ada gantungan On-Hold (0) -"]),
  ];

  const messageText = lines.join("\n");
  const mentionList = Array.from(mentionEmails);

  const summaryImage = await generateDailySummaryImageBase64({
    targetDate,
    totalHubs: allHubs.length,
    closedCount,
    prodFilledCount,
    totalVolumeAll,
    totalDeliveredAll,
    totalBacklogAll,
    backlogPctAll,
    totalExpediteAll,
    totalDeliveringAll,
    totalOhVolAll,
    missingClosingCount: missingClosing.length,
    incompleteCount: incompleteOrEmpty.length,
    deliveringGantunganCount: deliveringGantungan.length,
    onholdGantunganCount: onholdGantungan.length,
    manualHubCount,
    hubRows,
  });

  if (!options?.dryRun) {
    // Kirim gambar report summary terlebih dahulu, lalu diikuti text caption detailnya
    await sendSeaTalkImageMessage(webhookUrl, summaryImage.base64);
    await sendSeaTalkTextMessage(webhookUrl, messageText);
    await setSetting({
      key: LAST_SUMMARY_KEY,
      value: targetDate,
      updatedBy: "cron-summary-0005",
    });
  }

  return {
    skipped: false,
    targetDate,
    totalHubs: allHubs.length,
    closedCount,
    prodFilledCount,
    missingClosingCount: missingClosing.length,
    incompleteCount: incompleteOrEmpty.length,
    deliveringGantunganCount: deliveringGantungan.length,
    onholdGantunganCount: onholdGantungan.length,
    mentionedCount: mentionList.length,
    imageSent: !options?.dryRun,
    preview: messageText,
    ...(options?.dryRun
      ? { previewImageDataUrl: `data:image/png;base64,${summaryImage.base64}` }
      : {}),
  };
}
