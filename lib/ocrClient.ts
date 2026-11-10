/**
 * OCR lokal di browser — mengikuti pola script referensi ocr.html.
 *
 * - Tesseract.js dijalankan di perangkat user (WebAssembly di browser)
 * - Screenshot TIDAK dikirim ke server; hanya hasil teks yang dipakai lalu disimpan.
 */
import type { Worker } from "tesseract.js";

const TESSERACT_CDN =
  "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.0/dist/tesseract.min.js";


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
      // Tanpa whitelist (memaksa LSTM salah baca pemisah ribuan) + DPI 300 seperti script referensi.
      preserve_interword_spaces: "1" as never,
      user_defined_dpi: "300" as never,
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
async function preprocessForOcr(
  dataUrl: string
): Promise<{ dataUrl: string; isFull: boolean }> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // Dashboard FMS umumnya lebar (>= 900px) walaupun tidak terlalu tinggi.
  // Jadi patokan "layar penuh" cukup dari lebar agar tabel tidak salah mode.
  const isFull = w >= 900;
  let targetW = w;
  // Naikkan resolusi hingga lebar 3200 agar pemisah ribuan/desimal
  // (contoh: 8.756 dan 100,0%) tidak hilang saat dibaca Tesseract.
  // Seperti script referensi: perbesar hingga 3x agar lebar mendekati 4200px.
  targetW = Math.round(w * Math.min(3, Math.max(1, 4200 / w)));

  const scale = targetW / w;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl, isFull };
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
    // Tanpa normalisasi min-max: tidak mengubah kontras asli (hasil benchmark lebih akurat).
    void min;
    void max;
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // bila browser menolak akses piksel, lanjutkan tanpa normalisasi
  }

  return { dataUrl: canvas.toDataURL("image/png"), isFull };
}

/** Binarisasi (hitam-putih) dengan ambang tertentu untuk cross-check dua bacaan. */
async function binarizeForOcr(dataUrl: string, threshold: number): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum < threshold ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export interface LocalOcrResult {
  texts: string[];
  sparseTexts: string[];
  confidences: number[];
  altTexts: string[];
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
  const altTexts: string[] = [];

  for (let i = 0; i < images.length; i++) {
    if (hooks?.isCancelled?.()) throw new OcrCancelledError();
    hooks?.onProgress?.(`Memproses screenshot ${i + 1}/${images.length}…`);
    const { dataUrl: processed, isFull } = await preprocessForOcr(images[i]);
    // Screenshot penuh -> mode 3 (otomatis, cocok untuk dashboard/tabel).
    // Potongan kecil -> mode 6 (blok teks).
    const mainMode = isFull ? "3" : "6";

    await worker.setParameters({ tessedit_pageseg_mode: mainMode as never });
    // Baca 2 kali dengan binarisasi berbeda, lalu cocokkan silang
    // (meniru pendekatan script referensi agar salah baca tidak lolos diam-diam).
    // Bacaan 1 = grayscale asli; bacaan 2 = biner ambang 200 (seperti script referensi).
    // Ambang 225 dibuang: benchmark menunjukkan sering menghilangkan angka tipis.
    const bin200 = await binarizeForOcr(processed, 200);
    const r200 = await worker.recognize(processed);
    const r225 = await worker.recognize(bin200);
    const norm = (s: string) => s.replace(/ +/g, " ").trim();
    const cocok = norm(r200.data.text) === norm(r225.data.text);
    texts.push(r200.data.text);
    altTexts.push(r225.data.text);
    confidences.push(
      cocok
        ? Math.round(((r200.data.confidence ?? 0) + (r225.data.confidence ?? 0)) / 2)
        : 60
    );

    try {
      await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
      const sp = await worker.recognize(processed);
      sparseTexts.push(sp.data.text);
    } catch {
      sparseTexts.push("");
    } finally {
      await worker.setParameters({ tessedit_pageseg_mode: mainMode as never });
    }
  }

  return { texts, sparseTexts, confidences, altTexts };
}
