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

/** Konversi piksel canvas menjadi grayscale di tempat. */
function applyGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // bila browser menolak akses piksel, lanjutkan tanpa grayscale
  }
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
  // Seperti script referensi: perbesar hingga 3x agar lebar mendekati 4200px.
  const targetW = Math.round(w * Math.min(3, Math.max(1, 4200 / w)));

  const scale = targetW / w;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl, isFull };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  applyGrayscale(ctx, canvas.width, canvas.height);

  return { dataUrl: canvas.toDataURL("image/png"), isFull };
}

/** Crop zona tabel Fleet status (kanan tengah Operation Progress) untuk fallback On-hold. */
async function cropFleetStatusForOcr(dataUrl: string): Promise<string | null> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w < 400 || h < 200) return null;

  const sx = Math.round(w * 0.46);
  const sy = Math.round(h * 0.22);
  const sw = w - sx;
  const sh = Math.round(h * 0.40);
  const tw = Math.min(2800, sw * 3);
  const th = Math.max(1, Math.round((sh * tw) / sw));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
  applyGrayscale(ctx, tw, th);
  return canvas.toDataURL("image/png");
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
  fleetStatusTexts: string[];
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
  const fleetStatusTexts: string[] = [];

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

    // Fallback crop tabel Fleet status jika Operation Progress penuh belum membaca On-hold
    const combinedMain = `${r200.data.text}\n${r225.data.text}`;
    const isOpProgress =
      isFull &&
      /Operation\s+Progress|In\s+Hub\s+Status|Fleet\s+Head\s+Counts|Fleet\s+Productivity|Clear\s+Floor\s+Rate|To\s+Handover|To\s+Deliver/i.test(
        combinedMain
      ) &&
      !/Parcel\s+Sweeper|\bPS20\d{6,}/i.test(combinedMain);
    const hasOnHoldNums =
      /\b(?:[oq0]n[\s\-r]*[hn][o0a][il1t]?d|an[\s\-]+h[o0]l?d)\b[^\n]*\d/i.test(
        combinedMain
      );

    if (isOpProgress && !hasOnHoldNums) {
      try {
        const cropUrl = await cropFleetStatusForOcr(images[i]);
        if (cropUrl) {
          await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
          const fsRes = await worker.recognize(cropUrl);
          fleetStatusTexts.push(fsRes.data.text);
        } else {
          fleetStatusTexts.push("");
        }
      } catch {
        fleetStatusTexts.push("");
      } finally {
        await worker.setParameters({ tessedit_pageseg_mode: mainMode as never });
      }
    } else {
      fleetStatusTexts.push("");
    }
  }

  return { texts, sparseTexts, confidences, altTexts, fleetStatusTexts };
}
