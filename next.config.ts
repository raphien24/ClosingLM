import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis", "google-auth-library", "tesseract.js", "sharp"],
  outputFileTracingIncludes: {
    "/api/ocr": [
      "./eng.traineddata",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
    "/api/ocr/warmup": [
      "./eng.traineddata",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
};

export default nextConfig;