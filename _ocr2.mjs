import { createWorker } from "tesseract.js";
import sharp from "sharp";
import fs from "fs";

const buf = fs.readFileSync("C:/Users/rafia/Downloads/Screenshot_9.png");
const meta = await sharp(buf).metadata();
// Variant A: upscale 2x, grayscale, no threshold
const upW = Math.min(4000, meta.width * 2);
const processed = await sharp(buf).resize({ width: upW, withoutEnlargement: false }).grayscale().normalize().png({ compressionLevel: 1 }).toBuffer();
console.log("VARIANT upscale2x w="+upW+" bytes="+processed.length);
const worker = await createWorker("eng", 1, { logger: () => {}, langPath: process.cwd(), cachePath: process.cwd() });
await worker.setParameters({ tessedit_pageseg_mode: "6", tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,%()-/: ", preserve_interword_spaces: "1" });
const { data } = await worker.recognize(processed);
console.log("=== TEXT ===");
console.log(data.text);
console.log("=== conf "+data.confidence+" ===");
await worker.terminate();
