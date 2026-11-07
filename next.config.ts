import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis", "google-auth-library", "tesseract.js", "sharp"],
};

export default nextConfig;
