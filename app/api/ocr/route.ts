import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseOcrText, detectParcelSweeperDates, extractExpediteSparse, isParcelSweeperPage } from "@/lib/ocrParser";
import { mergeOcrBatches } from "@/lib/ocrMerger";
import {
  preprocessImageToBuffer,
  preprocessImageLightToBuffer,
} from "@/lib/imagePreprocess";
import { todayWIB } from "@/lib/dateUtils";
import { formatDate } from "@/lib/utils";
import { getOcrWorker, resetOcrWorker } from "@/lib/ocrWorker";

// Beri waktu cukup untuk cold start Tesseract di Vercel serverless.
export const maxDuration = 60;

interface OcrRequestBody {
  images: string[]; // base64 encoded images
}

async function runOcr(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(imageBuffer);
    return { text: data.text, confidence: data.confidence ?? 0 };
  } catch (err) {
    console.error("Worker recognize error, me-reset worker:", err);
    resetOcrWorker();
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(imageBuffer);
    return { text: data.text, confidence: data.confidence ?? 0 };
  }
}

/**
 * Preprocessing & OCR cepat berbasis Buffer (menghindari overhead decode/encode base64 berulang)
 */
async function runOcrSparse(imageBuffer: Buffer): Promise<string> {
  const worker = await getOcrWorker();
  await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
  try {
    const { data } = await worker.recognize(imageBuffer);
    return data.text;
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
  }
}

async function runOcrFast(base64Image: string): Promise<{ text: string; confidence: number; sparseText: string }> {
  const processed1 = await preprocessImageToBuffer(base64Image);
  const res1 = await runOcr(processed1);
  const sparseText = await runOcrSparse(processed1).catch(() => "");

  const quality = (text: string) => {
    const digits = (text.match(/\d/g) || []).length;
    const words = (text.match(/[A-Za-z]{3,}/g) || []).length;
    return digits + words * 2;
  };

  const q1 = quality(res1.text);

  // Jalankan pass kedua hanya jika hasil pass 1 sangat sedikit (< 25)
  if (q1 < 25) {
    try {
      const processed2 = await preprocessImageLightToBuffer(base64Image);
      const res2 = await runOcr(processed2);
      const q2 = quality(res2.text);
      return { ...(q2 > q1 ? res2 : res1), sparseText };
    } catch {
      return { ...res1, sparseText };
    }
  }

  return { ...res1, sparseText };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: OcrRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.images?.length) {
    return NextResponse.json({ error: "images array wajib diisi" }, { status: 400 });
  }

  if (body.images.length > 10) {
    return NextResponse.json({ error: "Maksimal 10 screenshot" }, { status: 400 });
  }

  try {
    const today = todayWIB();
    const batches = [];
    let totalConf = 0;

    for (let idx = 0; idx < body.images.length; idx++) {
      const image = body.images[idx];
      const { text: rawText, confidence, sparseText } = await runOcrFast(image);
      totalConf += confidence;

      // Validasi tanggal wajib = hari ini HANYA untuk halaman Parcel Sweeper
      const psDates = detectParcelSweeperDates(rawText);
      const parsed = parseOcrText(rawText);
      console.error("[OCR-DEBUG] img=" + idx + " row=" + JSON.stringify(parsed.row).slice(0, 400) + " rawTextSnippet=" + JSON.stringify(rawText.slice(0, 300)));
      const expSparse = extractExpediteSparse(sparseText);
      if (expSparse !== null) parsed.row.total_expedite = expSparse;

      if (isParcelSweeperPage(rawText) && psDates.length === 0) {
        return NextResponse.json(
          {
            error: `Tanggal Parcel Sweeper pada screenshot #${idx + 1} tidak terdeteksi. Pastikan tanggal terlihat jelas di screenshot.`,
            date_missing: true,
            today,
          },
          { status: 400 }
        );
      }

      const mismatchedDate = psDates.find((d) => d !== today);
      if (mismatchedDate) {
        return NextResponse.json(
          {
            error: `Tanggal Parcel Sweeper pada screenshot #${idx + 1} (${formatDate(mismatchedDate)}) tidak sesuai dengan tanggal hari ini (${formatDate(today)}). Wajib gunakan data Parcel Sweeper hari ini!`,
            date_mismatch: true,
            detected_date: mismatchedDate,
            today,
          },
          { status: 400 }
        );
      }

      batches.push(parsed);
    }

    const merged = mergeOcrBatches(batches);
    const avgConfidence = Math.round(totalConf / body.images.length);

    return NextResponse.json({
      success: true,
      row: merged.row,
      tanggal_detected: today,
      total_images: body.images.length,
      confidence: avgConfidence,
    });
  } catch (error) {
    console.error("OCR Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memproses OCR." },
      { status: 500 }
    );
  }
}
