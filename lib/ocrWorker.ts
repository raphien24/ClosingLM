import { createWorker, Worker } from "tesseract.js";
import path from "path";
import fs from "fs";

// Singleton worker di memori server agar tidak load traineddata berulang kali.
// Di Vercel instance serverless bisa mati saat idle, jadi worker ikut hilang.
// Endpoint /api/ocr/warmup dipanggil berkala oleh cron agar worker tetap hangat.
let cachedWorkerPromise: Promise<Worker> | null = null;

export function getOcrWorker(): Promise<Worker> {
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

export function resetOcrWorker(): void {
  cachedWorkerPromise = null;
}
