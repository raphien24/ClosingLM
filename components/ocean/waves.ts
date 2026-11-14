/**
 * Definisi gelombang Gerstner bersama (GPU + CPU) untuk laut sunset realistis.
 * Setiap gelombang: [arah.x, arah.z, steepness (Q), panjang gelombang (meter)].
 * Total steepness < 1 agar puncak ombak tidak saling melipat (self-intersect).
 */
export type GerstnerWave = [dirX: number, dirZ: number, steepness: number, wavelength: number];

export const SUNSET_WAVES: GerstnerWave[] = [
  [1.0, 0.25, 0.085, 88],  // swell panjang dari laut lepas
  [0.6, -0.8, 0.1, 47],    // swell menyilang
  [-0.3, 1.0, 0.11, 23],   // ombak menengah
  [0.85, 0.5, 0.1, 12],    // riak angin
  [0.2, -1.0, 0.08, 6.5],  // riak kecil
];

/** Faktor perlambatan waktu supaya laut terasa tenang di sore hari */
export const WAVE_TIME_SCALE = 0.75;

const G = 9.8;

/** Normalisasi arah & hitung konstanta per gelombang (dipakai CPU) */
const PRECOMPUTED = SUNSET_WAVES.map(([dx, dz, q, wl]) => {
  const len = Math.hypot(dx, dz) || 1;
  const k = (2 * Math.PI) / wl;
  return { dx: dx / len, dz: dz / len, q, k, c: Math.sqrt(G / k), a: q / k };
});

/**
 * Perkiraan tinggi permukaan laut di titik (x, z) pada waktu t.
 * Dipakai untuk membuat kapal naik-turun & oleng mengikuti ombak yang sama dengan shader.
 */
export function sampleWaveHeight(x: number, z: number, t: number): number {
  const time = t * WAVE_TIME_SCALE;
  let y = 0;
  for (const w of PRECOMPUTED) {
    const f = w.k * (w.dx * x + w.dz * z - w.c * time);
    y += w.a * Math.sin(f);
  }
  return y;
}

/** Uniform vec4[] untuk shader */
export function wavesAsVec4Array(): number[][] {
  return SUNSET_WAVES.map(([dx, dz, q, wl]) => {
    const len = Math.hypot(dx, dz) || 1;
    return [dx / len, dz / len, q, wl];
  });
}

/** Potongan GLSL fungsi Gerstner (ditanam ke vertex shader Water) */
export const GERSTNER_GLSL = /* glsl */ `
  #define WAVE_COUNT ${SUNSET_WAVES.length}
  uniform vec4 waves[WAVE_COUNT];
  uniform float waveTime;
  varying vec3 vWaveNormal;
  varying float vWaveHeight;

  vec3 gerstner(vec4 wave, vec2 p, float fade, inout vec3 tangent, inout vec3 binormal) {
    vec2 d = wave.xy;
    float q = wave.z * fade;
    float wl = wave.w;
    float k = 6.28318530718 / wl;
    float c = sqrt(9.8 / k);
    float f = k * (dot(d, p) - c * waveTime);
    float a = q / k;
    float s = sin(f);
    float co = cos(f);
    tangent += vec3(-d.x * d.x * q * s, d.x * q * co, -d.x * d.y * q * s);
    binormal += vec3(-d.x * d.y * q * s, d.y * q * co, -d.y * d.y * q * s);
    return vec3(d.x * a * co, a * s, d.y * a * co);
  }
`;
