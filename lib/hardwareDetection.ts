"use client";

export type PerformanceMode = "light" | "high";

const STORAGE_KEY = "jtt08_perf_mode";
const LISTENERS: Set<(mode: PerformanceMode) => void> = new Set();

let _cachedSpecs: {
  isLowSpec: boolean;
  reason: string;
  gpuRenderer?: string;
  cores?: number;
  memory?: number;
} | null = null;

/**
 * Deteksi spesifikasi hardware perangkat pengguna secara akurat (CPU, RAM, GPU, Mobile)
 */
export function detectHardwareSpecs(): {
  isLowSpec: boolean;
  reason: string;
  gpuRenderer?: string;
  cores?: number;
  memory?: number;
} {
  if (_cachedSpecs) return _cachedSpecs;

  if (typeof window === "undefined") {
    return { isLowSpec: false, reason: "ssr" };
  }

  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;
  const memory = typeof navigator !== "undefined" && "deviceMemory" in navigator
    ? (navigator as unknown as { deviceMemory?: number }).deviceMemory
    : undefined;
  const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  let gpuRenderer = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl && gl instanceof WebGLRenderingContext) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        gpuRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "";
      }
    }
  } catch {
    // Abaikan jika WebGL dibatasi
  }

  const gpuLower = gpuRenderer.toLowerCase();
  const isIntegratedOrSlowGpu =
    /intel|mali|adreno|powervr|apple gpu|geforce gt |geforce 9|geforce 8|radeon r|radeon hd|mesa|swiftshader|llvmpipe/i.test(
      gpuLower
    );

  // Kriteria perangkat spesifikasi rendah (low-spec):
  // 1. Mobile / Tablet
  // 2. CPU core <= 4
  // 3. RAM <= 4 GB
  // 4. Integrated / Low-tier GPU
  let isLow = false;
  const reasons: string[] = [];

  if (isMobile) {
    isLow = true;
    reasons.push("mobile/tablet");
  }
  if (cores !== undefined && cores <= 4) {
    isLow = true;
    reasons.push(`CPU ${cores} core`);
  }
  if (memory !== undefined && memory <= 4) {
    isLow = true;
    reasons.push(`RAM ${memory}GB`);
  }
  if (isIntegratedOrSlowGpu) {
    isLow = true;
    reasons.push("GPU terintegrasi");
  }

  _cachedSpecs = {
    isLowSpec: isLow,
    reason: reasons.join(", ") || "standard",
    gpuRenderer,
    cores,
    memory,
  };

  return _cachedSpecs;
}

/**
 * Cek apakah mode hemat / low-spec aktif (baik dari preferensi user atau deteksi otomatis)
 */
export function isLowSpecActive(): boolean {
  if (typeof window === "undefined") return false;
  const pref = localStorage.getItem(STORAGE_KEY);
  if (pref === "light") return true;
  if (pref === "high") return false;
  // Jika belum ada preferensi tersimpan, pakai hasil auto-deteksi
  return detectHardwareSpecs().isLowSpec;
}

export function getPerformanceMode(): PerformanceMode {
  return isLowSpecActive() ? "light" : "high";
}

export function setPerformanceMode(mode: PerformanceMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
  LISTENERS.forEach((cb) => {
    try {
      cb(mode);
    } catch (e) {
      console.error("PerfMode listener error", e);
    }
  });
}

export function subscribePerformanceMode(cb: (mode: PerformanceMode) => void): () => void {
  LISTENERS.add(cb);
  return () => {
    LISTENERS.delete(cb);
  };
}
