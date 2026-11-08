import { createWorker } from "tesseract.js";
import sharp from "sharp";
import fs from "fs";
for (const f of ["C:/Users/rafia/Downloads/Screenshot_10.png","C:/Users/rafia/Downloads/Screenshot_11.png"]) {
  const buf = fs.readFileSync(f);
  const asli = await sharp(buf).grayscale().normalize().sharpen({ sigma: 1.0 }).png({ compressionLevel: 1 }).toBuffer();
  const worker = await createWorker("eng", 1, { logger: () => {}, langPath: process.cwd(), cachePath: process.cwd() });
  await worker.setParameters({ tessedit_pageseg_mode: "6", tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,%()-/: ", preserve_interword_spaces: "1" });
  const { data } = await worker.recognize(asli);
  await worker.terminate();
  console.log("##### "+f.split("/").pop()+" (ASLI) conf="+data.confidence);
  console.log(data.text);
}
