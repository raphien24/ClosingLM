import { NextResponse } from "next/server";
import { getOcrWorker } from "@/lib/ocrWorker";

// Warm-up endpoint: menjaga Tesseract worker tetap hidup di instance serverless.
// Dipanggil berkala oleh Vercel Cron agar request OCR dari user tidak kena cold start.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getOcrWorker();
    return NextResponse.json({ ok: true, warmed: true });
  } catch (error) {
    console.error("Warmup OCR gagal:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "warmup gagal" },
      { status: 500 }
    );
  }
}
