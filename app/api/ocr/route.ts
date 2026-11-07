import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseOcrText, detectParcelSweeperDates } from "@/lib/ocrParser";
import { mergeOcrBatches } from "@/lib/ocrMerger";
import { preprocessImage, preprocessImageLight } from "@/lib/imagePreprocess";
import { todayWIB } from "@/lib/dateUtils";
import { formatDate } from "@/lib/utils";
import { createWorker, Worker } from "tesseract.js";

interface OcrRequestBody {
  images: string[]; // base64 encoded images
}

// Singleton worker di memori server agar tidak load eng.traineddata (5 MB) berulang kali
let cachedWorkerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = (async () => {
      const worker = await createWorker("eng", 1, {
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_pageseg_mode: "6" as never,
        tessedit_char_whitelist:
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,%()-/: ",
        preserve_interword_spaces: "1" as never,
      });
      return worker;
    })();
  }
  return cachedWorkerPromise;
}

async function runOcr(processedBase64: string): Promise<{ text: string; confidence: number }> {
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(processedBase64);
    return { text: data.text, confidence: data.confidence ?? 0 };
  } catch (err) {
    // Jika worker crash, reset cache dan coba sekali lagi
    cachedWorkerPromise = null;
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(processedBase64);
    return { text: data.text, confidence: data.confidence ?? 0 };
  }
}

/**
 * Strategi dual-pass:
 * 1. Coba dengan preprocessing standar (threshold agresif)
 * 2. Jika hasilnya terlalu sedikit karakter bermakna, coba preprocessing ringan
 * Return hasil terbaik (yang mengandung lebih banyak angka/kata relevan)
 */
async function runOcrDualPass(base64Image: string): Promise<{ text: string; confidence: number }> {
  const processed1 = await preprocessImage(base64Image);
  const res1 = await runOcr(processed1);

  const quality = (text: string) => {
    const digits = (text.match(/\d/g) || []).length;
    const words  = (text.match(/[A-Za-z]{3,}/g) || []).length;
    return digits + words * 2;
  };

  const q1 = quality(res1.text);

  if (q1 < 50) {
    const processed2 = await preprocessImageLight(base64Image);
    const res2 = await runOcr(processed2);
    const q2 = quality(res2.text);
    return q2 > q1 ? res2 : res1;
  }

  return res1;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: OcrRequestBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  if (!body.images?.length)
    return NextResponse.json({ error: "images array wajib diisi" }, { status: 400 });

  if (body.images.length > 10)
    return NextResponse.json({ error: "Maksimal 10 screenshot" }, { status: 400 });

  try {
    const today = todayWIB();
    const batches = [];
    let totalConf = 0;

    for (let idx = 0; idx < body.images.length; idx++) {
      const image = body.images[idx];
      const { text: rawText, confidence } = await runOcrDualPass(image);
      totalConf += confidence;

      // Validasi tanggal wajib = hari ini HANYA untuk halaman Parcel Sweeper
      const psDates = detectParcelSweeperDates(rawText);
      const parsed = parseOcrText(rawText);

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
