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
  shFrac: number
): Promise<string | null> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w < 400 || h < 200) return null;

  const sx = Math.round(w * sxFrac);
  const sy = Math.round(h * syFrac);
  const sw = Math.min(w - sx, Math.round(w * swFrac));
  const sh = Math.min(h - sy, Math.round(h * shFrac));
  if (sw < 50 || sh < 30) return null;
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
      isFull &&
      !isParcelSweeper &&
      ((hasBacklogWord && /To\s*Expedit|Linehaul|Aging/i.test(combinedMain)) ||
        (hasExpediteWord && !hasOpBody));

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
      // Pastikan rasio Fleet Productivity ("Delivered / Handed Over", "Order") tidak memicu skip crop Fleet Head Counts
      const stripProd = (txt: string) =>
        txt
          .replace(/(?:\b\d\s+)?F[il1][aeo]{1,3}[rt]\s+P[a-z]{0,3}[o0]du[ce]tiv[\s\S]*/i, "")
          .split(/\r?\n/)
          .map((l) => {
            const cut = l.search(/Delivered\s*\/\s*Handed|\b\d+\s*Order\b/i);
            return cut !== -1 ? l.slice(0, cut) : l;
          })
          .join("\n");
      const fhcTexts = [stripProd(r200.data.text), stripProd(r225.data.text)];
      const hasFhcRatios = fhcTexts.some(
        (t) =>
          /(?:2|Z)\s*W\s*H[^\n]*(?:\d+\s*\/\s*\d+[^\n]*){3}/i.test(t) &&
          /(?:4|A)\s*W\s*H[^\n]*(?:\d+\s*\/\s*\d+[^\n]*){3}/i.test(t)
      );
      const isDashFhc = /-\s*\/\s*-|Attendance\s+Rate\s*[-~]\s*%/i.test(fhcTexts.join("\n"));

      const regions: [number, number, number, number][] = [];
      if (!hasOnHoldNums) regions.push([0.46, 0.22, 0.54, 0.40]);
      if (!hasInHubAll) regions.push([0.0, 0.22, 0.50, 0.34]);
      if (!hasFhcRatios && !isDashFhc) regions.push([0.0, 0.50, 0.50, 0.50]);

      if (regions.length > 0) {
        try {
          await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
          for (const [sx, sy, sw, sh] of regions) {
            const cropUrl = await cropRegionForOcr(images[i], sx, sy, sw, sh);
            if (!cropUrl) continue;
            const enhancedCrop = await enhanceGrayscaleForOcr(cropUrl);
            const res = await worker.recognize(enhancedCrop, {}, { text: true, blocks: true });
            collectPageTokenConfidence(res.data, tokenMap);
            if (res.data.text) crops.push(res.data.text);
            // Untuk Fleet Head Counts (kiri-bawah) & On-hold (kanan-atas), coba juga binarized 200 bila grayscale salah baca digit tipis
            if (sy >= 0.49 || sx >= 0.45) {
              const binCropUrl = await binarizeForOcr(cropUrl, 200);
              const resBin = await worker.recognize(binCropUrl, {}, { text: true, blocks: true });
              collectPageTokenConfidence(resBin.data, tokenMap);
              if (resBin.data.text) crops.push(resBin.data.text);
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
        await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
        // Threshold berbeda sesuai warna donut: Backlog biru/oranye bersih di 180, To Expedite kuning/merah bersih di 200
        const donutRegions: [string, number, number, number, number, number][] = [];
        if (hasBacklogWord) {
          donutRegions.push(["Backlog", 0.02, 0.12, 0.28, 0.38, 180]);
          donutRegions.push(["To Expedite", 0.02, 0.56, 0.28, 0.38, 200]);
        } else {
          donutRegions.push(["To Expedite", 0.02, 0.10, 0.32, 0.80, 200]);
        }
        for (const [prefix, sx, sy, sw, sh, thr] of donutRegions) {
          const cropUrl = await cropRegionForOcr(images[i], sx, sy, sw, sh);
          if (!cropUrl) continue;
          const binUrl = await binarizeForOcr(cropUrl, thr);
          const resBin = await worker.recognize(binUrl, {}, { text: true, blocks: true });
          collectPageTokenConfidence(resBin.data, tokenMap);
          if (
            resBin.data.text &&
            !/Operation\s+Progress|Fleet\s+Head|Fleet\s+Productivity|Dedicated/i.test(resBin.data.text)
          ) {
            crops.push(`${prefix}\n${resBin.data.text}`);
          }
        }
      } catch {
        // abaikan error crop donut Backlog/Expedite
      } finally {
        await worker.setParameters({ tessedit_pageseg_mode: mainMode as never });
      }
    }
    tokenConfidences.push(tokenMap);
    extraTexts.push(crops);
  }

  return { texts, sparseTexts, confidences, tokenConfidences, altTexts, extraTexts };
}
