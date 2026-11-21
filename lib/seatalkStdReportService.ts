import { todayWIB } from "./dateUtils";
import { getMonitorSamedayData } from "./samedayService";
import {
  sendSeaTalkImageMessage,
  sendSeaTalkTextMessage,
} from "./seatalkReportService";
import {
  computeStdStatusAndRanking,
  generateStdMonitorImageBase64,
} from "./seatalkStdImage";
import {
  getSeaTalkStdWebhookUrl,
  getSetting,
  setSetting,
} from "./settingsService";
import { getAllUserMappings, splitHubList } from "./userMapping";

const LAST_STD_REPORT_KEY = "seatalk_last_std_report_ymd";

function fmtPct(v: number | null, decimalsIfFloat = 1): string {
  if (v === null) return "-";
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(decimalsIfFloat)}%`;
}

async function buildStdHubPicEmails(): Promise<Map<string, string[]>> {
  const mappings = await getAllUserMappings().catch(() => []);
  const map = new Map<string, Set<string>>();

  for (const m of mappings) {
    if (m.status !== "active" || !m.email) continue;
    for (const h of splitHubList(m.nama_hub)) {
      const k = h.toLowerCase().trim();
      if (!k) continue;
      let set = map.get(k);
      if (!set) {
        set = new Set<string>();
        map.set(k, set);
      }
      set.add(m.email.trim().toLowerCase());
    }
  }

  const out = new Map<string, string[]>();
  for (const [k, s] of map.entries()) {
    out.set(k, Array.from(s));
  }
  return out;
}

/**
 * Job 3 (09:00 WIB): Mengirim laporan Monitor STD (gambar dashboard + caption status Hub)
 * ke Webhook SeaTalk khusus Monitor STD.
 */
export async function runStdMonitorReportJob(options?: {
  force?: boolean;
  dryRun?: boolean;
}) {
  const targetDate = todayWIB();

  if (!options?.force && !options?.dryRun) {
    const lastSent = await getSetting(LAST_STD_REPORT_KEY, { skipCache: true });
    if (lastSent?.value === targetDate) {
      return {
        skipped: true,
        reason: `Monitor STD report untuk tanggal ${targetDate} sudah pernah dikirim.`,
        targetDate,
      };
    }
  }

  const webhookUrl = await getSeaTalkStdWebhookUrl({ skipCache: true });
  if (!webhookUrl && !options?.dryRun) {
    throw new Error(
      "Webhook SeaTalk Monitor STD belum dikonfigurasi di menu Settings."
    );
  }

  const [samedayData, picMap] = await Promise.all([
    getMonitorSamedayData({ skipCache: true }),
    buildStdHubPicEmails(),
  ]);

  const { statusStats, notOnTarget } = computeStdStatusAndRanking(samedayData);

  const tierText = Object.entries(samedayData.summary.tierCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tier, cnt]) => `Tier ${tier}: ${cnt}`)
    .join(" · ");

  const belowOrNearLines = notOnTarget.map((item, idx) => {
    const key = item.row.namaHub.toLowerCase().trim();
    const mappedEmails = picMap.get(key) || [];
    const fallbackEmail =
      item.row.plEmail && item.row.plEmail.includes("@")
        ? [item.row.plEmail.trim().toLowerCase()]
        : [];
    const emails = mappedEmails.length > 0 ? mappedEmails : fallbackEmail;
    const mentionInline = emails.length > 0 ? " " + emails.map((e) => `@${e}`).join(" ") : "";
    const statusTag = item.gap >= -2 ? "Mendekati" : "Below";

    return `${idx + 1}. ${item.row.namaHub}${mentionInline}: ${fmtPct(item.mtd)} / Target ${fmtPct(item.target)} (${item.gap > 0 ? `+${item.gap}` : item.gap}% • ${statusTag})`;
  });

  const captionLines: string[] = [
    `📊 MONITOR SAMEDAY (STD) REPORT (09:00 WIB) — JTT08`,
    `Report: ${samedayData.reportDate || "-"} • Update Data: ${samedayData.latestDataDate || "-"}`,
    `Total Hub: ${samedayData.summary.totalHubs}${tierText ? ` (${tierText})` : ""}`,
    `KPI MTD: Delivering ${fmtPct(samedayData.summary.avgDeliveringMtd)} (WTD ${fmtPct(samedayData.summary.avgDeliveringWtd)}) | Delivered ${fmtPct(samedayData.summary.avgDeliveredMtd)} (WTD ${fmtPct(samedayData.summary.avgDeliveredWtd)}) | Achv ${fmtPct(samedayData.summary.avgAchvMtd, 2)}`,
    `Status Target MTD: ${statusStats.onTarget} On Target • ${statusStats.nearTarget} Mendekati (-2%) • ${statusStats.belowTarget} Below Target`,
    "",
    `⚠️ HUB DI BAWAH TARGET DELIVERED MTD (${notOnTarget.length} Hub):`,
    ...(belowOrNearLines.length > 0
      ? belowOrNearLines
      : ["- Semua Hub sudah mencapai Target Delivered MTD! -"]),
  ];

  const messageText = captionLines.join("\n");
  const stdImage = await generateStdMonitorImageBase64(samedayData);

  if (!options?.dryRun) {
    await sendSeaTalkImageMessage(webhookUrl, stdImage.base64);
    await sendSeaTalkTextMessage(webhookUrl, messageText);
    await setSetting({
      key: LAST_STD_REPORT_KEY,
      value: targetDate,
      updatedBy: "cron-std-0900",
    });
  }

  return {
    skipped: false,
    targetDate,
    reportDate: samedayData.reportDate,
    latestDataDate: samedayData.latestDataDate,
    totalHubs: samedayData.summary.totalHubs,
    achievedCount: statusStats.onTarget,
    nearTargetCount: statusStats.nearTarget,
    belowTargetCount: statusStats.belowTarget,
    mentionedCount: notOnTarget.length,
    imageSent: !options?.dryRun,
    preview: messageText,
    ...(options?.dryRun
      ? { previewImageDataUrl: `data:image/png;base64,${stdImage.base64}` }
      : {}),
  };
}
