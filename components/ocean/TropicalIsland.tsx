"use client";

/**
 * Pulau Tropis Realistis dengan Pantai Pasir Putih Melengkung (Teluk),
 * Rimbun Pohon Kelapa Berlapis, Semak Hijau Tropis, dan Huruf 3D "LAST MILE".
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
 * Hitung ketinggian permukaan pulau tropis landai berbentuk teluk bulan sabit pada koordinat lokal (lx, lz).
 * Sisi depan (-X) memiliki teluk pasir putih melengkung, diikuti gundukan rumput rendah (~7-11 m)
 * yang menjadi tempat rimbun hutan kelapa dan tulisan 3D "LAST MILE".
 */
export function getIslandHeight(lx: number, lz: number): number {
  const ez = lz / 88;
  if (Math.abs(ez) >= 1.12) return -2.2;

  const wingEnvelope = Math.sqrt(Math.max(0, 1 - Math.min(1, ez * ez)));
  const xBack = 52 * wingEnvelope;
  // Teluk melengkung di bagian depan-tengah kanan (lz ≈ +8) seperti foto referensi
  const coveCut = Math.exp(-((lz - 8) ** 2) / 420) * 32;
  const xFront = -54 * wingEnvelope + coveCut;

  if (lx < xFront - 12 || lx > xBack + 12) return -2.2;

  const span = Math.max(8, xBack - xFront);
  const ux = (lx - (xFront + xBack) * 0.5) / (span * 0.5);
  const inner = Math.max(0, 1 - ux * ux) * Math.max(0, 1 - ez * ez);
  if (inner <= 0) return -2.2;

  const smoothMask = inner * inner * (3 - 2 * inner);
  const hillBias = THREE.MathUtils.smoothstep(ux, -0.55, 0.35);

  // Gundukan hutan tengah yang landai (tanpa gunung tebing tinggi)
  const mainKnoll = Math.exp(-((lx - 14) ** 2) / 1450 - (lz ** 2) / 2800) * 7.6;
  const leftKnoll = Math.exp(-((lx - 12) ** 2) / 900 - ((lz + 42) ** 2) / 1100) * 4.8;
  const rightKnoll = Math.exp(-((lx - 14) ** 2) / 900 - ((lz - 44) ** 2) / 1100) * 4.6;

  // Permukaan berumput alami tepat di belakang garis teluk untuk dudukan "LAST MILE"
  const signBerm = Math.exp(-((lx + 10) ** 2) / 140 - (lz ** 2) / 520) * 4.1;

  // Variasi kontur pasir & gundukan rumput organik halus
  const detail = fbm(lx * 0.052 + 2.7, lz * 0.052 + 6.1, 3) * (0.65 + hillBias * 1.15);
  const beachRamp = Math.pow(inner, 0.72) * 4.1;

  return -1.6 + beachRamp + smoothMask * (mainKnoll + leftKnoll + rightKnoll + signBerm + detail) * (0.42 + 0.58 * hillBias);
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

// ── Komponen Pohon Kelapa Instanced (PalmGrovesInstanced) ──────

interface SharedPalmAssets {
  trunkGeo: THREE.BufferGeometry;
  frondGeo: THREE.BufferGeometry;
  coconutGeo: THREE.SphereGeometry;
  trunkMat: THREE.MeshStandardMaterial;
  frondMat: THREE.MeshStandardMaterial;
  coconutMat: THREE.MeshStandardMaterial;
  crownLocalPos: THREE.Vector3;
}

let _sharedPalmAssets: SharedPalmAssets | null = null;

function getSharedPalmAssets(): SharedPalmAssets {
  if (_sharedPalmAssets) return _sharedPalmAssets;

  const h = 8.4;
  const leanAngle = 0.2;
  const dx = Math.sin(leanAngle) * h;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(dx * 0.35, h * 0.33, 0),
    new THREE.Vector3(dx * 0.75, h * 0.68, 0),
    new THREE.Vector3(dx, h, 0),
  ]);
  const trunkGeo = new THREE.TubeGeometry(curve, 8, 0.28, 6, false);
  const tPos = trunkGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < tPos.count; i++) {
    v.fromBufferAttribute(tPos, i);
    const t = Math.max(0, Math.min(1, v.y / h));
    const center = curve.getPointAt(t);
    const ring = 1 + Math.sin(t * 55) * 0.06;
    const taper = (1 - t * 0.44) * ring;
    v.sub(center).multiplyScalar(taper).add(center);
    tPos.setXYZ(i, v.x, v.y, v.z);
  }
  trunkGeo.computeVertexNormals();

  // Pelepah kelapa lebar & melengkung penuh (seperti kanopi lebat pada referensi)
  const frondGeo = new THREE.PlaneGeometry(6.8, 3.15, 8, 3);
  frondGeo.rotateX(-Math.PI / 2);
  frondGeo.translate(3.3, 0, 0);
  const pos = frondGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const u = Math.max(0, x / 6.8);
    const archY = Math.sin(u * Math.PI * 0.78) * 0.92 - u * u * 1.72;
    const vFold = -Math.abs(z) * 0.3;
    pos.setY(i, pos.getY(i) + archY + vFold);
  }
  frondGeo.computeVertexNormals();

  const coconutGeo = new THREE.SphereGeometry(0.15, 7, 7);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: "#5c4632",
    roughness: 0.9,
    metalness: 0.02,
  });
  const frondMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: getPalmFrondTexture(),
    alphaTest: 0.32,
    side: THREE.DoubleSide,
    emissive: "#2b4d16",
    emissiveIntensity: 0.28,
    roughness: 0.54,
    metalness: 0.02,
  });
  const coconutMat = new THREE.MeshStandardMaterial({
    color: "#4a3219",
    roughness: 0.65,
  });

  _sharedPalmAssets = {
    trunkGeo,
    frondGeo,
    coconutGeo,
    trunkMat,
    frondMat,
    coconutMat,
    crownLocalPos: new THREE.Vector3(dx, h, 0),
  };
  return _sharedPalmAssets;
}

interface PalmPlacement {
  pos: [number, number, number];
  scale: number;
  leanYaw: number;
}

function PalmGrovesInstanced({ palms }: { palms: PalmPlacement[] }) {
  const { trunkGeo, frondGeo, coconutGeo, trunkMat, frondMat, coconutMat, crownLocalPos } = useMemo(
    () => getSharedPalmAssets(),
    []
  );
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const frondRef = useRef<THREE.InstancedMesh>(null);
  const coconutRef = useRef<THREE.InstancedMesh>(null);

  const frondsPerTree = 12;
  const coconutsPerTree = 3;

  useEffect(() => {
    const trunkInst = trunkRef.current;
    const frondInst = frondRef.current;
    const cocoInst = coconutRef.current;
    if (!trunkInst || !frondInst || !cocoInst) return;

    // Layer 2: render di kamera utama, lewati mirrorCamera refleksi air
    trunkInst.layers.set(2);
    frondInst.layers.set(2);
    cocoInst.layers.set(2);

    const frondTints = [
      new THREE.Color("#ffffff"),
      new THREE.Color("#eef6cc"),
      new THREE.Color("#cfe4a3"),
      new THREE.Color("#bdd894"),
      new THREE.Color("#f5f5c6"),
    ];

    const treeDummy = new THREE.Object3D();
    const childDummy = new THREE.Object3D();
    const worldM = new THREE.Matrix4();
    let fIdx = 0;
    let cIdx = 0;

    palms.forEach((p, tIdx) => {
      treeDummy.position.set(...p.pos);
      treeDummy.rotation.set(0, -p.leanYaw, 0);
      treeDummy.scale.setScalar(p.scale);
      treeDummy.updateMatrix();
      trunkInst.setMatrixAt(tIdx, treeDummy.matrix);

      for (let i = 0; i < frondsPerTree; i++) {
        const tier = i % 3;
        const yaw = (i / frondsPerTree) * Math.PI * 2 + tier * 0.21 + tIdx * 0.41;
        const pitch = tier === 0 ? 0.44 : tier === 1 ? 0.04 : -0.34;
        const roll = (tier - 1) * 0.2;
        const fScale = tier === 1 ? 1.12 : 0.96;
        childDummy.position.copy(crownLocalPos);
        childDummy.rotation.set(roll, yaw, pitch);
        childDummy.scale.setScalar(fScale);
        childDummy.updateMatrix();
        worldM.multiplyMatrices(treeDummy.matrix, childDummy.matrix);
        frondInst.setMatrixAt(fIdx, worldM);
        frondInst.setColorAt(fIdx, frondTints[(tIdx + i) % frondTints.length]);
        fIdx++;
      }

      for (let i = 0; i < coconutsPerTree; i++) {
        const a = i * 2.1 + tIdx * 0.5;
        childDummy.position.set(
          crownLocalPos.x + Math.cos(a) * 0.22,
          crownLocalPos.y - 0.18,
          crownLocalPos.z + Math.sin(a) * 0.22
        );
        childDummy.rotation.set(0, 0, 0);
        childDummy.scale.setScalar(1);
        childDummy.updateMatrix();
        worldM.multiplyMatrices(treeDummy.matrix, childDummy.matrix);
        cocoInst.setMatrixAt(cIdx++, worldM);
      }
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    frondInst.instanceMatrix.needsUpdate = true;
    if (frondInst.instanceColor) frondInst.instanceColor.needsUpdate = true;
    cocoInst.instanceMatrix.needsUpdate = true;
  }, [palms, crownLocalPos]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, palms.length]} />
      <instancedMesh ref={frondRef} args={[frondGeo, frondMat, palms.length * frondsPerTree]} />
      <instancedMesh ref={coconutRef} args={[coconutGeo, coconutMat, palms.length * coconutsPerTree]} />
    </group>
  );
}

/** Rumpun palem muda / pakis rendah di sepanjang tepi pantai berumput (1 draw call) */
function LowYoungPalmsInstanced({ spots }: { spots: PalmPlacement[] }) {
  const { frondGeo, frondMat } = useMemo(() => getSharedPalmAssets(), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const frondsPerCluster = 7;

  useEffect(() => {
    const inst = meshRef.current;
    if (!inst) return;
    inst.layers.set(2);

    const youngTints = [
      new THREE.Color("#f0f9c2"),
      new THREE.Color("#d9f0a4"),
      new THREE.Color("#ffffff"),
      new THREE.Color("#c4e48e"),
    ];

    const baseDummy = new THREE.Object3D();
    const leafDummy = new THREE.Object3D();
    const worldM = new THREE.Matrix4();
    let idx = 0;

    spots.forEach((s, sIdx) => {
      baseDummy.position.set(s.pos[0], s.pos[1] + 0.35, s.pos[2]);
      baseDummy.rotation.set(0, s.leanYaw, 0);
      baseDummy.scale.setScalar(s.scale);
      baseDummy.updateMatrix();

      for (let i = 0; i < frondsPerCluster; i++) {
        const yaw = (i / frondsPerCluster) * Math.PI * 2 + sIdx * 0.55;
        const pitch = i % 2 === 0 ? 0.34 : 0.14;
        leafDummy.position.set(0, 0, 0);
        leafDummy.rotation.set(((i % 3) - 1) * 0.12, yaw, pitch);
        leafDummy.scale.setScalar(i % 2 === 0 ? 0.96 : 0.8);
        leafDummy.updateMatrix();
        worldM.multiplyMatrices(baseDummy.matrix, leafDummy.matrix);
        inst.setMatrixAt(idx, worldM);
        inst.setColorAt(idx, youngTints[(sIdx + i) % youngTints.length]);
        idx++;
      }
    });

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [spots]);

  return (
    <instancedMesh ref={meshRef} args={[frondGeo, frondMat, spots.length * frondsPerCluster]} />
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

const SIGN_LOCAL_X = -10;
const SIGN_SCALE = 0.56;
const SIGN_GAP = 1.15;

function getUniformSignBaseY() {
  return Math.max(7.2, getIslandHeight(SIGN_LOCAL_X, 0) - 0.35);
}

/**
 * Titik tengah (koordinat lokal pulau) papan 3D "LAST MILE" agar animasi zoom kamera
 * tepat mengarah ke tulisan di tepi hutan kelapa pada berbagai rasio layar.
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

let _cachedLastMileLetters:
  | { geo: THREE.BufferGeometry; char: string; zStart: number; width: number; baseY: number; strutXs: number[] }[]
  | null = null;

function getCachedLastMileLetters() {
  if (_cachedLastMileLetters) return _cachedLastMileLetters;
  const defs = createLetterShapes();
  const totalW =
    defs.reduce((s, d) => s + d.width + (d.extraGapBefore || 0), 0) +
    SIGN_GAP * (defs.length - 1);
  let cursor = -totalW / 2;
  const baseY = getUniformSignBaseY();

  _cachedLastMileLetters = defs.map((d) => {
    cursor += d.extraGapBefore || 0;
    const geo = new THREE.ExtrudeGeometry(d.shapes, {
      depth: 1.75,
      bevelEnabled: true,
      bevelThickness: 0.22,
      bevelSize: 0.16,
      bevelSegments: 2,
    });
    const zStart = cursor * SIGN_SCALE;
    cursor += d.width + SIGN_GAP;
    return { geo, char: d.char, zStart, width: d.width, baseY, strutXs: d.strutXs };
  });
  return _cachedLastMileLetters;
}

function HillsideLastMileSign({ isLowSpec = false }: { isLowSpec?: boolean }) {
  const letters = useMemo(() => getCachedLastMileLetters(), []);

  const frontMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#fdfaf3",
        emissive: "#ffe0b2",
        emissiveIntensity: 0.34,
        roughness: 0.32,
        metalness: 0.06,
      }),
    []
  );

  const sideMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#a87e54",
        emissive: "#482e18",
        emissiveIntensity: 0.14,
        roughness: 0.52,
        metalness: 0.18,
      }),
    []
  );

  const strutMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#332a22",
        roughness: 0.78,
        metalness: 0.25,
      }),
    []
  );

  const terraceMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#4f4336",
        roughness: 0.88,
        metalness: 0.04,
      }),
    []
  );

  const letterMats = useMemo(() => [frontMat, sideMat], [frontMat, sideMat]);
  const baseY = getUniformSignBaseY();

  const strutCount = useMemo(
    () => letters.reduce((s, l) => s + l.strutXs.length, 0),
    [letters]
  );
  const strutRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const inst = strutRef.current;
    if (!inst) return;
    inst.layers.set(2);
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (const l of letters) {
      for (const sx of l.strutXs) {
        dummy.position.set(
          1.35 * SIGN_SCALE,
          l.baseY + 3.6 * SIGN_SCALE,
          l.zStart + sx * SIGN_SCALE
        );
        dummy.rotation.set(0, 0, -0.32);
        dummy.scale.setScalar(SIGN_SCALE);
        dummy.updateMatrix();
        inst.setMatrixAt(idx++, dummy.matrix);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [letters]);

  return (
    /* Diputar menghadap -X (ke arah kapal yang mendekat):
       sumbu X lokal ExtrudeGeometry mengarah ke +Z dunia */
    <group position={[SIGN_LOCAL_X, 0, 0]}>
      {/* Dudukan batu & kayu rendah yang menyatu dengan gundukan rumput pantai */}
      <mesh position={[0.45, baseY - 0.52, 0]} material={terraceMat}>
        <boxGeometry args={[2.2, 1.05, 34.5]} />
      </mesh>

      {letters.map((l, idx) => (
        <group key={idx} position={[0, l.baseY, l.zStart]} rotation={[0, -Math.PI / 2, 0]} scale={SIGN_SCALE}>
          <mesh geometry={l.geo} material={letterMats} />
        </group>
      ))}

      {/* Tiang penyangga belakang (1 instanced draw call di layer 2) */}
      <instancedMesh ref={strutRef} args={[undefined, strutMat, strutCount]}>
        <cylinderGeometry args={[0.13, 0.17, 9.2, 6]} />
      </instancedMesh>
    </group>
  );
}

// ── Semak Tropis Rapat di Bawah Tajuk Kelapa ────────────────

function JungleCanopyInstanced({ isLowSpec = false }: { isLowSpec?: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const detailTex = useMemo(() => getTerrainDetailTexture(), []);

  const bushes = useMemo(() => {
    const list: { pos: [number, number, number]; scale: [number, number, number]; color: THREE.Color }[] = [];
    const palette = ["#2f5e21", "#3e7429", "#4f8932", "#629b3a", "#264e1a", "#72a741"];
    const maxBushes = isLowSpec ? 75 : 135;
    for (let i = 0; i < maxBushes * 5; i++) {
      if (list.length >= maxBushes) break;
      const lx = -46 + hash2(i * 1.7, 3.3) * 90;
      const lz = (hash2(i * 2.9, 7.1) * 2 - 1) * 78;
      // Jangan tutupi area di depan tulisan LAST MILE
      if (lx < -5 && Math.abs(lz) < 20) continue;
      const h = getIslandHeight(lx, lz);
      if (h < 2.2 || h > 12.2) continue;
      const isEdge = h < 4.0;
      const sx = (isEdge ? 1.8 : 2.5) + hash2(i, 19.3) * (isEdge ? 1.6 : 2.5);
      const col = new THREE.Color(palette[i % palette.length]);
      list.push({
        pos: [lx, h - sx * 0.34, lz],
        scale: [sx * 1.22, sx * (isEdge ? 0.78 : 1.02), sx * 1.15],
        color: col,
      });
    }
    return list;
  }, [isLowSpec]);

  useEffect(() => {
    const inst = meshRef.current;
    if (!inst) return;
    inst.layers.set(2);
    const dummy = new THREE.Object3D();
    bushes.forEach((b, idx) => {
      dummy.position.set(...b.pos);
      dummy.scale.set(...b.scale);
      dummy.rotation.set(hash2(idx, 1.1) * 0.28, idx * 1.17, hash2(idx, 2.3) * 0.28);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(idx, b.color);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [bushes]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, bushes.length]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#ffffff"
        map={detailTex}
        emissive="#1e3d11"
        emissiveIntensity={0.22}
        roughness={0.84}
        metalness={0.02}
      />
    </instancedMesh>
  );
}

// ── Cache Geometri & Material Pulau Tropis (Zero UV Stretching) ──

const _cachedTerrainGeoMap = new Map<number, THREE.BufferGeometry>();
let _cachedIslandMat: THREE.MeshStandardMaterial | null = null;

function getCachedIslandTerrainGeometry(segs: number): THREE.BufferGeometry {
  const existing = _cachedTerrainGeoMap.get(segs);
  if (existing) return existing;

  const geo = new THREE.PlaneGeometry(180, 210, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    pos.setY(i, getIslandHeight(lx, lz));
  }
  geo.computeVertexNormals();

  // Vertex color alami: pasir basah -> pasir pantai krem-keemasan -> rumput pantai -> lantai hutan teduh
  const colors = new Float32Array(pos.count * 3);
  const cWetSand = new THREE.Color("#c5b08a");
  const cBrightSand = new THREE.Color("#f3e5c7");
  const cWarmSand = new THREE.Color("#e8d4ae");
  const cShoreGrass = new THREE.Color("#889d45");
  const cLushGrass = new THREE.Color("#4f782d");
  const cJungleFloor = new THREE.Color("#2a4d1e");
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const nVar = valueNoise(lx * 0.14, lz * 0.14);
    const nFine = valueNoise(lx * 0.38 + 5.1, lz * 0.38 - 2.3);

    // Transisi organik berombak antara pasir pantai & garis rumput (tidak kaku)
    const grassLine = 2.45 + (nVar - 0.5) * 0.65;

    if (y < 0.72) {
      tmp.copy(cWetSand).lerp(cBrightSand, THREE.MathUtils.clamp((y + 0.3) / 1.02, 0, 1));
    } else if (y < grassLine) {
      tmp.copy(cBrightSand).lerp(cWarmSand, nFine * 0.55);
    } else if (y < grassLine + 1.55) {
      const gT = THREE.MathUtils.clamp((y - grassLine) / 1.55, 0, 1);
      tmp.copy(cWarmSand).lerp(cShoreGrass, gT).lerp(cLushGrass, Math.max(0, gT - 0.35) * 0.9);
    } else if (y < 6.5) {
      const fT = THREE.MathUtils.clamp((y - (grassLine + 1.55)) / 3.2, 0, 1);
      tmp.copy(cLushGrass).lerp(cJungleFloor, fT * 0.75 + nVar * 0.25);
    } else {
      tmp.copy(cJungleFloor).lerp(cLushGrass, nFine * 0.32);
    }

    // AO lembut di bawah rimbun bagian dalam pulau
    const hAvg =
      (getIslandHeight(lx + 4, lz) +
        getIslandHeight(lx - 4, lz) +
        getIslandHeight(lx, lz + 4) +
        getIslandHeight(lx, lz - 4)) *
      0.25;
    const concavity = THREE.MathUtils.clamp((hAvg - y) * 0.12, 0, 0.28);
    tmp.multiplyScalar(1 - concavity);

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  _cachedTerrainGeoMap.set(segs, geo);
  return geo;
}

function getDetailedIslandMaterial(detailTex: THREE.CanvasTexture | null): THREE.MeshStandardMaterial {
  if (_cachedIslandMat) return _cachedIslandMat;

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTex,
    roughness: 0.9,
    metalness: 0.01,
  });

  mat.customProgramCacheKey = () => "tropical-palm-island-v3";
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vTerrainPos;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vTerrainPos = position;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vTerrainPos;

         float tmHash(vec2 p) {
           return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
         }
         float tmNoise(vec2 p) {
           vec2 i = floor(p);
           vec2 f = fract(p);
           vec2 u = f * f * (3.0 - 2.0 * f);
           return mix(
             mix(tmHash(i), tmHash(i + vec2(1.0, 0.0)), u.x),
             mix(tmHash(i + vec2(0.0, 1.0)), tmHash(i + vec2(1.0, 1.0)), u.x),
             u.y
           );
         }
         float tmFbm(vec2 p) {
           float v = 0.0;
           float a = 0.5;
           for (int i = 0; i < 4; i++) {
             v += a * tmNoise(p);
             p = p * 2.08 + vec2(11.3, 5.7);
             a *= 0.5;
           }
           return v;
         }
         vec3 perturbTerrainNormal(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
           vec3 vSigmaX = normalize(dFdx(surf_pos));
           vec3 vSigmaY = normalize(dFdy(surf_pos));
           vec3 R1 = cross(vSigmaY, surf_norm);
           vec3 R2 = cross(surf_norm, vSigmaX);
           float fDet = dot(vSigmaX, R1) * faceDir;
           vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
           return normalize(abs(fDet) * surf_norm - vGrad);
         }`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         float tmVeg = smoothstep(2.1, 3.8, vTerrainPos.y);
         float tmSand = 1.0 - smoothstep(1.2, 3.2, vTerrainPos.y);

         float tmMacro = tmFbm(vTerrainPos.xz * 0.25);
         float tmGrass = tmFbm(vTerrainPos.xz * 1.15 + tmMacro * 1.4);
         float tmSpeck = tmNoise(vTerrainPos.xz * 4.2);

         // Tekstur rumput pantai & lantai hutan tropis
         vec3 vegTint = mix(vec3(0.72, 0.84, 0.56), vec3(1.18, 1.24, 0.86), tmGrass * 0.72 + tmSpeck * 0.28);
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vegTint, tmVeg * 0.78);

         // Tekstur pasir koral lembut & bintik kerikil halus (seperti pantai di foto)
         float sandRipple = tmNoise(vec2(vTerrainPos.x * 1.7, vTerrainPos.z * 0.85 + tmMacro * 1.6));
         float pebbleSpeck = step(0.84, tmNoise(vTerrainPos.xz * 3.4));
         diffuseColor.rgb *= mix(1.0, 0.94 + sandRipple * 0.1 - pebbleSpeck * 0.08, tmSand);

         float tmMicroH =
           tmVeg * (tmGrass * 0.55 + tmSpeck * 0.22) +
           tmSand * (sandRipple * 0.14 - pebbleSpeck * 0.06);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
         normal = perturbTerrainNormal(-vViewPosition, normal, vec2(dFdx(tmMicroH), dFdy(tmMicroH)) * 1.25, faceDirection);`
      );
  };

  _cachedIslandMat = mat;
  return mat;
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

  // 1. Geometri kontur pulau landai (di-cache agar instan saat transisi ke kapal)
  const terrainGeo = useMemo(
    () => getCachedIslandTerrainGeometry(isLowSpec ? 64 : 84),
    [isLowSpec]
  );
  const islandMat = useMemo(() => getDetailedIslandMaterial(detailTex), [detailTex]);

  // 2. Buih tipis tepi pantai & dangkal teluk
  const lagoonTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 46, 128, 128, 126);
    g.addColorStop(0, "rgba(255, 248, 232, 0.72)");
    g.addColorStop(0.55, "rgba(182, 230, 218, 0.34)");
    g.addColorStop(0.82, "rgba(74, 152, 162, 0.14)");
    g.addColorStop(1, "rgba(12, 60, 80, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // 3. Sebaran rimbun pohon kelapa (barisan pantai melengkung + hutan tengah + sayap teluk) & palem muda rendah
  const { palms, lowPalms } = useMemo(() => {
    const tall: PalmPlacement[] = [];
    const low: PalmPlacement[] = [];
    const targetTall = isLowSpec ? 46 : 76;

    // Pohon kelapa pantai di sayap kiri & kanan yang menjorok menghadap teluk (persis siluet foto)
    const wingZ = [-68, -60, -52, -44, -36, -28, 30, 38, 46, 54, 62, 70];
    wingZ.forEach((lz, i) => {
      for (let lx = -58; lx <= -6; lx += 3.0) {
        const h = getIslandHeight(lx, lz);
        if (h >= 2.0 && h <= 4.2) {
          tall.push({
            pos: [lx, h - 0.18, lz],
            scale: 0.92 + hash2(i, 8.2) * 0.44,
            leanYaw: Math.PI + (lz < 0 ? 0.35 : -0.35) + (hash2(i, 2.9) - 0.5) * 0.65,
          });
          break;
        }
      }
    });

    // Hutan kelapa rapat memenuhi seluruh gundukan pulau di belakang & samping tulisan LAST MILE
    for (let i = 0; i < 480 && tall.length < targetTall; i++) {
      const lx = -24 + hash2(i * 1.9, 4.7) * 66;
      const lz = (hash2(i * 3.1, 11.3) * 2 - 1) * 74;
      // Sisakan koridor bersih di depan tulisan LAST MILE agar huruf terbaca tegas
      if (lx < -4.5 && Math.abs(lz) < 20.5) continue;
      const h = getIslandHeight(lx, lz);
      if (h < 2.8 || h > 12.2) continue;

      // Jaga jarak minimum agar batang kelapa tidak saling bertumpuk
      let tooClose = false;
      for (const ex of tall) {
        const dx = ex.pos[0] - lx;
        const dz = ex.pos[2] - lz;
        if (dx * dx + dz * dz < 30) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Campurkan kelapa muda lebih pendek (0.62..0.95) & kelapa tinggi (1.0..1.48) untuk siluet hutan rapat
      tall.push({
        pos: [lx, h - 0.25, lz],
        scale: 0.62 + hash2(i, 17.9) * 0.86,
        leanYaw: hash2(i, 8.8) * Math.PI * 2,
      });
    }

    // Rumpun palem muda / pakis rendah berdaun lebar di garis batas pasir-rumput
    const targetLow = isLowSpec ? 28 : 54;
    for (let i = 0; i < 340 && low.length < targetLow; i++) {
      const lx = -48 + hash2(i * 2.3, 13.7) * 86;
      const lz = (hash2(i * 4.1, 5.9) * 2 - 1) * 76;
      if (lx < -6 && Math.abs(lz) < 18.5) continue;
      const h = getIslandHeight(lx, lz);
      if (h < 2.25 || h > 7.2) continue;
      low.push({
        pos: [lx, h - 0.12, lz],
        scale: 0.48 + hash2(i, 21.4) * 0.28,
        leanYaw: hash2(i, 3.2) * Math.PI * 2,
      });
    }

    return { palms: tall, lowPalms: low };
  }, [isLowSpec]);

  useFrame(({ clock }) => {
    if (surfRingRef.current) {
      const t = clock.elapsedTime;
      const pulse = 1 + Math.sin(t * 1.4) * 0.01;
      surfRingRef.current.scale.set(pulse, 1, pulse * 1.16);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Buih tipis garis pantai & perairan dangkal teluk */}
      <mesh
        ref={surfRingRef}
        position={[-4, 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[195, 225]} />
        <meshBasicMaterial
          map={lagoonTex}
          transparent
          opacity={0.58}
          depthWrite={false}
        />
      </mesh>

      {/* Daratan Pulau (Pantai Pasir Putih Melengkung -> Gundukan Rumput Tropis) */}
      <mesh geometry={terrainGeo} material={islandMat} />

      {/* Semak Tropis Rapat Penutup Tepi & Bawah Tajuk Kelapa */}
      <JungleCanopyInstanced isLowSpec={isLowSpec} />

      {/* Palem Muda / Pakis Rendah di Garis Pantai Berumput */}
      <LowYoungPalmsInstanced spots={lowPalms} />

      {/* Rimbun Hutan Pohon Kelapa Berlapis Instanced */}
      <PalmGrovesInstanced palms={palms} />

      {/* Huruf 3D "LAST MILE" yang Tertanam Rapi di Tepi Hutan Kelapa */}
      <HillsideLastMileSign isLowSpec={isLowSpec} />
    </group>
  );
}
