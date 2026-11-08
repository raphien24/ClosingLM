import { createWorker } from "tesseract.js";
import sharp from "sharp";
import fs from "fs";
const files = ["C:/Users/rafia/Downloads/Screenshot_10.png","C:/Users/rafia/Downloads/Screenshot_11.png"];
for (const f of files) {
  if(!fs.existsSync(f)) { console.log("MISSING "+f); continue; }
  const buf = fs.readFileSync(f);
  const meta = await sharp(buf).metadata();
  const origW = meta.width || 1280;
  let tw = origW; if (origW < 2000) tw = Math.min(3200, origW*2); else if (origW > 3200) tw = 3200;
  const proc = await sharp(buf).resize({ width: tw, withoutEnlargement: true }).grayscale().normalize().sharpen({ sigma: 1.0 }).png({ compressionLevel: 1 }).toBuffer();
  const asli = await sharp(buf).grayscale().normalize().sharpen({ sigma: 1.0 }).png({ compressionLevel: 1 }).toBuffer();
  for (const [label, b] of [["adaptive("+tw+")", proc],["asli("+origW+")", asli]]) {
    const worker = await createWorker("eng", 1, { logger: () => {}, langPath: process.cwd(), cachePath: process.cwd() });
    await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    const t0 = Date.now();
    await worker.recognize(b);
    const ms = Date.now()-t0;
    await worker.terminate();
    console.log(f.split("/").pop()+" | "+label+" | "+ms+" ms | "+Math.round(b.length/1024)+" KB");
  }
}
