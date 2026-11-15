/**
 * OCR lokal di browser — mengikuti pola script referensi ocr.html.
 *
 * - Tesseract.js dijalankan di perangkat user (WebAssembly di browser)
 * - Screenshot TIDAK dikirim ke server; hanya hasil teks yang dipakai lalu disimpan.
 */
import type { Worker } from "tesseract.js";
import { isParcelSweeperPage } from "./ocrParser";

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

/** Crop sebagian area Operation Progress (proporsi 0..1) & upscale untuk fallback tabel kiri/kanan. */
async function cropRegionForOcr(
  dataUrl: string,
  sxFrac: number,
  syFrac: number,
  swFrac: number,
  shFrac: number,
  stripColorRing = false
): Promise<string | null> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (stripColorRing ? w < 120 || h < 60 : w < 400 || h < 200) return null;

  const sx = Math.round(w * sxFrac);
  const sy = Math.round(h * syFrac);
  const sw = Math.min(w - sx, Math.round(w * swFrac));
  const sh = Math.min(h - sy, Math.round(h * shFrac));
  if (stripColorRing ? sw < 40 || sh < 25 : sw < 50 || sh < 30) return null;
  const tw = Math.min(2800, sw * 3);
  const th = Math.max(1, Math.round((sh * tw) / sw));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
  if (stripColorRing) {
    try {
      const imageData = ctx.getImageData(0, 0, tw, th);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const max = Math.max(r, g, b);
        const sat = max - Math.min(r, g, b);
        // Piksel berwarna (cincin donut oranye/kuning/biru/merah/hijau/ungu) diputihkan agar angka netral di tengah terbaca jernih
        if (sat > 24 && (max > 155 || sat > 45)) {
          d[i] = d[i + 1] = d[i + 2] = 255;
        } else {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          d[i] = d[i + 1] = d[i + 2] = lum;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    } catch {
      applyGrayscale(ctx, tw, th);
    }
  } else {
    applyGrayscale(ctx, tw, th);
  }
  return canvas.toDataURL("image/png");
}

interface DonutHoleBounds {
  rx0: number;
  rx1: number;
  ry0: number;
  ry1: number;
  cx: number;
  cy: number;
}

/**
 * Cari bounding box cincin donut berwarna (oranye/kuning/biru/merah/hijau/ungu) pada rentang Y tertentu,
 * abaikan ikon garis tipis (`|`), dot legenda, dan border tab agar hanya mengisolasi ring utama.
 */
function detectColoredDonutInBand(
  data: Uint8ClampedArray,
  w: number,
  yStart: number,
  yEnd: number,
  xMax: number
): DonutHoleBounds | null {
  const bandH = yEnd - yStart + 1;
  if (bandH < 40 || xMax < 60) return null;

  const minColH = Math.max(10, Math.round(bandH * 0.08));
  const colCounts = new Int32Array(xMax);
  for (let x = 0; x < xMax; x++) {
    let cnt = 0;
    for (let y = yStart; y <= yEnd; y++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (sat > 35) cnt++;
    }
    colCounts[x] = cnt;
  }

  const maxGap = Math.max(3, Math.round(w * 0.004));
  const minRingWidth = Math.max(28, Math.round(bandH * 0.14));
  let bestScore = -1;
  let bestX0 = 0;
  let bestX1 = 0;
  let x = 0;
  while (x < xMax) {
    if (colCounts[x] >= minColH) {
      const c0 = x;
      let sum = 0;
      let lastActive = x;
      let gap = 0;
      while (x < xMax) {
        if (colCounts[x] >= minColH) {
          sum += colCounts[x];
          lastActive = x;
          gap = 0;
        } else {
          gap++;
          if (gap > maxGap) break;
        }
        x++;
      }
      if (lastActive - c0 + 1 >= minRingWidth && sum > bestScore) {
        bestScore = sum;
        bestX0 = c0;
        bestX1 = lastActive;
      }
    } else {
      x++;
    }
  }
  if (bestScore <= 0) return null;

  const ringW = bestX1 - bestX0 + 1;
  const minRowW = Math.max(8, Math.round(ringW * 0.15));
  let bestYScore = -1;
  let bestY0 = yStart;
  let bestY1 = yEnd;
  let y = yStart;
  while (y <= yEnd) {
    let cnt = 0;
    for (let xx = bestX0; xx <= bestX1; xx++) {
      const idx = (y * w + xx) * 4;
      const sat =
        Math.max(data[idx], data[idx + 1], data[idx + 2]) -
        Math.min(data[idx], data[idx + 1], data[idx + 2]);
      if (sat > 35) cnt++;
    }
    if (cnt >= minRowW) {
      const r0 = y;
      let sum = cnt;
      let lastY = y;
      let gap = 0;
      y++;
      while (y <= yEnd) {
        let c2 = 0;
        for (let xx = bestX0; xx <= bestX1; xx++) {
          const idx = (y * w + xx) * 4;
          const sat =
            Math.max(data[idx], data[idx + 1], data[idx + 2]) -
            Math.min(data[idx], data[idx + 1], data[idx + 2]);
          if (sat > 35) c2++;
        }
        if (c2 >= minRowW) {
          sum += c2;
          lastY = y;
          gap = 0;
        } else {
          gap++;
          if (gap > maxGap) break;
        }
        y++;
      }
      if (sum > bestYScore) {
        bestYScore = sum;
        bestY0 = r0;
        bestY1 = lastY;
      }
    } else {
      y++;
    }
  }

  const ringH = bestY1 - bestY0 + 1;
  if (ringH < 30) return null;
  const ratio = ringW / ringH;
  if (ratio < 0.65 || ratio > 1.45) return null;

  return {
    rx0: bestX0,
    rx1: bestX1,
    ry0: bestY0,
    ry1: bestY1,
    cx: (bestX0 + bestX1) / 2,
    cy: (bestY0 + bestY1) / 2,
  };
}

/**
 * Ekstrak gambar lubang tengah (inner hole) dari ring atas (Backlog) dan/atau ring bawah (To Expedite),
 * di-upscale 5-7x dengan padding putih dan kontras tinggi agar angka tengah terbaca bebas tabel kanan.
 */
async function extractDonutHoleImages(
  dataUrl: string,
  hasBacklog: boolean,
  hasExpedite: boolean,
  isFull: boolean
): Promise<Partial<Record<"Backlog" | "To Expedite", string>>> {
  const result: Partial<Record<"Backlog" | "To Expedite", string>> = {};
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w < 120 || h < 60) return result;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) return result;
  srcCtx.drawImage(img, 0, 0);

  let data: Uint8ClampedArray;
  try {
    data = srcCtx.getImageData(0, 0, w, h).data;
  } catch {
    return result;
  }

  const xMax = Math.round(w * (isFull ? 0.48 : 0.72));
  const renderHole = (bounds: DonutHoleBounds): string | null => {
    const size = Math.min(bounds.rx1 - bounds.rx0, bounds.ry1 - bounds.ry0);
    const half = Math.max(8, size * 0.22);
    const sx = Math.max(0, Math.round(bounds.cx - half));
    const sy = Math.max(0, Math.round(bounds.cy - half));
    const sw = Math.min(w - sx, Math.round(half * 2));
    const sh = Math.min(h - sy, Math.round(half * 2));
    if (sw < 14 || sh < 14) return null;

    const scale = Math.max(4, Math.min(8, Math.round(220 / Math.max(sw, sh))));
    const pad = 36;
    const cw = sw * scale + pad * 2;
    const ch = sh * scale + pad * 2;
    const outCanvas = document.createElement("canvas");
    outCanvas.width = cw;
    outCanvas.height = ch;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) return null;

    outCtx.fillStyle = "#ffffff";
    outCtx.fillRect(0, 0, cw, ch);
    outCtx.imageSmoothingQuality = "high";
    outCtx.drawImage(img, sx, sy, sw, sh, pad, pad, sw * scale, sh * scale);

    const outImg = outCtx.getImageData(0, 0, cw, ch);
    const od = outImg.data;
    for (let i = 0; i < od.length; i += 4) {
      const r = od[i];
      const g = od[i + 1];
      const b = od[i + 2];
      const max = Math.max(r, g, b);
      const sat = max - Math.min(r, g, b);
      if (sat > 24 && (max > 155 || sat > 45)) {
        od[i] = od[i + 1] = od[i + 2] = 255;
        continue;
      }
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const v = lum < 155 ? 0 : lum >= 202 ? 255 : Math.round(((lum - 155) / 47) * 255);
      od[i] = od[i + 1] = od[i + 2] = v;
    }
    outCtx.putImageData(outImg, 0, 0);
    return outCanvas.toDataURL("image/png");
  };

  if (hasBacklog && hasExpedite) {
    const topBounds = detectColoredDonutInBand(data, w, 0, Math.round(h * 0.54), xMax);
    if (topBounds) {
      const topUrl = renderHole(topBounds);
      if (topUrl) result["Backlog"] = topUrl;
    }
    const botStart = topBounds ? Math.min(h - 2, topBounds.ry1 + 6) : Math.round(h * 0.44);
    const botBounds = detectColoredDonutInBand(data, w, botStart, h - 1, xMax);
    if (botBounds) {
      const botUrl = renderHole(botBounds);
      if (botUrl) result["To Expedite"] = botUrl;
    }
  } else if (hasBacklog) {
    const bounds = detectColoredDonutInBand(data, w, 0, h - 1, xMax);
    if (bounds) {
      const url = renderHole(bounds);
      if (url) result["Backlog"] = url;
    }
  } else if (hasExpedite) {
    const bounds = detectColoredDonutInBand(data, w, 0, h - 1, xMax);
    if (bounds) {
      const url = renderHole(bounds);
      if (url) result["To Expedite"] = url;
    }
  }

  return result;
}

/**
 * Deteksi batas kiri area konten (melewati sidebar navigasi gelap SPX jika screenshot full-layar)
 * dan titik tengah antara panel kiri (In Hub / Fleet Head Counts) & panel kanan (Fleet status / Fleet Productivity).
 */
async function detectDashboardContentBounds(
  dataUrl: string
): Promise<{ contentLeft: number; contentMid: number }> {
  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < 400 || h < 200) return { contentLeft: 0, contentMid: 0.5 };

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { contentLeft: 0, contentMid: 0.5 };
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;

    const maxScanX = Math.round(w * 0.30);
    const yStart = Math.round(h * 0.25);
    const yEnd = Math.round(h * 0.75);
    const yStep = Math.max(4, Math.round(h / 60));

    let darkEnd = 0;
    for (let x = 0; x < maxScanX; x++) {
      let sum = 0;
      let n = 0;
      for (let y = yStart; y < yEnd; y += yStep) {
        const idx = (y * w + x) * 4;
        sum += 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
        n++;
      }
      const avg = n > 0 ? sum / n : 255;
      if (x < 20 && avg >= 100) break; // tidak ada sidebar gelap
      if (avg < 100) darkEnd = x;
      else if (darkEnd > 0 && avg > 180) break;
    }

    const contentLeft = darkEnd > 40 ? Math.min(0.32, (darkEnd + 2) / w) : 0;
    const contentMid = contentLeft + (1 - contentLeft) * 0.5;
    return { contentLeft, contentMid };
  } catch {
    return { contentLeft: 0, contentMid: 0.5 };
  }
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

/**
 * Normalisasi kontras (auto-level) pada gambar grayscale:
 * - Piksel latar terang (>= 236) diputihkan ke 255 agar bebas noise abu-abu kartu FMS
 * - Piksel teks gelap (< 236) diregangkan kontrasnya agar tepi angka lebih tegas bagi LSTM Tesseract
 */
async function enhanceGrayscaleForOcr(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0);
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    const whiteClip = 236;
    const blackClip = 35;
    const span = whiteClip - blackClip;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i];
      let v: number;
      if (g >= whiteClip) {
        v = 255;
      } else if (g <= blackClip) {
        v = 0;
      } else {
        const norm = (g - blackClip) / span;
        v = Math.round(Math.pow(norm, 1.15) * 255);
      }
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
  } catch {
    return dataUrl;
  }
  return canvas.toDataURL("image/png");
}

const METRIC_WORD_RE =
  /^\d[\d.,/%-]*$|^(?:transported|received|assigning|assigned|delivering|delivered|on-?hold|volume|total|dedicated|kurir|plus|mitra|backlog|expedite|parcel|sweeper|scanned|2wh|4wh|order|hub|status)$/i;

interface TesseractPageLike {
  confidence?: number;
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: Array<{
        words?: Array<{ text?: string; confidence?: number }>;
      }>;
    }>;
  }> | null;
}

/**
 * Ekstrak confidence dari token kata & angka metrik (mengabaikan noise ikon/logo UI)
 * sekaligus mencatat confidence tertinggi per nilai angka ke dalam tokenMap.
 */
function collectPageTokenConfidence(
  data: TesseractPageLike,
  tokenMap: Record<string, number>
): number {
  const pageConf = data.confidence ?? 0;
  const relevantConfs: number[] = [];

  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        for (const word of line.words || []) {
          const raw = (word.text || "").trim();
          const conf = word.confidence ?? 0;
          if (!raw || conf <= 0) continue;

          if (METRIC_WORD_RE.test(raw) && conf >= 45) {
            relevantConfs.push(conf);
          }

          const numMatches = raw.match(/\d+(?:[.,]\d+)?/g);
          if (numMatches) {
            for (const nm of numMatches) {
              const cleanInt = nm.replace(/[.,]/g, "");
              const rounded = Math.round(conf);
              tokenMap[nm] = Math.max(tokenMap[nm] ?? 0, rounded);
              if (cleanInt) {
                tokenMap[cleanInt] = Math.max(tokenMap[cleanInt] ?? 0, rounded);
              }
            }
          }
        }
      }
    }
  }

  if (relevantConfs.length >= 3) {
    const avgRelevant =
      relevantConfs.reduce((sum, v) => sum + v, 0) / relevantConfs.length;
    return Math.round(Math.max(pageConf, avgRelevant));
  }
  return Math.round(pageConf);
}

export interface LocalOcrResult {
  texts: string[];
  sparseTexts: string[];
  confidences: number[];
  tokenConfidences: Record<string, number>[];
  altTexts: string[];
  extraTexts: string[][];
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
  const tokenConfidences: Record<string, number>[] = [];
  const altTexts: string[] = [];
  const extraTexts: string[][] = [];

  for (let i = 0; i < images.length; i++) {
    if (hooks?.isCancelled?.()) throw new OcrCancelledError();
    hooks?.onProgress?.(`Memproses screenshot ${i + 1}/${images.length}…`);
    const { dataUrl: processed, isFull } = await preprocessForOcr(images[i]);
    // Screenshot penuh -> mode 3 (otomatis, cocok untuk dashboard/tabel).
    // Potongan kecil -> mode 6 (blok teks).
    const mainMode = isFull ? "3" : "6";
    const tokenMap: Record<string, number> = {};

    await worker.setParameters({ tessedit_pageseg_mode: mainMode as never });
    // Baca 2 kali dengan binarisasi berbeda, lalu cocokkan silang
    // (meniru pendekatan script referensi agar salah baca tidak lolos diam-diam).
    // Bacaan 1 = grayscale yang telah di-auto-level kontrasnya; bacaan 2 = biner ambang 200 dari luminance asli.
    const bin200 = await binarizeForOcr(processed, 200);
    const enhanced = await enhanceGrayscaleForOcr(processed);
    const r200 = await worker.recognize(enhanced, {}, { text: true, blocks: true });
    const r225 = await worker.recognize(bin200, {}, { text: true, blocks: true });
    const c1 = collectPageTokenConfidence(r200.data, tokenMap);
    const c2 = collectPageTokenConfidence(r225.data, tokenMap);
    texts.push(r200.data.text);
    altTexts.push(r225.data.text);
    confidences.push(Math.max(c1, c2));

    try {
      await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
      const sp = await worker.recognize(enhanced, {}, { text: true, blocks: true });
      collectPageTokenConfidence(sp.data, tokenMap);
      sparseTexts.push(sp.data.text);
    } catch {
      sparseTexts.push("");
    } finally {
      await worker.setParameters({ tessedit_pageseg_mode: mainMode as never });
    }

    // Fallback crop per zona tabel jika Operation Progress penuh belum membaca semua baris In Hub / Fleet Status / Head Counts
    const combinedMain = `${r200.data.text}\n${r225.data.text}`;
    const isParcelSweeper = isParcelSweeperPage(combinedMain);
    const hasOpBody =
      /In\s+Hub\s+Status|F[il1][aeo]{1,3}[rt]\s+(?:H[aeo]{2,3}[ad]\s+C[o0][au][nr][tl]s?|P[a-z]{0,3}[o0]du[ce]tiv|stat)|Clear\s+Fl?[o0]{2}r\s+Rate|To\s+Handover|To\s+Deliver/i.test(
        combinedMain
      );
    const isOpProgress =
      isFull &&
      !isParcelSweeper &&
      (hasOpBody ||
        (/Operation\s+Progress/i.test(combinedMain) && !/Backlog[\s\S]*To\s+Expedite/i.test(combinedMain)));
    const hasBacklogWord = /Backlog/i.test(combinedMain);
    const hasExpediteWord = /To\s*Expedit/i.test(combinedMain);
    const isBacklogExp =
      !isParcelSweeper &&
      !hasOpBody &&
      ((isFull &&
        ((hasBacklogWord && /To\s*Expedit|Linehaul|Aging/i.test(combinedMain)) || hasExpediteWord)) ||
        (!isFull && (hasBacklogWord || hasExpediteWord)));

    const crops: string[] = [];
    if (isOpProgress) {
      const onHoldRe =
        /\b(?:[oq0]n[\s\-r]*[hn][o0a][il1tk]{0,2}d|[oq0]nh[o0][il1]e|an[\s\-]+h[o0]l?d)\b[ \t:-]*(\d[\d.,]*)[ \t]+(\d[\d.,]*|-)/i;
      const checkValidOh = (txt: string) => {
        const m = txt.match(onHoldRe);
        if (!m) return null;
        if (m[2] === "-") return true;
        const v = parseInt(m[1].replace(/[.,]/g, ""), 10);
        const t = parseInt(m[2].replace(/[.,]/g, ""), 10);
        return !isNaN(v) && !isNaN(t) && t >= v ? t : false;
      };
      const oh1 = checkValidOh(r200.data.text);
      const oh2 = checkValidOh(r225.data.text);
      // Jalankan crop On-hold bila salah satu pass gagal, Total < Volume (mis. 13 < 103), atau dua pass berbeda Total-nya
      const hasOnHoldNums =
        (oh1 !== null && oh1 !== false) &&
        (oh2 === null || (oh2 !== false && oh2 === oh1));
      const hasInHubAll =
        /\b(?:[TI]ransp[o0]rt(?:ed)?|Iranspored)\b[^\n]*\d/i.test(combinedMain) &&
        /\bR[eo][ce][aeiu]{1,3}[tv]?[ea]?d\b[^\n]*\d/i.test(combinedMain) &&
        /\bA[sS][a-z]{2,5}[gn]g\b[^\n]*\d/i.test(combinedMain) &&
        /\bA[sm]{1,2}[a-z]{1,4}n[aeo]?d\b[^\n]*\d/i.test(combinedMain);
      // Pastikan rasio Fleet Productivity ("Delivered / Handed Over", "Orders") tidak memicu skip crop Fleet Head Counts
      const stripProd = (txt: string) =>
        txt
          .replace(/(?:\b\d\s+)?F[il1][aeo]{1,3}[rt]\s+P[a-z0-9]{0,3}[o0]du[ce]t[il1v]{1,3}[il1a-z]{1,6}[\s\S]*/i, "")
          .split(/\r?\n/)
          .map((l) => {
            const cut = l.search(/Delivered\s*\/\s*Handed|\b\d+\s*Orders?\b/i);
            return cut !== -1 ? l.slice(0, cut) : l;
          })
          .join("\n");
      const fhcTexts = [stripProd(r200.data.text), stripProd(r225.data.text)];
      const hasFhcRatios = fhcTexts.every(
        (t) =>
          /(?:2|Z)\s*W\s*H[^\n]*(?:\d+\s*\/\s*\d+[^\n]*){3}/i.test(t) &&
          /(?:4|A)\s*W\s*H[^\n]*(?:\d+\s*\/\s*\d+[^\n]*){3}/i.test(t)
      );
      const isDashFhc = /-\s*\/\s*-|Attendance\s+Rate\s*[-~]\s*%/i.test(fhcTexts.join("\n"));

      const { contentLeft, contentMid } = await detectDashboardContentBounds(images[i]);
      const leftCardW = Math.max(0.25, contentMid - contentLeft - 0.008);
      const rightCardX = Math.max(0.45, contentMid - 0.02);
      const regions: { tag?: string; rect: [number, number, number, number]; binAlso: boolean }[] = [];
      if (!hasOnHoldNums) {
        regions.push({ rect: [rightCardX, 0.20, 1 - rightCardX, 0.42], binAlso: true });
      }
      if (!hasInHubAll) {
        regions.push({ rect: [contentLeft, 0.20, leftCardW, 0.36], binAlso: false });
      }
      // Selalu isolasi kartu kiri Fleet Head Counts (di kiri sidebar->contentMid) bila rasio belum lengkap atau Fleet Productivity ikut tampil di kanan
      const hasRightProductivity =
        /F[il1][aeo]{1,3}[rt]\s+P[a-z0-9]{0,3}[o0]du|Orders?\b|Delivered\s*\/\s*Handed/i.test(combinedMain);
      if (!isDashFhc && (!hasFhcRatios || hasRightProductivity)) {
        regions.push({
          tag: "__FHC_LEFT__",
          rect: [contentLeft, 0.48, leftCardW, 0.52],
          binAlso: true,
        });
      }

      if (regions.length > 0) {
        try {
          await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
          for (const { tag, rect: [sx, sy, sw, sh], binAlso } of regions) {
            const cropUrl = await cropRegionForOcr(images[i], sx, sy, sw, sh);
            if (!cropUrl) continue;
            const prefix = tag ? `${tag}\n` : "";
            const enhancedCrop = await enhanceGrayscaleForOcr(cropUrl);
            const res = await worker.recognize(enhancedCrop, {}, { text: true, blocks: true });
            collectPageTokenConfidence(res.data, tokenMap);
            if (res.data.text) crops.push(`${prefix}${res.data.text}`);
            // Untuk Fleet Head Counts (kiri-bawah) & On-hold (kanan-atas), coba juga binarized 200 bila grayscale salah baca digit tipis
            if (binAlso) {
              const binCropUrl = await binarizeForOcr(cropUrl, 200);
              const resBin = await worker.recognize(binCropUrl, {}, { text: true, blocks: true });
              collectPageTokenConfidence(resBin.data, tokenMap);
              if (resBin.data.text) crops.push(`${prefix}${resBin.data.text}`);
            }
          }
        } catch {
          // abaikan error crop fallback
        } finally {
          await worker.setParameters({ tessedit_pageseg_mode: mainMode as never });
        }
      }
    }
    if (isBacklogExp) {
      try {
        // 1. Prioritas utama: deteksi lubang tengah ring atas (Backlog) dan ring bawah (To Expedite) secara geometris
        const ringHoles = await extractDonutHoleImages(
          images[i],
          hasBacklogWord,
          hasExpediteWord,
          isFull
        );
        const solvedPrefixes = new Set<string>();
        const holeEntries = Object.entries(ringHoles) as Array<["Backlog" | "To Expedite", string]>;
        if (holeEntries.length > 0) {
          await worker.setParameters({
            tessedit_pageseg_mode: "7" as never,
            tessedit_char_whitelist: "0123456789.,",
          });
          for (const [prefix, holeUrl] of holeEntries) {
            let resHole = await worker.recognize(holeUrl, {}, { text: true, blocks: true });
            collectPageTokenConfidence(resHole.data, tokenMap);
            let digits = (resHole.data.text || "").replace(/[^\d.,]/g, "").trim();
            if (!/\d/.test(digits)) {
              await worker.setParameters({ tessedit_pageseg_mode: "8" as never });
              resHole = await worker.recognize(holeUrl, {}, { text: true, blocks: true });
              collectPageTokenConfidence(resHole.data, tokenMap);
              digits = (resHole.data.text || "").replace(/[^\d.,]/g, "").trim();
              await worker.setParameters({ tessedit_pageseg_mode: "7" as never });
            }
            if (/^\d[\d.,]*$/.test(digits)) {
              crops.push(`${prefix} [RING]\n${digits}`);
              solvedPrefixes.add(prefix);
            }
          }
          await worker.setParameters({ tessedit_char_whitelist: "" });
        }

        // 2. Fallback crop kartu (mis. saat donut 0 berwarna abu-abu penuh tanpa warna)
        await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
        const donutRegions: [string, number, number, number, number, number][] = [];
        if (isFull) {
          if (hasBacklogWord) {
            if (!solvedPrefixes.has("Backlog")) {
              donutRegions.push(["Backlog", 0.01, 0.05, 0.32, 0.43, 195]);
            }
            if (!solvedPrefixes.has("To Expedite")) {
              donutRegions.push(["To Expedite", 0.01, 0.52, 0.32, 0.46, 195]);
            }
          } else if (!solvedPrefixes.has("To Expedite")) {
            donutRegions.push(["To Expedite", 0.01, 0.08, 0.34, 0.85, 195]);
          }
        } else {
          const hasRightSidePanel = /Aging|To\s+Buyer|Linehaul|Transporting/i.test(combinedMain);
          const cropW = hasRightSidePanel ? 0.52 : 1;
          if (hasBacklogWord && hasExpediteWord) {
            if (!solvedPrefixes.has("Backlog")) donutRegions.push(["Backlog", 0, 0, cropW, 0.5, 195]);
            if (!solvedPrefixes.has("To Expedite")) donutRegions.push(["To Expedite", 0, 0.5, cropW, 0.5, 195]);
          } else if (hasBacklogWord && !solvedPrefixes.has("Backlog")) {
            donutRegions.push(["Backlog", 0, 0, cropW, 1, 195]);
          } else if (!solvedPrefixes.has("To Expedite")) {
            donutRegions.push(["To Expedite", 0, 0, cropW, 1, 195]);
          }
        }
        const badCropRe =
          /Operation\s+Progress|Fleet\s+Head|Fleet\s+Productivity|Dedicated|Aging|To\s+Buyer|Linehaul/i;
        for (const [prefix, sx, sy, sw, sh, thr] of donutRegions) {
          const cropUrl = await cropRegionForOcr(images[i], sx, sy, sw, sh, true);
          if (!cropUrl) continue;
          const binUrl = await binarizeForOcr(cropUrl, thr);
          const resBin = await worker.recognize(binUrl, {}, { text: true, blocks: true });
          collectPageTokenConfidence(resBin.data, tokenMap);
          let bestText = resBin.data.text || "";
          // Jika hasil binerisasi belum menangkap angka bulat non-persen di tengah donut, coba enhance grayscale pada crop yang sudah bebas ring warna
          if (!/(?:^|[\s\n])\d[\d.]*(?![\d,%])/.test(bestText)) {
            const enhUrl = await enhanceGrayscaleForOcr(cropUrl);
            const resEnh = await worker.recognize(enhUrl, {}, { text: true, blocks: true });
            collectPageTokenConfidence(resEnh.data, tokenMap);
            if (/(?:^|[\s\n])\d[\d.]*(?![\d,%])/.test(resEnh.data.text || "")) {
              bestText = resEnh.data.text;
            }
          }
          if (bestText && !badCropRe.test(bestText)) {
            crops.push(`${prefix}\n${bestText}`);
          }
        }
      } catch {
        // abaikan error crop donut Backlog/Expedite
      } finally {
        await worker.setParameters({
          tessedit_pageseg_mode: mainMode as never,
          tessedit_char_whitelist: "",
        });
      }
    }
    tokenConfidences.push(tokenMap);
    extraTexts.push(crops);
  }

  return { texts, sparseTexts, confidences, tokenConfidences, altTexts, extraTexts };
}
