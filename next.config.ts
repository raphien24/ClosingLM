import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis", "google-auth-library", "tesseract.js", "sharp"],
  outputFileTracingIncludes: {
    "/api/ocr": ["./eng.traineddata"],
  },
};

export default nextConfig;
