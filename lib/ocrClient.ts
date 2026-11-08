/**
 * OCR lokal di browser — mengikuti pola script referensi ocr.html.
 *
 * - Tesseract.js dijalankan di perangkat user (WebAssembly di browser)
 * - Screenshot TIDAK dikirim ke server; hanya hasil teks yang dipakai lalu disimpan.
 */
import type { Worker } from "tesseract.js";

const TESSERACT_CDN =
  "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.0/dist/tesseract.min.js";

// Samakan dengan konfigurasi worker di server (lib/ocrWorker.ts)
const CHAR_WHITELIST =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,%()-/: ";

type ProgressHook = (step: string) => void;
type TesseractModule = typeof import("tesseract.js");

let libPromise: Promise<TesseractModule> | null = null;
let workerPromise: Promise<Worker> | null = null;

/** Muat library tesseract.js dari CDN (sekali saja), seperti script referensi. */
export function loadTesseractLib(): Promise<TesseractModule> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OCR lokal hanya berjalan di browser."));
  }
  if (libPromise) return libPromise;
  libPromise = new Promise<TesseractModule>((resolve, reject) => {
    const w = window as unknown as { Tesseract?: TesseractModule };
    if (w.Tesseract) return resolve(w.Tesseract);
    const script = document.createElement("script");
    script.src = TESSERACT_CDN;
    script.async = true;
    script.onload = () => {
      if (w.Tesseract) resolve(w.Tesseract);
      else reject(new Error("Tesseract gagal dimuat."));
    };
    script.onerror = () => {
      libPromise = null;
      reject(
        new Error(
          "Tidak bisa memuat mesin OCR. Pastikan perangkat terhubung ke internet."
        )
      );
    };
    document.head.appendChild(script);
  });
  return libPromise;
}

async function getWorker(onProgress?: ProgressHook): Promise<Worker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const T = await loadTesseractLib();
    const worker = await T.createWorker("eng", 1, {
      logger: (m: { status?: string }) => {
        if (!onProgress) return;
        if (m.status === "recognizing text") onProgress("Membaca teks…");
        else if (m.status && m.status.includes("loading"))
          onProgress("Memuat mesin OCR…");
      },
    });
    await worker.setParameters({
      tessedit_pageseg_mode: "6" as never,
      tessedit_char_whitelist: CHAR_WHITELIST,
      preserve_interword_spaces: "1" as never,
    });
    return worker;
  })().catch((err) => {
    workerPromise = null;
    throw err;
  });
  return workerPromise;
}

export function resetClientOcr(): void {
  workerPromise = null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal membaca gambar."));
    img.src = src;
  });
}

/**
 * Tiru pipeline sharp di server memakai canvas: upscale (layar penuh), grayscale,
 * lalu normalisasi kontras (auto-level) agar angka kecil lebih jelas terbaca.
 */
async function preprocessForOcr(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const isFull = w >= 900 && h >= 600;
  let targetW = w;
  if (isFull && w < 2000) targetW = Math.min(3200, Math.round(w * 2.5));
  else if (w < 2000) targetW = Math.min(3200, w * 2);
  else if (w > 3200) targetW = 3200;

  const scale = targetW / w;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.round(((d[i] - min) / range) * 255);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // bila browser menolak akses piksel, lanjutkan tanpa normalisasi
  }

  return canvas.toDataURL("image/png");
}

export interface LocalOcrResult {
  texts: string[];
  sparseTexts: string[];
  confidences: number[];
}

export class OcrCancelledError extends Error {
  constructor() {
    super("OCR dibatalkan");
    this.name = "OcrCancelledError";
  }
}

/**
 * Jalankan OCR lokal untuk tiap screenshot. Mengembalikan teks penuh, teks sparse
 * (untuk ekstraksi To Expedite), dan confidence — semuanya diproses di perangkat.
 */
export async function runOcrLocally(
  images: string[],
  hooks?: { onProgress?: ProgressHook; isCancelled?: () => boolean }
): Promise<LocalOcrResult> {
  const worker = await getWorker(hooks?.onProgress);
  const texts: string[] = [];
  const sparseTexts: string[] = [];
  const confidences: number[] = [];

  for (let i = 0; i < images.length; i++) {
    if (hooks?.isCancelled?.()) throw new OcrCancelledError();
    hooks?.onProgress?.(`Memproses screenshot ${i + 1}/${images.length}…`);
    const processed = await preprocessForOcr(images[i]);

    await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
    const { data } = await worker.recognize(processed);
    texts.push(data.text);
    confidences.push(data.confidence ?? 0);

    try {
      await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
      const sp = await worker.recognize(processed);
      sparseTexts.push(sp.data.text);
    } catch {
      sparseTexts.push("");
    } finally {
      await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
    }
  }

  return { texts, sparseTexts, confidences };
}
