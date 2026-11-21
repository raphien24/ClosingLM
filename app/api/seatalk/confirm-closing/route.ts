import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveActiveHubForSession } from "@/lib/activeHub";
import { getSeaTalkWebhookUrl } from "@/lib/settingsService";
import { getSheetData } from "@/lib/sheets";
import { getAllHubs } from "@/lib/userMapping";
import { rowToClosingData, formatDate } from "@/lib/utils";
import { normalizeToYMD, parseTimestamp, todayWIB } from "@/lib/dateUtils";
import { ClosingData } from "@/types/closing";

const DATA_CLOSING_SHEET = "DATA_CLOSING";
const MAX_IMAGE_BASE64_CHARS = 4_800_000;
const SEATALK_MAX_TEXT_BYTES = 3800;

function extractRawBase64(input: string): string {
  const trimmed = String(input ?? "").trim();
  const commaIdx = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIdx !== -1) {
    return trimmed.slice(commaIdx + 1).trim();
  }
  return trimmed;
}

function formatWibTime(rawTimestamp: string | undefined): string {
  if (!rawTimestamp) return "";
  const dt = parseTimestamp(rawTimestamp);
  if (!dt) return rawTimestamp;
  return (
    dt.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
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

async function postToSeaTalkWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
  label: string
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: { code?: number; message?: string } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Response bukan JSON
  }

  if (!res.ok || (json?.code !== undefined && json.code !== 0)) {
    throw new Error(
      `Gagal mengirim ${label} ke SeaTalk (${res.status}): ${json?.message || text || "Unknown error"}`
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolveActiveHubForSession(session);
  if (!access) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  let body: { date?: string; imageDataUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  const targetDate = normalizeToYMD(body.date || todayWIB());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
  }

  const cleanBase64 = extractRawBase64(body.imageDataUrl || "");
  if (!cleanBase64 || !/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
    return NextResponse.json(
      { error: "Data screenshot gambar tidak valid." },
      { status: 400 }
    );
  }
  if (cleanBase64.length > MAX_IMAGE_BASE64_CHARS) {
    return NextResponse.json(
      { error: "Ukuran screenshot melebihi batas pengiriman SeaTalk (5MB)." },
      { status: 400 }
    );
  }

  try {
    const webhookUrl = await getSeaTalkWebhookUrl({ skipCache: true });
    if (!webhookUrl) {
      return NextResponse.json(
        {
          error:
            "Webhook SeaTalk belum dikonfigurasi. Atur URL webhook terlebih dahulu di menu Settings.",
        },
        { status: 400 }
      );
    }

    const [sheetData, allHubs] = await Promise.all([
      getSheetData(DATA_CLOSING_SHEET, { skipCache: true }),
      getAllHubs(),
    ]);

    const latestByHub = new Map<string, ClosingData>();
    for (let i = 1; i < sheetData.length; i++) {
      const r = sheetData[i];
      if (!r || r.length < 2) continue;
      if (normalizeToYMD(r[0]) !== targetDate) continue;
      const parsed = rowToClosingData(r);
      const key = parsed.nama_hub.toLowerCase().trim();
      if (!key) continue;

      const prev = latestByHub.get(key);
      if (
        !prev ||
        (parseTimestamp(parsed.submitted_at)?.getTime() ?? 0) >=
          (parseTimestamp(prev.submitted_at)?.getTime() ?? 0)
      ) {
        latestByHub.set(key, parsed);
      }
    }

    const hubNamesByKey = new Map<string, string>();
    for (const h of allHubs) {
      const k = h.toLowerCase().trim();
      if (k && !hubNamesByKey.has(k)) hubNamesByKey.set(k, h.trim());
    }
    for (const [k, row] of latestByHub.entries()) {
      if (!hubNamesByKey.has(k)) hubNamesByKey.set(k, row.nama_hub.trim());
    }

    const submittedList: { name: string; time: string }[] = [];
    const missingList: string[] = [];

    for (const [key, displayHub] of hubNamesByKey.entries()) {
      const closing = latestByHub.get(key);
      if (closing && closing.submitted_at) {
        submittedList.push({
          name: closing.nama_hub || displayHub,
          time: formatWibTime(closing.submitted_at),
        });
      } else {
        missingList.push(displayHub);
      }
    }

    submittedList.sort((a, b) => a.name.localeCompare(b.name, "id"));
    missingList.sort((a, b) => a.localeCompare(b, "id"));

    const sessionUser = session.user as typeof session.user & {
      hubUser?: string | null;
    };
    const confirmedBy =
      sessionUser.hubUser || sessionUser.name || access.email;

    const lines: string[] = [
      `📊 CONFIRM CLOSING REPORT — JTT08`,
      `Tanggal: ${formatDate(targetDate)}`,
      `Dikonfirmasi oleh: ${confirmedBy} (${access.activeHub})`,
      `Ringkasan: ${submittedList.length}/${hubNamesByKey.size} Hub Sudah Closing • ${missingList.length} Belum Closing`,
      "",
      `✅ SUDAH CLOSING (${submittedList.length} Hub):`,
      ...(submittedList.length > 0
        ? submittedList.map(
            (h, idx) => `${idx + 1}. ${h.name}${h.time ? ` (${h.time})` : ""}`
          )
        : ["- Belum ada Hub yang closing -"]),
      "",
      `⏳ BELUM CLOSING (${missingList.length} Hub):`,
      ...(missingList.length > 0
        ? missingList.map((name, idx) => `${idx + 1}. ${name}`)
        : ["- Semua Hub sudah closing! -"]),
    ];

    const fullCaption = lines.join("\n");

    // 1. Kirim screenshot dashboard ke SeaTalk
    await postToSeaTalkWebhook(
      webhookUrl,
      {
        tag: "image",
        image_base64: {
          content: cleanBase64,
        },
      },
      "screenshot"
    );

    // 2. Kirim caption text list hub sudah closing & belum closing
    const chunks = splitUtf8Chunks(fullCaption, SEATALK_MAX_TEXT_BYTES);
    for (const chunk of chunks) {
      await postToSeaTalkWebhook(
        webhookUrl,
        {
          tag: "text",
          text: {
            content: chunk,
            at_all: false,
          },
        },
        "caption"
      );
    }

    return NextResponse.json({
      success: true,
      message: `Confirm Closing (${submittedList.length}/${hubNamesByKey.size} Hub) & screenshot berhasil dikirim ke SeaTalk!`,
      submittedCount: submittedList.length,
      missingCount: missingList.length,
      totalHubs: hubNamesByKey.size,
      date: targetDate,
    });
  } catch (err) {
    console.error("SeaTalk confirm-closing error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal mengirim Confirm Closing ke SeaTalk",
      },
      { status: 500 }
    );
  }
}
