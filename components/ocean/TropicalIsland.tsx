"use client";

/**
 * Pulau Tropis Realistis dengan Pantai Pasir Putih, Laguna Pirus,
 * Mercusuar Pantai, Dermaga Kayu & Perahu, Air Terjun Tebing,
 * Pohon Kelapa Melambai, Hutan Tropis, dan Huruf Besar 3D "LAST MILE" di Lereng Bukit.
 * Pulau menghadap ke arah -X (menyambut kapal yang melaju ke arah +X).
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Fungsi Noise Deterministik untuk Kontur Pulau ──────────────

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number, octaves = 4): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * (valueNoise(x * freq, z * freq) * 2 - 1);
    freq *= 2.04;
    amp *= 0.5;
  }
  return v;
}

/**
 * Hitung ketinggian permukaan pulau pada koordinat lokal (lx, lz).
 * Bagian depan pulau (pantai pasir putih) berada di lx ≈ -55 .. -15,
 * lereng bukit utama (tempat tulisan JTT08) di lx ≈ -12 .. +18,
 * dan puncak bukit di lx ≈ +15 .. +45.
 */
export function getIslandHeight(lx: number, lz: number): number {
  // Bentuk elips agak melengkung (teluk bulan sabit di sisi -X)
  const bayCurve = Math.exp(-(lz * lz) / 2200) * 10;
  const ex = (lx - bayCurve) / 78;
  const ez = lz / 96;
  const r2 = ex * ex + ez * ez;
  if (r2 >= 1.25) return -2.5;

  const mask = Math.max(0, 1 - r2);
  const smoothMask = mask * mask * (3 - 2 * mask);

  // Pantai landai di sisi depan (-X), naik menjadi bukit di sisi tengah & belakang (+X)
  const hillBias = THREE.MathUtils.smoothstep(lx, -38, 22);

  // Tiga punggung bukit tropis: bukit utama di tengah + dua bukit pengapit
  const mainPeak = Math.exp(-((lx - 18) ** 2) / 950 - (lz ** 2) / 1800) * 42;
  const leftPeak = Math.exp(-((lx - 24) ** 2) / 700 - ((lz + 48) ** 2) / 950) * 32;
  const rightPeak = Math.exp(-((lx - 22) ** 2) / 750 - ((lz - 46) ** 2) / 900) * 30;

  // Lereng rata khusus di bagian depan bukit utama untuk dudukan tulisan JTT08
  const signTerrace =
    Math.exp(-((lx + 2) ** 2) / 360 - (lz ** 2) / 1400) * 16.5;

  // Detail punggung bukit alami (FBM)
  const detail = fbm(lx * 0.045 + 3.1, lz * 0.045 + 7.4, 4) * (4.5 + hillBias * 7.5);
  const baseBeach = smoothMask * 5.2;

  const h =
    baseBeach +
    (mainPeak + leftPeak + rightPeak + signTerrace + detail) * smoothMask * (0.25 + 0.75 * hillBias);

  return h - 0.6;
}

// ── Tekstur Prosedural Daun Kelapa & Permukaan Pulau ───────────

let _palmFrondTex: THREE.CanvasTexture | null = null;
let _terrainDetailTex: THREE.CanvasTexture | null = null;

function getPalmFrondTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (_palmFrondTex) return _palmFrondTex;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 128);

  // Tulang daun tengah (rachis)
  const gradStem = ctx.createLinearGradient(0, 64, 256, 64);
  gradStem.addColorStop(0, "#4c6b28");
  gradStem.addColorStop(1, "#6f8f38");
  ctx.fillStyle = gradStem;
  ctx.beginPath();
  ctx.moveTo(0, 61);
  ctx.lineTo(252, 63.5);
  ctx.lineTo(252, 64.5);
  ctx.lineTo(0, 67);
  ctx.closePath();
  ctx.fill();

  // Helaian anak daun kelapa (pinnae) menyirip di kiri & kanan
  const numLeaflets = 34;
  for (let i = 1; i < numLeaflets; i++) {
    const u = i / numLeaflets;
    const x = u * 246;
    const envelope = Math.sin(Math.pow(u, 0.75) * Math.PI);
    const len = 54 * envelope;
    const width = 4.2 * (1 - u * 0.45);
    const slant = 14 + u * 18;

    for (const side of [-1, 1]) {
      const g = ctx.createLinearGradient(x, 64, x + slant, 64 + side * len);
      g.addColorStop(0, "#3d7426");
      g.addColorStop(0.55, "#589634");
      g.addColorStop(1, "#88be48");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.quadraticCurveTo(
        x + slant * 0.55,
        64 + side * len * 0.55,
        x + slant,
        64 + side * len
      );
      ctx.quadraticCurveTo(
        x + slant * 0.45 - width,
        64 + side * len * 0.5,
        x - width * 0.6,
        64
      );
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  _palmFrondTex = tex;
  return tex;
}

function getTerrainDetailTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (_terrainDetailTex) return _terrainDetailTex;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const n =
        valueNoise(x * 0.25, y * 0.25) * 0.6 +
        valueNoise(x * 0.8, y * 0.8) * 0.4;
      const c = Math.max(210, Math.min(255, Math.round(222 + n * 33)));
      const idx = (y * 256 + x) * 4;
      img.data[idx] = c;
      img.data[idx + 1] = c;
      img.data[idx + 2] = c;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.colorSpace = THREE.SRGBColorSpace;
  _terrainDetailTex = tex;
  return tex;
}

// ── Komponen Pohon Kelapa Realistis (CoconutPalmTree) ──────────

interface SharedPalmAssets {
  frondGeo: THREE.BufferGeometry;
  coconutGeo: THREE.SphereGeometry;
  trunkMat: THREE.MeshStandardMaterial;
  frondMat: THREE.MeshStandardMaterial;
  coconutMat: THREE.MeshStandardMaterial;
}

let _sharedPalmAssets: SharedPalmAssets | null = null;

function getSharedPalmAssets(): SharedPalmAssets {
  if (_sharedPalmAssets) return _sharedPalmAssets;

  const frondGeo = new THREE.PlaneGeometry(5.2, 2.35, 10, 4);
  frondGeo.rotateX(-Math.PI / 2);
  frondGeo.translate(2.55, 0, 0);
  const pos = frondGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const u = Math.max(0, x / 5.2);
    const archY = Math.sin(u * Math.PI * 0.78) * 0.72 - u * u * 1.45;
    const vFold = -Math.abs(z) * 0.28;
    pos.setY(i, pos.getY(i) + archY + vFold);
  }
  frondGeo.computeVertexNormals();

  const coconutGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: "#6b533e",
    roughness: 0.88,
    metalness: 0.02,
  });
  const frondMat = new THREE.MeshStandardMaterial({
    map: getPalmFrondTexture(),
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.6,
    metalness: 0.04,
  });
  const coconutMat = new THREE.MeshStandardMaterial({
    color: "#4a3219",
    roughness: 0.65,
  });

  _sharedPalmAssets = { frondGeo, coconutGeo, trunkMat, frondMat, coconutMat };
  return _sharedPalmAssets;
}

function CoconutPalmTree({
  position,
  scale = 1,
  leanAngle = 0.22,
  leanYaw = Math.PI,
  isLowSpec = false,
}: {
  position: [number, number, number];
  scale?: number;
  leanAngle?: number;
  leanYaw?: number;
  phase?: number;
  isLowSpec?: boolean;
}) {
  const { frondGeo, coconutGeo, trunkMat, frondMat, coconutMat } = useMemo(
    () => getSharedPalmAssets(),
    []
  );

  // Batang kelapa melengkung dengan cincin ruas kulit kayu
  const { trunkGeo, crownPos } = useMemo(() => {
    const h = 9.2;
    const dx = Math.cos(leanYaw) * Math.sin(leanAngle) * h;
    const dz = Math.sin(leanYaw) * Math.sin(leanAngle) * h;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(dx * 0.35, h * 0.33, dz * 0.35),
      new THREE.Vector3(dx * 0.75, h * 0.68, dz * 0.75),
      new THREE.Vector3(dx, h, dz),
    ]);
    const geo = new THREE.TubeGeometry(curve, isLowSpec ? 6 : 9, 0.24, isLowSpec ? 5 : 7, false);
    // Buat batang mengecil dari pangkal ke pucuk + guratan cincin kelapa
    const posAttr = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const t = Math.max(0, Math.min(1, v.y / h));
      const center = curve.getPointAt(t);
      const ring = 1 + Math.sin(t * 55) * 0.06;
      const taper = (1 - t * 0.48) * ring;
      v.sub(center).multiplyScalar(taper).add(center);
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return { trunkGeo: geo, crownPos: [dx, h, dz] as [number, number, number] };
  }, [leanAngle, leanYaw, isLowSpec]);

  const frondCount = isLowSpec ? 6 : 9;
  const fronds = useMemo(
    () =>
      Array.from({ length: frondCount }, (_, i) => ({
        yaw: (i / frondCount) * Math.PI * 2 + (i % 2) * 0.14,
        pitch: i % 3 === 0 ? 0.36 : i % 3 === 1 ? 0.08 : -0.14,
        roll: ((i % 3) - 1) * 0.16,
        scale: i % 2 === 0 ? 1.05 : 0.9,
      })),
    [frondCount]
  );

  return (
    <group position={position} scale={scale}>
      <mesh geometry={trunkGeo} material={trunkMat} />
      <group position={crownPos}>
        {/* Buah kelapa hanya pada mode standar */}
        {!isLowSpec &&
          [0, 2.2, 4.4].map((a, idx) => (
            <mesh
              key={idx}
              position={[Math.cos(a) * 0.22, -0.18, Math.sin(a) * 0.22]}
              geometry={coconutGeo}
              material={coconutMat}
            />
          ))}
        {/* Pelepah daun kelapa */}
        {fronds.map((f, idx) => (
          <group key={idx} rotation={[f.roll, f.yaw, f.pitch]} scale={f.scale}>
            <mesh geometry={frondGeo} material={frondMat} />
          </group>
        ))}
      </group>
    </group>
  );
}

// ── Huruf 3D Raksasa "LAST MILE" di Lereng Bukit (Gaya Hollywood Sign) ──

interface LetterShapeDef {
  char: string;
  shapes: THREE.Shape[];
  width: number;
  extraGapBefore?: number;
  strutXs: number[];
}

function makeL(): LetterShapeDef {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(5.4, 0);
  s.lineTo(5.4, 1.95);
  s.lineTo(2.1, 1.95);
  s.lineTo(2.1, 10);
  s.lineTo(0, 10);
  s.closePath();
  return { char: "L", shapes: [s], width: 5.4, strutXs: [1.05, 4.1] };
}

function makeA(): LetterShapeDef {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(2.05, 0);
  s.lineTo(2.55, 2.25);
  s.lineTo(4.25, 2.25);
  s.lineTo(4.75, 0);
  s.lineTo(6.8, 0);
  s.lineTo(4.5, 10);
  s.lineTo(2.3, 10);
  s.closePath();

  const hole = new THREE.Path();
  hole.moveTo(2.88, 3.95);
  hole.lineTo(3.92, 3.95);
  hole.lineTo(3.4, 7.25);
  hole.closePath();
  s.holes.push(hole);

  return { char: "A", shapes: [s], width: 6.8, strutXs: [1.8, 5.0] };
}

function makeS(): LetterShapeDef {
  const s = new THREE.Shape();
  s.moveTo(0.2, 2.2);
  s.lineTo(2.15, 2.2);
  s.quadraticCurveTo(2.2, 1.65, 3.05, 1.65);
  s.quadraticCurveTo(4.05, 1.65, 4.05, 2.65);
  s.quadraticCurveTo(4.05, 3.55, 2.75, 4.05);
  s.quadraticCurveTo(0.25, 4.95, 0.25, 7.25);
  s.quadraticCurveTo(0.25, 10, 3.0, 10);
  s.quadraticCurveTo(5.85, 10, 5.95, 7.55);
  s.lineTo(4.0, 7.55);
  s.quadraticCurveTo(3.95, 8.35, 3.0, 8.35);
  s.quadraticCurveTo(2.15, 8.35, 2.15, 7.4);
  s.quadraticCurveTo(2.15, 6.55, 3.45, 6.05);
  s.quadraticCurveTo(6.0, 5.05, 6.0, 2.75);
  s.quadraticCurveTo(6.0, 0, 3.05, 0);
  s.quadraticCurveTo(0.15, 0, 0.2, 2.2);
  s.closePath();
  return { char: "S", shapes: [s], width: 6.0, strutXs: [1.6, 4.4] };
}

function makeT(): LetterShapeDef {
  const s = new THREE.Shape();
  s.moveTo(0, 10);
  s.lineTo(6.0, 10);
  s.lineTo(6.0, 8.1);
  s.lineTo(4.0, 8.1);
  s.lineTo(4.0, 0);
  s.lineTo(2.0, 0);
  s.lineTo(2.0, 8.1);
  s.lineTo(0, 8.1);
  s.closePath();
  return { char: "T", shapes: [s], width: 6.0, strutXs: [3.0] };
}

function makeM(extraGapBefore = 0): LetterShapeDef {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(1.95, 0);
  s.lineTo(1.95, 5.85);
  s.lineTo(3.3, 2.0);
  s.lineTo(4.5, 2.0);
  s.lineTo(5.85, 5.85);
  s.lineTo(5.85, 0);
  s.lineTo(7.8, 0);
  s.lineTo(7.8, 10);
  s.lineTo(5.65, 10);
  s.lineTo(3.9, 4.8);
  s.lineTo(2.15, 10);
  s.lineTo(0, 10);
  s.closePath();
  return { char: "M", shapes: [s], width: 7.8, extraGapBefore, strutXs: [1.0, 3.9, 6.8] };
}

function makeI(): LetterShapeDef {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(2.2, 0);
  s.lineTo(2.2, 10);
  s.lineTo(0, 10);
  s.closePath();
  return { char: "I", shapes: [s], width: 2.2, strutXs: [1.1] };
}

function makeE(): LetterShapeDef {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(5.8, 0);
  s.lineTo(5.8, 1.9);
  s.lineTo(2.05, 1.9);
  s.lineTo(2.05, 4.15);
  s.lineTo(5.15, 4.15);
  s.lineTo(5.15, 5.95);
  s.lineTo(2.05, 5.95);
  s.lineTo(2.05, 8.1);
  s.lineTo(5.8, 8.1);
  s.lineTo(5.8, 10);
  s.lineTo(0, 10);
  s.closePath();
  return { char: "E", shapes: [s], width: 5.8, strutXs: [1.05, 4.2] };
}

function createLetterShapes(): LetterShapeDef[] {
  return [
    makeL(),
    makeA(),
    makeS(),
    makeT(),
    makeM(3.0),
    makeI(),
    makeL(),
    makeE(),
  ];
}

const SIGN_LOCAL_X = -2.5;
const SIGN_SCALE = 0.66;
const SIGN_GAP = 1.15;

function getUniformSignBaseY() {
  return Math.max(21.2, getIslandHeight(SIGN_LOCAL_X, 0) - 1.2);
}

/**
 * Titik tengah (koordinat lokal pulau) papan 3D "LAST MILE" agar animasi zoom kamera
 * tepat mengarah ke tulisan di lereng bukit pada berbagai rasio layar.
 */
export function getIslandSignMetrics() {
  const defs = createLetterShapes();
  const totalUnscaledW =
    defs.reduce((s, d) => s + d.width + (d.extraGapBefore || 0), 0) +
    SIGN_GAP * (defs.length - 1);
  const baseY = getUniformSignBaseY();

  return {
    centerX: SIGN_LOCAL_X,
    centerY: baseY + 5 * SIGN_SCALE,
    centerZ: 0,
    totalWidth: totalUnscaledW * SIGN_SCALE,
  };
}

function HillsideLastMileSign({ isLowSpec = false }: { isLowSpec?: boolean }) {
  const letters = useMemo(() => {
    const defs = createLetterShapes();
    const totalW =
      defs.reduce((s, d) => s + d.width + (d.extraGapBefore || 0), 0) +
      SIGN_GAP * (defs.length - 1);
    let cursor = -totalW / 2;
    const baseY = getUniformSignBaseY();

    return defs.map((d) => {
      cursor += d.extraGapBefore || 0;
      const geo = new THREE.ExtrudeGeometry(d.shapes, {
        depth: 1.85,
        bevelEnabled: true,
        bevelThickness: 0.24,
        bevelSize: 0.18,
        bevelSegments: 2,
      });
      const zStart = cursor * SIGN_SCALE;
      cursor += d.width + SIGN_GAP;
      return { geo, char: d.char, zStart, width: d.width, baseY, strutXs: d.strutXs };
    });
  }, []);

  const frontMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#fffdf7",
        emissive: "#ffd59c",
        emissiveIntensity: 0.42,
        roughness: 0.28,
        metalness: 0.08,
      }),
    []
  );

  const sideMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c48c58",
        emissive: "#5a3818",
        emissiveIntensity: 0.18,
        roughness: 0.48,
        metalness: 0.22,
      }),
    []
  );

  const strutMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#3d352e",
        roughness: 0.7,
        metalness: 0.4,
      }),
    []
  );

  const terraceMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#574c42",
        roughness: 0.85,
        metalness: 0.08,
      }),
    []
  );

  const letterMats = useMemo(() => [frontMat, sideMat], [frontMat, sideMat]);
  const baseY = getUniformSignBaseY();

  return (
    /* Diputar menghadap -X (ke arah kapal yang mendekat):
       sumbu X lokal ExtrudeGeometry mengarah ke +Z dunia */
    <group position={[SIGN_LOCAL_X, 0, 6.5]}>
      {/* Lampu sorot senja menerangi permukaan huruf LAST MILE */}
      {!isLowSpec && (
        <pointLight position={[-18, 32, 0]} color="#ffd9a0" intensity={52} distance={110} decay={1} />
      )}

      {/* Fondasi teras batu penopang di bawah barisan huruf LAST MILE */}
      <mesh position={[0.4, baseY - 0.55, 0]} material={terraceMat}>
        <boxGeometry args={[2.8, 1.1, 39.5]} />
      </mesh>

      {letters.map((l, idx) => (
        <group key={idx} position={[0, l.baseY, l.zStart]} rotation={[0, -Math.PI / 2, 0]} scale={SIGN_SCALE}>
          <mesh geometry={l.geo} material={letterMats} />
          {/* Tiang penyangga baja di belakang masing-masing batang huruf */}
          {l.strutXs.map((sx, sIdx) => (
            <mesh key={sIdx} position={[sx, 4.2, -1.3]} rotation={[0.28, 0, 0]} material={strutMat}>
              <cylinderGeometry args={[0.14, 0.18, 12.5, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ── Mercusuar Tanjung Pantai (IslandLighthouse) ───────────────

function IslandLighthouse() {
  const beamRef = useRef<THREE.Group>(null);
  const lx = -26;
  const lz = -62;
  const baseH = useMemo(() => Math.max(2.6, getIslandHeight(lx, lz)), [lx, lz]);

  const mats = useMemo(() => {
    const stone = new THREE.MeshStandardMaterial({ color: "#685e54", roughness: 0.88 });
    const white = new THREE.MeshStandardMaterial({
      color: "#faf5ec",
      emissive: "#ffe4b8",
      emissiveIntensity: 0.08,
      roughness: 0.45,
    });
    const red = new THREE.MeshStandardMaterial({
      color: "#b8332a",
      emissive: "#5a1410",
      emissiveIntensity: 0.08,
      roughness: 0.48,
    });
    const darkIron = new THREE.MeshStandardMaterial({
      color: "#22262c",
      roughness: 0.42,
      metalness: 0.72,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: "#fff5d6",
      emissive: "#ffcf70",
      emissiveIntensity: 1.4,
      roughness: 0.15,
    });
    const beam = new THREE.MeshBasicMaterial({
      color: "#ffe4a8",
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { stone, white, red, darkIron, glass, beam };
  }, []);

  useFrame(({ clock }) => {
    if (beamRef.current) {
      beamRef.current.rotation.y = clock.elapsedTime * 0.75;
    }
  });

  return (
    <group position={[lx, baseH - 0.3, lz]}>
      {/* Fondasi batu karang & podium oktagonal mercusuar */}
      <mesh position={[0, 0.9, 0]} material={mats.stone}>
        <cylinderGeometry args={[3.9, 4.8, 2.2, 10]} />
      </mesh>
      <mesh position={[0, 2.4, 0]} material={mats.white}>
        <cylinderGeometry args={[2.7, 3.1, 1.2, 16]} />
      </mesh>

      {/* Menara belang merah-putih klasik (5 segmen bertingkat) */}
      <mesh position={[0, 4.5, 0]} material={mats.red}>
        <cylinderGeometry args={[2.38, 2.65, 3.2, 18]} />
      </mesh>
      <mesh position={[0, 7.6, 0]} material={mats.white}>
        <cylinderGeometry args={[2.1, 2.38, 3.1, 18]} />
      </mesh>
      <mesh position={[0, 10.6, 0]} material={mats.red}>
        <cylinderGeometry args={[1.84, 2.1, 3.0, 18]} />
      </mesh>
      <mesh position={[0, 13.5, 0]} material={mats.white}>
        <cylinderGeometry args={[1.62, 1.84, 2.9, 18]} />
      </mesh>
      <mesh position={[0, 16.1, 0]} material={mats.red}>
        <cylinderGeometry args={[1.48, 1.62, 2.4, 18]} />
      </mesh>

      {/* Balkon galeri besi & pagar */}
      <mesh position={[0, 17.45, 0]} material={mats.darkIron}>
        <cylinderGeometry args={[2.05, 1.72, 0.42, 18]} />
      </mesh>
      <mesh position={[0, 17.85, 0]} material={mats.darkIron}>
        <torusGeometry args={[1.98, 0.07, 8, 24]} />
      </mesh>

      {/* Ruang lentera kaca bercahaya */}
      <mesh position={[0, 18.75, 0]} material={mats.glass}>
        <cylinderGeometry args={[1.32, 1.32, 2.2, 14]} />
      </mesh>

      {/* Kubah atap mercusuar & penangkal petir */}
      <mesh position={[0, 20.1, 0]} material={mats.red}>
        <coneGeometry args={[1.65, 1.6, 16]} />
      </mesh>
      <mesh position={[0, 21.3, 0]} material={mats.darkIron}>
        <cylinderGeometry args={[0.04, 0.06, 1.2, 8]} />
      </mesh>

      {/* Sorot cahaya suar berputar ganda */}
      <group ref={beamRef} position={[0, 18.8, 0]}>
        <mesh position={[18, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.beam}>
          <coneGeometry args={[4.6, 36, 16, 1, true]} />
        </mesh>
        <mesh position={[-18, 0, 0]} rotation={[0, 0, -Math.PI / 2]} material={mats.beam}>
          <coneGeometry args={[4.6, 36, 16, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

// ── Dermaga Kayu Pelabuhan, Gudang Pantai & Perahu Berlabuh ───

function IslandHarborDock() {
  const boatRef = useRef<THREE.Group>(null);
  const mats = useMemo(() => {
    const woodDeck = new THREE.MeshStandardMaterial({ color: "#6e4b2e", roughness: 0.82 });
    const darkPiling = new THREE.MeshStandardMaterial({ color: "#3d2716", roughness: 0.9 });
    const cabinWall = new THREE.MeshStandardMaterial({ color: "#8c623d", roughness: 0.78 });
    const cabinRoof = new THREE.MeshStandardMaterial({ color: "#7c2d1e", roughness: 0.72 });
    const crateMat = new THREE.MeshStandardMaterial({ color: "#a67946", roughness: 0.8 });
    const lanternGlow = new THREE.MeshStandardMaterial({
      color: "#fff3c4",
      emissive: "#ffba42",
      emissiveIntensity: 1.75,
      roughness: 0.2,
    });
    const hullMat = new THREE.MeshStandardMaterial({ color: "#4e2e18", roughness: 0.68 });
    const sailTrim = new THREE.MeshStandardMaterial({ color: "#efe4cf", roughness: 0.75 });
    return { woodDeck, darkPiling, cabinWall, cabinRoof, crateMat, lanternGlow, hullMat, sailTrim };
  }, []);

  useFrame(({ clock }) => {
    if (boatRef.current) {
      const t = clock.elapsedTime;
      boatRef.current.position.y = 0.42 + Math.sin(t * 1.9) * 0.08;
      boatRef.current.rotation.z = Math.sin(t * 1.5) * 0.04;
      boatRef.current.rotation.x = Math.cos(t * 1.3) * 0.03;
    }
  });

  const pilings = useMemo(() => [-38, -45, -52, -59, -66, -73], []);

  return (
    <group position={[0, 0, 7]}>
      {/* Lantai utama dermaga kayu menjorok dari pantai pasir (-34) ke laut (-75) */}
      <mesh position={[-54.5, 1.55, 0]} material={mats.woodDeck}>
        <boxGeometry args={[41, 0.38, 4.6]} />
      </mesh>
      {/* Balok pembatas tepi kiri & kanan dermaga */}
      <mesh position={[-54.5, 1.82, 2.15]} material={mats.darkPiling}>
        <boxGeometry args={[41, 0.22, 0.26]} />
      </mesh>
      <mesh position={[-54.5, 1.82, -2.15]} material={mats.darkPiling}>
        <boxGeometry args={[41, 0.22, 0.26]} />
      </mesh>

      {/* Tiang pancang kayu penyangga dermaga & lentera pelabuhan */}
      {pilings.map((px, idx) => (
        <group key={idx} position={[px, 0, 0]}>
          <mesh position={[0, 0.85, 2.1]} material={mats.darkPiling}>
            <cylinderGeometry args={[0.24, 0.28, 3.8, 8]} />
          </mesh>
          <mesh position={[0, 0.85, -2.1]} material={mats.darkPiling}>
            <cylinderGeometry args={[0.24, 0.28, 3.8, 8]} />
          </mesh>
          {idx % 2 === 1 && (
            <>
              <mesh position={[0, 2.85, -2.1]} material={mats.darkPiling}>
                <cylinderGeometry args={[0.1, 0.12, 2.3, 8]} />
              </mesh>
              <mesh position={[0, 4.02, -2.1]} material={mats.lanternGlow}>
                <sphereGeometry args={[0.26, 10, 10]} />
              </mesh>
            </>
          )}
        </group>
      ))}

      {/* Bangunan Gudang Kayu / Pos Pelabuhan di Pangkal Dermaga */}
      <group position={[-31.5, 2.2, 5.2]}>
        <mesh position={[0, 1.6, 0]} material={mats.cabinWall}>
          <boxGeometry args={[6.4, 3.2, 5.2]} />
        </mesh>
        <mesh position={[0, 3.95, 0]} rotation={[0, Math.PI / 4, 0]} material={mats.cabinRoof}>
          <coneGeometry args={[5.2, 2.2, 4]} />
        </mesh>
        {/* Jendela gudang menyala hangat */}
        <mesh position={[-3.22, 1.75, 0]} material={mats.lanternGlow}>
          <boxGeometry args={[0.1, 0.95, 1.8]} />
        </mesh>
      </group>

      {/* Tumpukan Peti Kargo di Dermaga */}
      <mesh position={[-42, 2.15, 1.1]} material={mats.crateMat}>
        <boxGeometry args={[1.1, 0.9, 1.1]} />
      </mesh>
      <mesh position={[-43.3, 2.05, 1.2]} material={mats.crateMat}>
        <boxGeometry args={[0.9, 0.7, 0.9]} />
      </mesh>

      {/* Perahu Kayu Berlabuh di Samping Dermaga */}
      <group ref={boatRef} position={[-63, 0.42, -4.4]}>
        <mesh scale={[2.4, 0.55, 0.95]} material={mats.hullMat}>
          <sphereGeometry args={[1.35, 14, 10]} />
        </mesh>
        <mesh position={[0, 0.48, 0]} scale={[2.1, 0.18, 0.78]} material={mats.sailTrim}>
          <boxGeometry args={[1.2, 1, 1.2]} />
        </mesh>
        {/* Tiang perahu kecil & lentera haluan */}
        <mesh position={[0.4, 2.1, 0]} material={mats.darkPiling}>
          <cylinderGeometry args={[0.07, 0.1, 3.4, 8]} />
        </mesh>
        <mesh position={[-2.6, 0.75, 0]} material={mats.lanternGlow}>
          <sphereGeometry args={[0.16, 8, 8]} />
        </mesh>
      </group>
    </group>
  );
}

// ── Air Terjun Tebing Tropis & Kolam Kabut (IslandCliffWaterfall) ──

function IslandCliffWaterfall() {
  const matWater = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d9f7ff",
        emissive: "#7fd8f0",
        emissiveIntensity: 0.32,
        roughness: 0.22,
        metalness: 0.1,
        transparent: true,
        opacity: 0.86,
      }),
    []
  );
  const matCliff = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#4a433c",
        roughness: 0.92,
      }),
    []
  );

  return (
    <group position={[6, 3.2, -31]} rotation={[0, -0.25, 0]}>
      {/* Tebing batu pengapit aliran air terjun */}
      <mesh position={[1.5, 8.5, -3.2]} scale={[3.4, 9.5, 2.8]} material={matCliff}>
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh position={[1.5, 8.2, 3.2]} scale={[3.2, 9.0, 2.6]} material={matCliff}>
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      {/* Aliran air terjun bertingkat */}
      <mesh position={[-0.6, 8.8, 0]} rotation={[0, 0, 0.24]} material={matWater}>
        <boxGeometry args={[0.45, 16.5, 3.1]} />
      </mesh>
      {/* Kolam pirus & buih dasar air terjun */}
      <mesh position={[-4.5, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]} material={matWater}>
        <circleGeometry args={[5.4, 18]} />
      </mesh>
    </group>
  );
}

// ── Semak Tropis Rendah di Lereng Bukit ──

function JungleCanopyInstanced({ isLowSpec = false }: { isLowSpec?: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const detailTex = useMemo(() => getTerrainDetailTexture(), []);

  const bushes = useMemo(() => {
    const list: { pos: [number, number, number]; scale: [number, number, number]; color: THREE.Color }[] = [];
    const palette = ["#396428", "#447030", "#4e7c37", "#325923", "#56853d"];
    const maxBushes = isLowSpec ? 28 : 42;
    for (let i = 0; i < maxBushes * 3.5; i++) {
      if (list.length >= maxBushes) break;
      const a = hash2(i * 1.7, 9.1) * Math.PI * 2;
      const rad = 10 + hash2(i * 3.3, 2.7) * 44;
      const lx = Math.cos(a) * rad + 8;
      const lz = Math.sin(a) * rad * 1.05;
      // Jangan tutupi area di sekitar tulisan LAST MILE (lx in -16..8, |lz| < 26)
      if (lx > -16 && lx < 8 && Math.abs(lz) < 26) continue;
      const h = getIslandHeight(lx, lz);
      if (h < 6.5 || h > 23) continue;
      const dhX = Math.abs(getIslandHeight(lx + 2, lz) - getIslandHeight(lx - 2, lz));
      const dhZ = Math.abs(getIslandHeight(lx, lz + 2) - getIslandHeight(lx, lz - 2));
      if (dhX > 1.8 || dhZ > 1.8) continue;
      const sx = 1.6 + hash2(i, 19.3) * 1.8;
      const col = new THREE.Color(palette[i % palette.length]);
      list.push({
        pos: [lx, h - sx * 0.45, lz],
        scale: [sx * 1.05, sx * 0.72, sx * 1.0],
        color: col,
      });
    }
    return list;
  }, [isLowSpec]);

  useEffect(() => {
    const inst = meshRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    bushes.forEach((b, idx) => {
      dummy.position.set(...b.pos);
      dummy.scale.set(...b.scale);
      dummy.rotation.set(hash2(idx, 1.1) * 0.25, idx * 1.1, hash2(idx, 2.3) * 0.25);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(idx, b.color);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [bushes]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, bushes.length]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        map={detailTex}
        roughness={0.88}
        metalness={0.02}
      />
    </instancedMesh>
  );
}

// ── Komponen Utama Pulau Tropis ───────────────────────────────

export function TropicalIsland({
  position = [340, 0, 0],
  rotation = [0, 0, 0],
  isLowSpec = false,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  isLowSpec?: boolean;
}) {
  const surfRingRef = useRef<THREE.Mesh>(null);
  const detailTex = useMemo(() => getTerrainDetailTexture(), []);

  // 1. Geometri kontur pulau (pasir putih -> tebing batu -> bukit hijau tropis)
  const terrainGeo = useMemo(() => {
    const segs = isLowSpec ? 36 : 48;
    const geo = new THREE.PlaneGeometry(190, 230, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      pos.setY(i, getIslandHeight(lx, lz));
    }
    geo.computeVertexNormals();

    // Vertex color realistis berdasarkan elevasi & kemiringan lereng
    const norm = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const cWetSand = new THREE.Color("#c9af8c");
    const cWhiteSand = new THREE.Color("#f5e9d4");
    const cGrass = new THREE.Color("#637c3a");
    const cJungle = new THREE.Color("#2b5625");
    const cHighJungle = new THREE.Color("#3b6b30");
    const cRock = new THREE.Color("#63584d");
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const ny = norm.getY(i);
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const nVar = valueNoise(lx * 0.12, lz * 0.12);

      if (y < 1.1) {
        tmp.copy(cWetSand).lerp(cWhiteSand, THREE.MathUtils.clamp((y + 0.3) / 1.4, 0, 1));
      } else if (y < 5.0) {
        tmp.copy(cWhiteSand);
        if (y > 3.6) {
          tmp.lerp(cGrass, (y - 3.6) / 1.4);
        }
      } else if (y < 9.5) {
        tmp.copy(cGrass).lerp(cJungle, (y - 5.0) / 4.5);
      } else {
        tmp.copy(cJungle).lerp(cHighJungle, nVar * 0.75);
      }

      // Lereng curam berubah menjadi batuan tebing
      if (y > 3.0 && ny < 0.74) {
        const rockFactor = THREE.MathUtils.clamp((0.74 - ny) / 0.22, 0, 1);
        tmp.lerp(cRock, rockFactor);
      }

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [isLowSpec]);

  // 2. Tekstur laguna pirus & buih ombak pantai
  const lagoonTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 42, 128, 128, 126);
    g.addColorStop(0, "rgba(255, 250, 240, 0.88)");
    g.addColorStop(0.5, "rgba(64, 214, 198, 0.56)");
    g.addColorStop(0.76, "rgba(28, 148, 158, 0.28)");
    g.addColorStop(1, "rgba(12, 60, 80, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // 3. Posisi pohon kelapa di sepanjang pantai pasir putih & punggung bukit
  const palms = useMemo(() => {
    const items: {
      pos: [number, number, number];
      scale: number;
      leanAngle: number;
      leanYaw: number;
      phase: number;
    }[] = [];

    const zCoords = [-62, -48, -36, -24, -14, -4, 8, 16, 30, 42, 54, 64];

    zCoords.forEach((lz, i) => {
      for (let lx = -60; lx <= -10; lx += 3.5) {
        const h = getIslandHeight(lx, lz);
        if (h >= 1.6 && h <= 3.8) {
          items.push({
            pos: [lx, h - 0.15, lz],
            scale: 0.95 + hash2(i, 8.2) * 0.35,
            leanAngle: 0.16 + hash2(i, 5.5) * 0.18,
            leanYaw: Math.PI + (hash2(i, 2.9) - 0.5) * 0.85,
            phase: i * 0.7,
          });
          break;
        }
      }
    });

    // Pohon kelapa di punggung bukit & sekitar teluk
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lz = side * (28 + hash2(i, 12.7) * 34);
      const lx = -6 + hash2(i, 15.1) * 34;
      const h = getIslandHeight(lx, lz);
      if (h >= 6.5 && h <= 28.0) {
        items.push({
          pos: [lx, h - 0.25, lz],
          scale: 0.9 + hash2(i, 17.9) * 0.35,
          leanAngle: 0.1 + hash2(i, 13.4) * 0.15,
          leanYaw: Math.PI + (hash2(i, 8.8) - 0.5) * 1.8,
          phase: i * 0.9,
        });
      }
    }

    return items;
  }, []);

  // 4. Batu karang pantai & gugusan tebing laut
  const rocks = useMemo(() => {
    const spots: { pos: [number, number, number]; scale: [number, number, number]; rot: number }[] = [
      { pos: [-44, 0.8, -52], scale: [5.0, 2.8, 4.2], rot: 0.4 },
      { pos: [-42, 0.9, 50], scale: [5.2, 3.0, 4.5], rot: 2.1 },
      { pos: [-38, 1.0, 28], scale: [2.8, 1.5, 2.4], rot: 1.7 },
      { pos: [-52, 0.6, -34], scale: [3.6, 2.1, 3.1], rot: 0.9 },
      { pos: [-48, 0.7, 38], scale: [3.8, 2.2, 3.2], rot: 2.6 },
      { pos: [-33, 2.2, -62], scale: [6.2, 4.0, 5.4], rot: 1.2 },
    ];
    return spots;
  }, []);

  useFrame(({ clock }) => {
    if (surfRingRef.current) {
      const t = clock.elapsedTime;
      const pulse = 1 + Math.sin(t * 1.6) * 0.014;
      surfRingRef.current.scale.set(pulse, 1, pulse * 1.18);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Pantulan hangat cahaya senja di pantai pulau */}
      {!isLowSpec && (
        <pointLight position={[-65, 26, 0]} color="#ffd5a3" intensity={65} distance={160} decay={1} />
      )}

      {/* Laguna dangkal pirus & buih pantai */}
      <mesh
        ref={surfRingRef}
        position={[-6, 0.22, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[225, 255]} />
        <meshBasicMaterial
          map={lagoonTex}
          transparent
          opacity={0.82}
          depthWrite={false}
        />
      </mesh>

      {/* Daratan Pulau (Pasir Putih -> Bukit Tropis) */}
      <mesh geometry={terrainGeo}>
        <meshStandardMaterial
          vertexColors
          map={detailTex}
          roughness={0.84}
          metalness={0.02}
        />
      </mesh>

      {/* Mercusuar Pantai dengan Sorot Cahaya Berputar */}
      <IslandLighthouse />

      {/* Dermaga Kayu Pelabuhan, Gudang Pantai & Perahu Berlabuh */}
      <IslandHarborDock />

      {/* Air Terjun Tebing Tropis */}
      <IslandCliffWaterfall />

      {/* Batu Karang Pantai */}
      {rocks.map((r, idx) => (
        <mesh
          key={idx}
          position={r.pos}
          scale={r.scale}
          rotation={[0.15, r.rot, 0.1]}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#584e45"
            map={detailTex}
            roughness={0.9}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* Rumpun Hutan di Lereng Bukit */}
      <JungleCanopyInstanced isLowSpec={isLowSpec} />

      {/* Pohon Kelapa Melambai di Sepanjang Pantai Pasir Putih */}
      {palms.map((p, idx) => (
        <CoconutPalmTree
          key={idx}
          position={p.pos}
          scale={p.scale}
          leanAngle={p.leanAngle}
          leanYaw={p.leanYaw}
          phase={p.phase}
          isLowSpec={false}
        />
      ))}

      {/* Huruf 3D Raksasa "LAST MILE" di Lereng Bukit */}
      <HillsideLastMileSign isLowSpec={isLowSpec} />
    </group>
  );
}
