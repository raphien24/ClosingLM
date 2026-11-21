import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isOwnerAdminEmail } from "@/lib/authConstants";
import {
  getSetting,
  SEATALK_WEBHOOK_KEY,
  setSetting,
  SettingsError,
  validateSeaTalkWebhookUrl,
} from "@/lib/settingsService";

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
    const rec = await getSetting(SEATALK_WEBHOOK_KEY);
    return NextResponse.json({
      success: true,
      settings: {
        seatalk_webhook_url: rec?.value || "",
        updated_at: rec?.updated_at || "",
        updated_by: rec?.updated_by || "",
      },
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

  let body: { seatalk_webhook_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format body tidak valid" }, { status: 400 });
  }

  try {
    const cleanUrl = validateSeaTalkWebhookUrl(body.seatalk_webhook_url ?? "");
    const saved = await setSetting({
      key: SEATALK_WEBHOOK_KEY,
      value: cleanUrl,
      updatedBy: session.user.email || "",
    });

    return NextResponse.json({
      success: true,
      message: cleanUrl
        ? "Webhook SeaTalk berhasil disimpan."
        : "Webhook SeaTalk berhasil dikosongkan.",
      settings: {
        seatalk_webhook_url: saved.value,
        updated_at: saved.updated_at,
        updated_by: saved.updated_by,
      },
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

  let body: { seatalk_webhook_url?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const rawCandidate =
      typeof body.seatalk_webhook_url === "string"
        ? body.seatalk_webhook_url
        : (await getSetting(SEATALK_WEBHOOK_KEY, { skipCache: true }))?.value || "";
    const webhookUrl = validateSeaTalkWebhookUrl(rawCandidate);
    if (!webhookUrl) {
      throw new SettingsError("Masukkan URL Webhook SeaTalk terlebih dahulu.", 400);
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag: "text",
        text: {
          content: `✅ Test koneksi Webhook SeaTalk dari Closing LM JTT08 berhasil (${session.user.email}).`,
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
      message: "Pesan test berhasil dikirim ke grup SeaTalk!",
    });
  } catch (err) {
    const status = err instanceof SettingsError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengetes webhook" },
      { status }
    );
  }
}
