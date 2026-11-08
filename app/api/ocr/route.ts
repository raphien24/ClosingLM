import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseOcrText, detectParcelSweeperDates } from "@/lib/ocrParser";
import { mergeOcrBatches } from "@/lib/ocrMerger";
import {
  preprocessImageToBuffer,
  preprocessImageLightToBuffer,
} from "@/lib/imagePreprocess";
import { todayWIB } from "@/lib/dateUtils";
import { formatDate } from "@/lib/utils";
import { createWorker, Worker } from "tesseract.js";
import path from "path";
import fs from "fs";

interface OcrRequestBody {
  images: string[]; // base64 encoded images
}

// Singleton worker di memori server agar tidak load traineddata berulang kali
let cachedWorkerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = (async () => {
      const isVercel = !!process.env.VERCEL;
      const cwd = process.cwd();
      const localTrainedPath = path.join(cwd, "eng.traineddata");
      const hasLocalData = fs.existsSync(localTrainedPath);

      const options: Record<string, unknown> = {
        logger: () => {},
      };

      // Jika ada file eng.traineddata lokal di root project, gunakan langsung dari disk (10x lebih cepat)
      if (hasLocalData) {
        options.langPath = cwd;
      }

      // Di Vercel serverless (AWS Lambda), filesystem selain /tmp bersifat read-only
      if (isVercel) {
        options.cachePath = "/tmp";
      } else {
        options.cachePath = cwd;
      }

      const worker = await createWorker("eng", 1, options);
      await worker.setParameters({
        tessedit_pageseg_mode: "6" as never,
        tessedit_char_whitelist:
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,%()-/: ",
        preserve_interword_spaces: "1" as never,
      });
      return worker;
    })().catch((err) => {
      cachedWorkerPromise = null;
      console.error("Gagal inisialisasi Tesseract worker:", err);
      throw err;
    });
  }
  return cachedWorkerPromise;
}

async function runOcr(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(imageBuffer);
    return { text: data.text, confidence: data.confidence ?? 0 };
  } catch (err) {
    console.error("Worker recognize error, me-reset worker:", err);
    cachedWorkerPromise = null;
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(imageBuffer);
    return { text: data.text, confidence: data.confidence ?? 0 };
  }
}

/**
 * Preprocessing & OCR cepat berbasis Buffer (menghindari overhead decode/encode base64 berulang)
 */
async function runOcrFast(base64Image: string): Promise<{ text: string; confidence: number }> {
  const processed1 = await preprocessImageToBuffer(base64Image);
  const res1 = await runOcr(processed1);

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
      return q2 > q1 ? res2 : res1;
    } catch {
      return res1;
    }
  }

  return res1;
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
      const { text: rawText, confidence } = await runOcrFast(image);
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
