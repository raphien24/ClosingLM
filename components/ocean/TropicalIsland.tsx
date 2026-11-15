"use client";

/**
 * Pulau Tropis Realistis dengan Pantai Pasir Putih, Laguna Pirus,
 * Pohon Kelapa Melambai, Hutan Tropis, dan Huruf Besar 3D "JTT08" di Lereng Bukit.
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
  phase = 0,
}: {
  position: [number, number, number];
  scale?: number;
  leanAngle?: number;
  leanYaw?: number;
  phase?: number;
}) {
  const crownRef = useRef<THREE.Group>(null);
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
    const geo = new THREE.TubeGeometry(curve, 12, 0.24, 8, false);
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
  }, [leanAngle, leanYaw]);

  useFrame(({ clock }) => {
    if (crownRef.current) {
      const t = clock.elapsedTime + phase;
      crownRef.current.rotation.z = Math.sin(t * 1.35) * 0.045;
      crownRef.current.rotation.x = Math.cos(t * 1.05) * 0.035;
    }
  });

  const fronds = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        yaw: (i / 12) * Math.PI * 2 + (i % 2) * 0.14,
        pitch: i % 3 === 0 ? 0.36 : i % 3 === 1 ? 0.08 : -0.14,
        roll: ((i % 3) - 1) * 0.16,
        scale: i % 2 === 0 ? 1.05 : 0.9,
      })),
    []
  );

  return (
    <group position={position} scale={scale}>
      <mesh geometry={trunkGeo} material={trunkMat} />
      <group ref={crownRef} position={crownPos}>
        {/* Buah kelapa bergerombol di pangkal pelepah */}
        {[0, 1.3, 2.6, 3.9, 5.1].map((a, idx) => (
          <mesh
            key={idx}
            position={[Math.cos(a) * 0.22, -0.18, Math.sin(a) * 0.22]}
            geometry={coconutGeo}
            material={coconutMat}
          />
        ))}
        {/* Pelepah daun kelapa penuh & berlapis */}
        {fronds.map((f, idx) => (
          <group key={idx} rotation={[f.roll, f.yaw, f.pitch]} scale={f.scale}>
            <mesh geometry={frondGeo} material={frondMat} />
          </group>
        ))}
      </group>
    </group>
  );
}

// ── Huruf 3D Raksasa "JTT08" di Lereng Bukit (Gaya Hollywood Sign) ──

function createLetterShapes(): { char: string; shapes: THREE.Shape[]; width: number }[] {
  const result: { char: string; shapes: THREE.Shape[]; width: number }[] = [];

  // 1. Huruf "J"
  {
    const s = new THREE.Shape();
    s.moveTo(1.2, 10);
    s.lineTo(5.8, 10);
    s.lineTo(5.8, 8.2);
    s.lineTo(4.6, 8.2);
    s.lineTo(4.6, 3.0);
    s.quadraticCurveTo(4.6, 0, 2.2, 0);
    s.quadraticCurveTo(0, 0, 0, 2.6);
    s.lineTo(0, 3.8);
    s.lineTo(1.8, 3.8);
    s.lineTo(1.8, 2.7);
    s.quadraticCurveTo(1.8, 1.8, 2.3, 1.8);
    s.quadraticCurveTo(2.8, 1.8, 2.8, 2.8);
    s.lineTo(2.8, 8.2);
    s.lineTo(1.2, 8.2);
    s.closePath();
    result.push({ char: "J", shapes: [s], width: 5.8 });
  }

  // 2 & 3. Huruf "T"
  const makeT = () => {
    const s = new THREE.Shape();
    s.moveTo(0, 10);
    s.lineTo(6.2, 10);
    s.lineTo(6.2, 8.1);
    s.lineTo(4.05, 8.1);
    s.lineTo(4.05, 0);
    s.lineTo(2.15, 0);
    s.lineTo(2.15, 8.1);
    s.lineTo(0, 8.1);
    s.closePath();
    return s;
  };
  result.push({ char: "T", shapes: [makeT()], width: 6.2 });
  result.push({ char: "T", shapes: [makeT()], width: 6.2 });

  // 4. Angka "0"
  {
    const outer = new THREE.Shape();
    outer.moveTo(1.4, 0);
    outer.lineTo(4.8, 0);
    outer.quadraticCurveTo(6.2, 0, 6.2, 1.5);
    outer.lineTo(6.2, 8.5);
    outer.quadraticCurveTo(6.2, 10, 4.8, 10);
    outer.lineTo(1.4, 10);
    outer.quadraticCurveTo(0, 10, 0, 8.5);
    outer.lineTo(0, 1.5);
    outer.quadraticCurveTo(0, 0, 1.4, 0);
    outer.closePath();

    const hole = new THREE.Path();
    hole.moveTo(2.2, 1.8);
    hole.lineTo(4.0, 1.8);
    hole.quadraticCurveTo(4.4, 1.8, 4.4, 2.3);
    hole.lineTo(4.4, 7.7);
    hole.quadraticCurveTo(4.4, 8.2, 4.0, 8.2);
    hole.lineTo(2.2, 8.2);
    hole.quadraticCurveTo(1.8, 8.2, 1.8, 7.7);
    hole.lineTo(1.8, 2.3);
    hole.quadraticCurveTo(1.8, 1.8, 2.2, 1.8);
    hole.closePath();
    outer.holes.push(hole);

    result.push({ char: "0", shapes: [outer], width: 6.2 });
  }

  // 5. Angka "8"
  {
    const outer = new THREE.Shape();
    outer.moveTo(1.3, 0);
    outer.lineTo(4.9, 0);
    outer.quadraticCurveTo(6.2, 0, 6.2, 1.4);
    outer.lineTo(6.2, 4.1);
    outer.quadraticCurveTo(6.2, 5.0, 5.2, 5.1);
    outer.quadraticCurveTo(6.0, 5.3, 6.0, 6.1);
    outer.lineTo(6.0, 8.6);
    outer.quadraticCurveTo(6.0, 10, 4.7, 10);
    outer.lineTo(1.5, 10);
    outer.quadraticCurveTo(0.2, 10, 0.2, 8.6);
    outer.lineTo(0.2, 6.1);
    outer.quadraticCurveTo(0.2, 5.3, 1.0, 5.1);
    outer.quadraticCurveTo(0, 5.0, 0, 4.1);
    outer.lineTo(0, 1.4);
    outer.quadraticCurveTo(0, 0, 1.3, 0);
    outer.closePath();

    const botHole = new THREE.Path();
    botHole.moveTo(2.1, 1.7);
    botHole.lineTo(4.1, 1.7);
    botHole.quadraticCurveTo(4.4, 1.7, 4.4, 2.1);
    botHole.lineTo(4.4, 3.8);
    botHole.quadraticCurveTo(4.4, 4.2, 4.1, 4.2);
    botHole.lineTo(2.1, 4.2);
    botHole.quadraticCurveTo(1.8, 4.2, 1.8, 3.8);
    botHole.lineTo(1.8, 2.1);
    botHole.quadraticCurveTo(1.8, 1.7, 2.1, 1.7);
    botHole.closePath();

    const topHole = new THREE.Path();
    topHole.moveTo(2.2, 5.9);
    topHole.lineTo(4.0, 5.9);
    topHole.quadraticCurveTo(4.3, 5.9, 4.3, 6.3);
    topHole.lineTo(4.3, 7.9);
    topHole.quadraticCurveTo(4.3, 8.3, 4.0, 8.3);
    topHole.lineTo(2.2, 8.3);
    topHole.quadraticCurveTo(1.9, 8.3, 1.9, 7.9);
    topHole.lineTo(1.9, 6.3);
    topHole.quadraticCurveTo(1.9, 5.9, 2.2, 5.9);
    topHole.closePath();

    outer.holes.push(botHole, topHole);
    result.push({ char: "8", shapes: [outer], width: 6.2 });
  }

  return result;
}

const SIGN_LOCAL_X = -5.5;
const SIGN_SCALE = 0.96;
const SIGN_GAP = 1.75;

function getUniformSignBaseY() {
  return Math.max(18.0, getIslandHeight(SIGN_LOCAL_X, 0) - 2.4);
}

/**
 * Titik tengah (koordinat lokal pulau) papan 3D "JTT08" agar animasi zoom kamera
 * tepat mengarah ke tulisan di lereng bukit pada berbagai rasio layar.
 */
export function getIslandSignMetrics() {
  const defs = createLetterShapes();
  const totalUnscaledW = defs.reduce((s, d) => s + d.width, 0) + SIGN_GAP * (defs.length - 1);
  const baseY = getUniformSignBaseY();

  return {
    centerX: SIGN_LOCAL_X,
    centerY: baseY + 5 * SIGN_SCALE,
    centerZ: 0,
    totalWidth: totalUnscaledW * SIGN_SCALE,
  };
}

function HillsideJtt08Sign() {
  const letters = useMemo(() => {
    const defs = createLetterShapes();
    const totalW = defs.reduce((s, d) => s + d.width, 0) + SIGN_GAP * (defs.length - 1);
    let cursor = -totalW / 2;
    const baseY = getUniformSignBaseY();

    return defs.map((d) => {
      const geo = new THREE.ExtrudeGeometry(d.shapes, {
        depth: 1.8,
        bevelEnabled: true,
        bevelThickness: 0.28,
        bevelSize: 0.22,
        bevelSegments: 3,
      });
      const zStart = cursor * SIGN_SCALE;
      cursor += d.width + SIGN_GAP;
      // Posisi horizontal penopang baja mengikuti batang solid masing-masing huruf
      const strutXs =
        d.char === "J"
          ? [3.7]
          : d.char === "T"
          ? [3.1]
          : [1.4, d.width - 1.4];
      return { geo, char: d.char, zStart, width: d.width, baseY, strutXs };
    });
  }, []);

  const frontMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#fffcf5",
        emissive: "#ffd59c",
        emissiveIntensity: 0.34,
        roughness: 0.32,
        metalness: 0.08,
      }),
    []
  );

  const sideMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#b88456",
        roughness: 0.55,
        metalness: 0.18,
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

  const letterMats = useMemo(() => [frontMat, sideMat], [frontMat, sideMat]);

  return (
    /* Diputar menghadap -X (ke arah kapal yang mendekat):
       sumbu X lokal ExtrudeGeometry mengarah ke +Z dunia */
    <group position={[SIGN_LOCAL_X, 0, 0]}>
      {/* Lampu sorot senja tunggal menerangi permukaan huruf JTT08 & lereng bukit */}
      <pointLight position={[-18, 32, 0]} color="#ffd9a0" intensity={38} distance={95} decay={1} />

      {letters.map((l, idx) => (
        <group key={idx} position={[0, l.baseY, l.zStart]} rotation={[0, -Math.PI / 2, 0]} scale={SIGN_SCALE}>
          <mesh geometry={l.geo} material={letterMats} />
          {/* Tiang penyangga baja tersembunyi tepat di belakang batang huruf (seperti papan Hollywood) */}
          {l.strutXs.map((sx, sIdx) => (
            <mesh key={sIdx} position={[sx, 4.2, -1.3]} rotation={[0.28, 0, 0]} material={strutMat}>
              <cylinderGeometry args={[0.14, 0.18, 12.5, 8]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ── Semak Tropis Rendah di Lereng Bukit (menggantikan bulatan pohon kartun) ──

function JungleCanopyInstanced() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const detailTex = useMemo(() => getTerrainDetailTexture(), []);

  const bushes = useMemo(() => {
    const list: { pos: [number, number, number]; scale: [number, number, number]; color: THREE.Color }[] = [];
    const palette = ["#244820", "#2f5726", "#39642c", "#1d3b1a", "#446e30"];
    for (let i = 0; i < 160; i++) {
      const a = hash2(i * 1.7, 9.1) * Math.PI * 2;
      const rad = 14 + hash2(i * 3.3, 2.7) * 56;
      const lx = Math.cos(a) * rad + 6;
      const lz = Math.sin(a) * rad * 1.15;
      // Jangan tutupi area di sekitar tulisan JTT08 (lx in -16..4, |lz| < 26)
      if (lx > -16 && lx < 4 && Math.abs(lz) < 26) continue;
      const h = getIslandHeight(lx, lz);
      if (h < 4.5 || h > 29) continue;
      const sx = 2.0 + hash2(i, 19.3) * 2.6;
      const col = new THREE.Color(palette[i % palette.length]);
      list.push({
        pos: [lx, h + sx * 0.08, lz],
        scale: [sx * 1.3, sx * 0.36, sx * 1.1],
        color: col,
      });
    }
    return list;
  }, []);

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
}: {
  position?: [number, number, number];
}) {
  const surfRingRef = useRef<THREE.Mesh>(null);
  const detailTex = useMemo(() => getTerrainDetailTexture(), []);

  // 1. Geometri kontur pulau (pasir putih -> tebing batu -> bukit hijau tropis)
  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(190, 230, 128, 128);
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
  }, []);

  // 2. Tekstur laguna pirus & buih ombak pantai
  const lagoonTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 42, 128, 128, 126);
    g.addColorStop(0, "rgba(255, 250, 240, 0.85)");
    g.addColorStop(0.52, "rgba(64, 210, 195, 0.52)");
    g.addColorStop(0.78, "rgba(28, 145, 155, 0.25)");
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

    // Barisan pohon kelapa di sepanjang pantai pasir putih (menghadap laut -X)
    const zCoords = [
      -68, -60, -52, -45, -38, -32, -26, -21, -15, -9, -3,
      4, 10, 16, 22, 28, 35, 42, 49, 57, 65,
    ];
    zCoords.forEach((lz, i) => {
      // Cari lx di mana tinggi pantai berada di sekitar 1.8m .. 4.2m
      for (let lx = -65; lx <= -5; lx += 2.5) {
        const h = getIslandHeight(lx, lz);
        if (h >= 1.6 && h <= 3.8) {
          const jitterZ = lz + (hash2(i, 1.3) - 0.5) * 3.5;
          const jitterX = lx + (hash2(i, 4.7) - 0.5) * 3.0;
          const hj = getIslandHeight(jitterX, jitterZ);
          if (hj > 1.1) {
            items.push({
              pos: [jitterX, hj - 0.15, jitterZ],
              scale: 0.92 + hash2(i, 8.2) * 0.42,
              leanAngle: 0.16 + hash2(i, 5.5) * 0.2,
              leanYaw: Math.PI + (hash2(i, 2.9) - 0.5) * 0.85,
              phase: i * 0.7,
            });
            // Tambah pohon kedua agak masuk ke daratan
            const backX = jitterX + 5.5 + hash2(i, 6.1) * 4;
            const backZ = jitterZ + (hash2(i, 9.4) - 0.5) * 4;
            const hb = getIslandHeight(backX, backZ);
            if (hb > 2.2 && hb < 12) {
              items.push({
                pos: [backX, hb - 0.15, backZ],
                scale: 1.0 + hash2(i, 3.7) * 0.38,
                leanAngle: 0.12 + hash2(i, 7.1) * 0.16,
                leanYaw: Math.PI + (hash2(i, 4.1) - 0.5) * 1.1,
                phase: i * 1.1 + 1.5,
              });
            }
          }
          break;
        }
      }
    });

    // Tambah pohon kelapa di punggung & lereng kiri/kanan bukit agar siluet bukit tampak alami & tropis
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lz = side * (22 + hash2(i, 12.7) * 44);
      const lx = -12 + hash2(i, 15.1) * 46;
      const h = getIslandHeight(lx, lz);
      if (h >= 7.0 && h <= 34.0) {
        items.push({
          pos: [lx, h - 0.25, lz],
          scale: 0.9 + hash2(i, 17.9) * 0.42,
          leanAngle: 0.1 + hash2(i, 13.4) * 0.18,
          leanYaw: Math.PI + (hash2(i, 8.8) - 0.5) * 2.2,
          phase: i * 0.9,
        });
      }
    }

    return items;
  }, []);

  // 4. Batu karang pantai di kedua ujung teluk
  const rocks = useMemo(() => {
    const spots: { pos: [number, number, number]; scale: [number, number, number]; rot: number }[] = [
      { pos: [-44, 0.8, -58], scale: [5.5, 3.2, 4.8], rot: 0.4 },
      { pos: [-48, 0.4, -52], scale: [3.4, 2.1, 3.8], rot: 1.2 },
      { pos: [-42, 0.9, 56], scale: [6.0, 3.5, 5.2], rot: 2.1 },
      { pos: [-47, 0.5, 49], scale: [3.8, 2.2, 3.2], rot: 0.8 },
      { pos: [-38, 1.1, -34], scale: [2.8, 1.6, 2.4], rot: 1.7 },
      { pos: [-39, 1.0, 36], scale: [3.1, 1.8, 2.7], rot: 2.5 },
    ];
    return spots;
  }, []);

  useFrame(({ clock }) => {
    if (surfRingRef.current) {
      const t = clock.elapsedTime;
      const pulse = 1 + Math.sin(t * 1.6) * 0.012;
      surfRingRef.current.scale.set(pulse, 1, pulse * 1.18);
    }
  });

  return (
    <group position={position}>
      {/* Pantulan hangat cahaya senja dari samudra barat menerangi teluk pasir putih, kelapa, & bukit pulau */}
      <pointLight position={[-68, 28, -22]} color="#ffd5a3" intensity={85} distance={190} decay={1} />
      <pointLight position={[-62, 22, 30]} color="#ffbe7d" intensity={55} distance={170} decay={1} />

      {/* Laguna dangkal pirus & buih pantai */}
      <mesh
        ref={surfRingRef}
        position={[-6, 0.22, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[215, 245]} />
        <meshBasicMaterial
          map={lagoonTex}
          transparent
          opacity={0.78}
          depthWrite={false}
        />
      </mesh>

      {/* Daratan Pulau (Pasir Putih -> Bukit Tropis) */}
      <mesh geometry={terrainGeo}>
        <meshStandardMaterial
          vertexColors
          map={detailTex}
          bumpMap={detailTex}
          bumpScale={0.18}
          roughness={0.86}
          metalness={0.02}
        />
      </mesh>

      {/* Batu Karang Pantai */}
      {rocks.map((r, idx) => (
        <mesh
          key={idx}
          position={r.pos}
          scale={r.scale}
          rotation={[0.15, r.rot, 0.1]}
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#584e45"
            map={detailTex}
            roughness={0.9}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* Rumpun Hutan di Lereng Bukit */}
      <JungleCanopyInstanced />

      {/* Pohon Kelapa Melambai di Sepanjang Pantai Pasir Putih */}
      {palms.map((p, idx) => (
        <CoconutPalmTree
          key={idx}
          position={p.pos}
          scale={p.scale}
          leanAngle={p.leanAngle}
          leanYaw={p.leanYaw}
          phase={p.phase}
        />
      ))}

      {/* Huruf 3D Raksasa "JTT08" di Lereng Bukit */}
      <HillsideJtt08Sign />
    </group>
  );
}
