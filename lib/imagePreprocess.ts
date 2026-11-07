import sharp from "sharp";

/**
 * Pre-process gambar sebelum OCR untuk meningkatkan akurasi Tesseract.
 * Teknik yang diterapkan (berurutan):
 *
 * 1. Scale up 3x — Tesseract bekerja jauh lebih baik pada gambar besar.
 *    Teks kecil di UI FMS (~12-14px) menjadi ~36-42px setelah scale.
 *
 * 2. Grayscale — hilangkan noise warna, OCR fokus ke kontur teks.
 *
 * 3. Sharpen — perjelas tepi karakter yang blur akibat screenshot compression.
 *
 * 4. Normalize — sesuaikan rentang brightness agar teks lebih kontras.
 *
 * 5. Threshold (binary) — konversi ke hitam-putih murni.
 *    Teks gelap → hitam, background → putih. Tesseract paling akurat
 *    pada gambar binary B&W.
 *
 * Input: base64 string (dengan atau tanpa data URL prefix)
 * Output: base64 PNG yang sudah diproses
 */
export async function preprocessImage(base64Input: string): Promise<string> {
  // Hapus data URL prefix jika ada
  const base64Clean = base64Input.replace(/^data:image\/\w+;base64,/, "");
  const inputBuffer = Buffer.from(base64Clean, "base64");

  // Dapatkan metadata untuk hitung ukuran setelah scale
  const meta = await sharp(inputBuffer).metadata();
  const width  = (meta.width  || 1280) * 3;
  const height = (meta.height || 800)  * 3;

  const outputBuffer = await sharp(inputBuffer)
    // 1. Scale up 3x dengan algoritma Lanczos (kualitas terbaik)
    .resize(width, height, { kernel: sharp.kernel.lanczos3 })
    // 2. Grayscale
    .grayscale()
    // 3. Sharpen — sigma kecil untuk teks, tidak blur terlalu besar
    .sharpen({ sigma: 1.5, m1: 0.5, m2: 0.5 })
    // 4. Normalize brightness & contrast
    .normalize()
    // 5. Threshold: pixel < 180 → hitam, ≥ 180 → putih
    //    Angka 180 (dari 0-255) dipilih agar teks abu-abu tetap terbaca
    .threshold(180)
    // Output sebagai PNG (lossless, lebih baik untuk OCR vs JPEG)
    .png()
    .toBuffer();

  return "data:image/png;base64," + outputBuffer.toString("base64");
}

/**
 * Versi ringan untuk gambar yang sudah cukup kontras.
 * Hanya scale + grayscale + normalize, tanpa threshold agresif.
 * Berguna jika threshold standar menghasilkan artefak.
 */
export async function preprocessImageLight(base64Input: string): Promise<string> {
  const base64Clean = base64Input.replace(/^data:image\/\w+;base64,/, "");
  const inputBuffer = Buffer.from(base64Clean, "base64");

  const meta = await sharp(inputBuffer).metadata();
  const width  = (meta.width  || 1280) * 2;
  const height = (meta.height || 800)  * 2;

  const outputBuffer = await sharp(inputBuffer)
    .resize(width, height, { kernel: sharp.kernel.lanczos3 })
    .grayscale()
    .sharpen({ sigma: 1.0 })
    .normalize()
    .png()
    .toBuffer();

  return "data:image/png;base64," + outputBuffer.toString("base64");
}
