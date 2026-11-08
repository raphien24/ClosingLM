import { createWorker } from "tesseract.js";
import sharp from "sharp";
import fs from "fs";
const buf = fs.readFileSync("C:/Users/rafia/Downloads/Screenshot_9.png");
const meta = await sharp(buf).metadata();
const upW = Math.min(4000, meta.width * 2);
const processed = await sharp(buf).resize({ width: upW, withoutEnlargement: false }).grayscale().normalize().sharpen({ sigma: 1.0 }).png({ compressionLevel: 1 }).toBuffer();
const worker = await createWorker("eng", 1, { logger: () => {}, langPath: process.cwd(), cachePath: process.cwd() });
await worker.setParameters({ tessedit_pageseg_mode: "11", tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,%()-/: ", preserve_interword_spaces: "1" });
const { data } = await worker.recognize(processed);
const t = data.text;
console.log("=== PSM11 FULL (lines containing digits) ===");
for (const ln of t.split(/\r?\n/)) { if (/\d/.test(ln) && ln.trim().length < 60) console.log(ln); }
await worker.terminate();
