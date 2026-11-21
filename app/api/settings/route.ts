import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isOwnerAdminEmail } from "@/lib/authConstants";
import {
  getSetting,
  SEATALK_STD_WEBHOOK_KEY,
  SEATALK_WEBHOOK_KEY,
  setSetting,
  SettingsError,
  validateSeaTalkWebhookUrl,
} from "@/lib/settingsService";

async function readAllSettingsPayload(skipCache = false) {
  const [closingRec, stdRec] = await Promise.all([
    getSetting(SEATALK_WEBHOOK_KEY, { skipCache }),
    getSetting(SEATALK_STD_WEBHOOK_KEY, { skipCache }),
  ]);

  return {
    seatalk_webhook_url: closingRec?.value || "",
    updated_at: closingRec?.updated_at || "",
    updated_by: closingRec?.updated_by || "",
    seatalk_std_webhook_url: stdRec?.value || "",
    std_updated_at: stdRec?.updated_at || "",
    std_updated_by: stdRec?.updated_by || "",
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOwnerAdminEmail(session.user.email)) {
    return NextResponse.json(
      { error: "Akses ditolak. Menu Settings khusus akun Owner." },
      { status: 403 }
    );
  }

  try {
    const settings = await readAllSettingsPayload();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOwnerAdminEmail(session.user.email)) {
    return NextResponse.json(
      { error: "Akses ditolak. Menu Settings khusus akun Owner." },
      { status: 403 }
    );
  }

  let body: { seatalk_webhook_url?: string; seatalk_std_webhook_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  try {
    const updatedBy = session.user.email || "";
    const tasks: Promise<unknown>[] = [];

    if (typeof body.seatalk_webhook_url === "string") {
      const cleanClosingUrl = validateSeaTalkWebhookUrl(body.seatalk_webhook_url);
      tasks.push(
        setSetting({
          key: SEATALK_WEBHOOK_KEY,
          value: cleanClosingUrl,
          updatedBy,
        })
      );
    }

    if (typeof body.seatalk_std_webhook_url === "string") {
      const cleanStdUrl = validateSeaTalkWebhookUrl(body.seatalk_std_webhook_url);
      tasks.push(
        setSetting({
          key: SEATALK_STD_WEBHOOK_KEY,
          value: cleanStdUrl,
          updatedBy,
        })
      );
    }

    if (tasks.length === 0) {
      throw new SettingsError("Tidak ada field pengaturan yang dikirim.", 400);
    }

    await Promise.all(tasks);
    const settings = await readAllSettingsPayload(true);

    return NextResponse.json({
      success: true,
      message: "Pengaturan Webhook SeaTalk berhasil disimpan.",
      settings,
    });
  } catch (err) {
    const status = err instanceof SettingsError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan settings" },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOwnerAdminEmail(session.user.email)) {
    return NextResponse.json(
      { error: "Akses ditolak. Menu Settings khusus akun Owner." },
      { status: 403 }
    );
  }

  let body: { target?: "closing" | "std"; seatalk_webhook_url?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const isStd = body.target === "std";
    const settingKey = isStd ? SEATALK_STD_WEBHOOK_KEY : SEATALK_WEBHOOK_KEY;
    const rawCandidate =
      typeof body.seatalk_webhook_url === "string"
        ? body.seatalk_webhook_url
        : (await getSetting(settingKey, { skipCache: true }))?.value || "";
    const webhookUrl = validateSeaTalkWebhookUrl(rawCandidate);
    if (!webhookUrl) {
      throw new SettingsError(
        isStd
          ? "Masukkan URL Webhook SeaTalk Monitor STD terlebih dahulu."
          : "Masukkan URL Webhook SeaTalk Closing terlebih dahulu.",
        400
      );
    }

    const label = isStd ? "Monitor STD" : "Closing LM";
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag: "text",
        text: {
          content: `✅ Test koneksi Webhook SeaTalk (${label}) dari Closing LM JTT08 berhasil (${session.user.email}).`,
          at_all: false,
        },
      }),
    });

    const text = await res.text();
    let json: { code?: number; message?: string } | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Abaikan jika response bukan JSON
    }

    if (!res.ok || (json?.code !== undefined && json.code !== 0)) {
      throw new SettingsError(
        `SeaTalk menolak request (${res.status}): ${json?.message || text || "Unknown error"}`,
        502
      );
    }

    return NextResponse.json({
      success: true,
      message: `Pesan test Webhook ${label} berhasil dikirim ke grup SeaTalk!`,
    });
  } catch (err) {
    const status = err instanceof SettingsError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengetes webhook" },
      { status }
    );
  }
}
