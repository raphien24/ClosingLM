import type { NextConfig } from "next";

// tesseract.js memuat worker-script + dependency-nya secara dinamis saat runtime,
// jadi semua file itu harus dipaksa ikut ke dalam bundle Vercel serverless.
const tesseractTrace = [
  "./node_modules/tesseract.js/**/*",
  "./node_modules/tesseract.js-core/**/*",
  "./node_modules/bmp-js/**/*",
  "./node_modules/idb-keyval/**/*",
  "./node_modules/is-url/**/*",
  "./node_modules/node-fetch/**/*",
  "./node_modules/whatwg-url/**/*",
  "./node_modules/tr46/**/*",
  "./node_modules/webidl-conversions/**/*",
  "./node_modules/regenerator-runtime/**/*",
  "./node_modules/wasm-feature-detect/**/*",
  "./node_modules/zlibjs/**/*",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis", "google-auth-library", "tesseract.js", "sharp"],
  outputFileTracingIncludes: {
    "/api/ocr": ["./eng.traineddata", ...tesseractTrace],
    "/api/ocr/warmup": ["./eng.traineddata", ...tesseractTrace],
  },
};

export default nextConfig;