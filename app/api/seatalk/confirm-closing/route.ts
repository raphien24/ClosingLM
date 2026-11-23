import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { denyIfReadOnlyAdmin, resolveActiveHubForSession } from "@/lib/activeHub";
import { getSeaTalkWebhookUrl } from "@/lib/settingsService";
import {
  prepareConfirmClosingForHub,
  sendSeaTalkImageMessage,
  sendSeaTalkTextMessage,
} from "@/lib/seatalkReportService";
import { normalizeToYMD, todayWIB } from "@/lib/dateUtils";

const MAX_IMAGE_BASE64_CHARS = 4_800_000;

function extractRawBase64(input: string): string {
  const trimmed = String(input ?? "").trim();
  const commaIdx = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIdx !== -1) {
    return trimmed.slice(commaIdx + 1).trim();
  }
  return trimmed;
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
  const readOnlyErr = denyIfReadOnlyAdmin(access, "melakukan Confirm Closing & kirim ke SeaTalk");
  if (readOnlyErr) {
    return NextResponse.json({ error: readOnlyErr }, { status: 403 });
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
  if (targetDate !== todayWIB()) {
    return NextResponse.json(
      { error: "Confirm Closing hanya dapat dilakukan untuk tanggal hari ini (Hari H)." },
      { status: 400 }
    );
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

    const sessionUser = session.user as typeof session.user & {
      hubUser?: string | null;
    };
    const confirmedBy = sessionUser.hubUser || sessionUser.name || access.email;

    const prepared = await prepareConfirmClosingForHub({
      hubName: access.activeHub,
      targetDate,
      confirmedByLabel: confirmedBy,
    });

    if (!prepared.completeness.isComplete) {
      return NextResponse.json(
        {
          error: `Confirm Closing diblokir (${prepared.hubDisplayName}): ${prepared.completeness.issues.join(" ")}`,
          issues: prepared.completeness.issues,
        },
        { status: 400 }
      );
    }

    // 1. Kirim screenshot Summary Today ke SeaTalk
    await sendSeaTalkImageMessage(webhookUrl, cleanBase64);

    // 2. Kirim caption text list hub sudah closing & belum closing
    await sendSeaTalkTextMessage(webhookUrl, prepared.caption);

    return NextResponse.json({
      success: true,
      message: `Confirm Closing (${prepared.submittedCount}/${prepared.totalHubs} Hub) & screenshot berhasil dikirim ke SeaTalk!`,
      submittedCount: prepared.submittedCount,
      missingCount: prepared.missingCount,
      totalHubs: prepared.totalHubs,
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
