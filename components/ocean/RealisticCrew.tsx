"use client";

/**
 * Figur awak kapal, kapten, roda kemudi kayu, dan tangan POV kapten bergaya realistis.
 * Menggunakan geometri anatomis halus (LatheGeometry + Tube/Cylinder bertingkat) dan
 * tekstur prosedural (serat kayu mahoni, tenunan kain mantel wol/linen, kulit realistis)
 * sehingga tampak proporsional & realistis di bawah pencahayaan PBR senja.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Tekstur Prosedural (Dibuat sekali di klien) ─────────────────

let _woodTex: THREE.CanvasTexture | null = null;
let _fabricBumpTex: THREE.CanvasTexture | null = null;

function getWoodTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (_woodTex) return _woodTex;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#4a2713";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const v = Math.sin(y * 0.18) * 10 + Math.sin(y * 0.63) * 5;
    const r = Math.max(25, Math.min(115, 74 + v));
    const g = Math.max(12, Math.min(68, 39 + v * 0.55));
    const b = Math.max(6, Math.min(38, 19 + v * 0.3));
    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  _woodTex = tex;
  return tex;
}

function getFabricBumpTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (_fabricBumpTex) return _fabricBumpTex;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const weave = ((x + y) & 1) * 28 + (Math.sin(x * 0.5) * Math.cos(y * 0.5) * 18);
      const val = Math.max(0, Math.min(255, 128 + weave)) | 0;
      const idx = (y * 128 + x) * 4;
      img.data[idx] = val;
      img.data[idx + 1] = val;
      img.data[idx + 2] = val;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  _fabricBumpTex = tex;
  return tex;
}

// ── Roda Kemudi Kapal Kayu & Binnacle Kompas (ShipHelm) ─────────

export function ShipWheelRing({
  radius = 0.56,
  spokes = 10,
  handleLength = 0.16,
}: {
  radius?: number;
  spokes?: number;
  handleLength?: number;
}) {
  const woodMap = useMemo(() => getWoodTexture(), []);

  const woodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#5a2f18",
        map: woodMap,
        roughness: 0.42,
        metalness: 0.08,
      }),
    [woodMap]
  );

  const darkWoodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#381c0d",
        map: woodMap,
        roughness: 0.48,
        metalness: 0.06,
      }),
    [woodMap]
  );

  const brassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d4a24c",
        roughness: 0.26,
        metalness: 0.88,
      }),
    []
  );

  useEffect(() => {
    return () => {
      woodMat.dispose();
      darkWoodMat.dispose();
      brassMat.dispose();
    };
  }, [woodMat, darkWoodMat, brassMat]);

  const spokeAngles = useMemo(
    () => Array.from({ length: spokes }, (_, i) => (i / spokes) * Math.PI * 2),
    [spokes]
  );

  return (
    <group>
      {/* Lingkar luar kayu mahoni utama */}
      <mesh material={woodMat}>
        <torusGeometry args={[radius, 0.036, 16, 48]} />
      </mesh>
      {/* Lingkar dalam kayu penguat */}
      <mesh material={darkWoodMat}>
        <torusGeometry args={[radius * 0.72, 0.022, 12, 40]} />
      </mesh>
      {/* Ring kuningan di sisi depan & belakang lingkar kemudi */}
      <mesh position={[0, 0, 0.032]} material={brassMat}>
        <torusGeometry args={[radius, 0.008, 8, 48]} />
      </mesh>
      <mesh position={[0, 0, -0.032]} material={brassMat}>
        <torusGeometry args={[radius, 0.008, 8, 48]} />
      </mesh>

      {/* Poros tengah kayu & tutup kuningan */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={darkWoodMat}>
        <cylinderGeometry args={[0.095, 0.095, 0.11, 20]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.01]} material={brassMat}>
        <cylinderGeometry args={[0.068, 0.068, 0.125, 20]} />
      </mesh>

      {/* Jari-jari bubut (spokes) + pegangan luar (handles) */}
      {spokeAngles.map((ang, idx) => (
        <group key={idx} rotation={[0, 0, ang]}>
          {/* Batang jari-jari */}
          <mesh position={[0, radius * 0.5, 0]} material={woodMat}>
            <cylinderGeometry args={[0.016, 0.022, radius * 0.96, 10]} />
          </mesh>
          {/* Cincin profil bubut di tengah jari-jari */}
          <mesh position={[0, radius * 0.45, 0]} material={brassMat}>
            <torusGeometry args={[0.021, 0.006, 8, 14]} />
          </mesh>
          {/* Pegangan tangan (handle) yang menonjol keluar dari lingkar */}
          <mesh position={[0, radius + handleLength * 0.55, 0]} material={darkWoodMat}>
            <cylinderGeometry args={[0.017, 0.013, handleLength, 12]} />
          </mesh>
          {/* Ujung bulatan pegangan */}
          <mesh position={[0, radius + handleLength + 0.012, 0]} material={woodMat}>
            <sphereGeometry args={[0.022, 12, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Stand kemudi + roda kemudi + binnacle kompas di dek kapal.
 * Roda kemudi menghadap sepanjang sumbu X (kapten berdiri di sisi -X menghadap +X).
 */
export function ShipHelmStand({
  wheelAngleRef,
  hideWheel = false,
}: {
  wheelAngleRef: React.MutableRefObject<number>;
  hideWheel?: boolean;
}) {
  const wheelGroupRef = useRef<THREE.Group>(null);
  const woodMap = useMemo(() => getWoodTexture(), []);

  const standMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#3b1e0e",
        map: woodMap,
        roughness: 0.55,
        metalness: 0.08,
      }),
    [woodMap]
  );

  const brassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c8963e",
        roughness: 0.3,
        metalness: 0.85,
      }),
    []
  );

  useFrame(() => {
    if (wheelGroupRef.current) {
      wheelGroupRef.current.rotation.z = wheelAngleRef.current;
    }
  });

  return (
    <group>
      {/* Alas kayu kemudi di dek */}
      <mesh position={[0.12, 0.04, 0]} material={standMat}>
        <boxGeometry args={[0.62, 0.08, 0.72]} />
      </mesh>
      {/* Tiang, drum & roda kemudi dek (disembunyikan saat mode POV Kapten agar tidak bertumpuk ganda) */}
      {!hideWheel && (
        <>
          <mesh position={[0.1, 0.56, 0]} rotation={[0, 0, -0.08]} material={standMat}>
            <cylinderGeometry args={[0.1, 0.14, 1.05, 16]} />
          </mesh>
          <mesh position={[0.24, 1.02, 0]} rotation={[0, 0, Math.PI / 2]} material={standMat}>
            <cylinderGeometry args={[0.13, 0.13, 0.28, 18]} />
          </mesh>
          <group position={[-0.04, 1.05, 0]} rotation={[0, Math.PI / 2, 0]}>
            <group ref={wheelGroupRef}>
              <ShipWheelRing radius={0.56} spokes={10} />
            </group>
          </group>
        </>
      )}
      {/* Tiang binnacle kompas di depan roda kemudi */}
      <mesh position={[0.46, 0.58, 0]} material={standMat}>
        <cylinderGeometry args={[0.11, 0.13, 1.02, 16]} />
      </mesh>
      {/* Kubah kompas kuningan */}
      <mesh position={[0.46, 1.14, 0]} material={brassMat}>
        <sphereGeometry args={[0.12, 16, 16]} />
      </mesh>
      {/* Cahaya hangat lentera kompas */}
      <pointLight position={[0.42, 1.25, 0]} color="#ffcf87" intensity={1.8} distance={4.5} />
    </group>
  );
}

// ── Geometri Anatomis Manusia Realistis ─────────────────────────

function useHumanGeometries() {
  return useMemo(() => {
    // Profil torso & mantel panjang kapten/pelaut (LatheGeometry halus)
    const coatPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.24, 0.02), // Bawah mantel melebar
      new THREE.Vector2(0.21, 0.25),
      new THREE.Vector2(0.17, 0.48), // Pinggang
      new THREE.Vector2(0.21, 0.72), // Dada
      new THREE.Vector2(0.23, 0.88), // Bahu
      new THREE.Vector2(0.11, 0.96), // Kerah leher
      new THREE.Vector2(0.0, 0.97),
    ];
    const coatGeo = new THREE.LatheGeometry(coatPts, 20);
    coatGeo.scale(0.82, 1, 1.15); // Pipih depan-belakang, lebar di bahu (Z)

    const sailorTorsoPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.17, 0.02),
      new THREE.Vector2(0.16, 0.24),
      new THREE.Vector2(0.19, 0.54),
      new THREE.Vector2(0.21, 0.68),
      new THREE.Vector2(0.1, 0.75),
      new THREE.Vector2(0.0, 0.76),
    ];
    const sailorTorsoGeo = new THREE.LatheGeometry(sailorTorsoPts, 18);
    sailorTorsoGeo.scale(0.8, 1, 1.12);

    return { coatGeo, sailorTorsoGeo };
  }, []);
}

export type CrewRole = "captain" | "haul" | "walk" | "lookout" | "officer";

export function RealisticHumanFigure({
  role,
  coatColor = "#161f2c",
  trouserColor = "#1b1815",
  hatType = "tricorn",
  phase = 0,
  walkRange = 3.2,
  wheelAngleRef,
}: {
  role: CrewRole;
  coatColor?: string;
  trouserColor?: string;
  hatType?: "tricorn" | "captainCap" | "slouch" | "bandana";
  phase?: number;
  walkRange?: number;
  wheelAngleRef?: React.MutableRefObject<number>;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const leftShinRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);

  const { coatGeo, sailorTorsoGeo } = useHumanGeometries();
  const fabricBump = useMemo(() => getFabricBumpTexture(), []);

  const materials = useMemo(() => {
    const coat = new THREE.MeshStandardMaterial({
      color: coatColor,
      bumpMap: fabricBump,
      bumpScale: 0.008,
      roughness: 0.78,
      metalness: 0.05,
    });
    const trouser = new THREE.MeshStandardMaterial({
      color: trouserColor,
      bumpMap: fabricBump,
      bumpScale: 0.006,
      roughness: 0.82,
      metalness: 0.04,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: "#c68b65",
      roughness: 0.58,
      metalness: 0.02,
    });
    const leather = new THREE.MeshStandardMaterial({
      color: "#1b120c",
      roughness: 0.45,
      metalness: 0.12,
    });
    const brass = new THREE.MeshStandardMaterial({
      color: "#d4a24c",
      roughness: 0.28,
      metalness: 0.85,
    });
    const hair = new THREE.MeshStandardMaterial({
      color: "#1f1610",
      roughness: 0.85,
    });
    return { coat, trouser, skin, leather, brass, hair };
  }, [coatColor, trouserColor, fabricBump]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;

    if (role === "captain") {
      const wAng = wheelAngleRef ? wheelAngleRef.current : Math.sin(t * 1.4) * 0.38;
      // Goyangan tubuh kapten menahan kemudi
      if (torsoRef.current) {
        torsoRef.current.rotation.z = Math.sin(t * 1.2) * 0.03;
        torsoRef.current.rotation.x = 0.05 + Math.sin(t * 1.8) * 0.02;
        torsoRef.current.rotation.y = -wAng * 0.14;
      }
      if (headRef.current) {
        headRef.current.rotation.y = Math.sin(t * 0.65) * 0.16;
        headRef.current.rotation.x = -0.04 + Math.sin(t * 1.1) * 0.03;
      }
      // Tangan kiri & kanan terulur ke depan memegang lingkar kemudi yang berputar
      if (leftArmRef.current && leftForearmRef.current) {
        leftArmRef.current.rotation.z = 0.72 + Math.sin(wAng) * 0.22;
        leftArmRef.current.rotation.x = -0.18 + Math.cos(wAng) * 0.15;
        leftForearmRef.current.rotation.z = 0.62 - Math.sin(wAng) * 0.18;
      }
      if (rightArmRef.current && rightForearmRef.current) {
        rightArmRef.current.rotation.z = 0.72 - Math.sin(wAng) * 0.22;
        rightArmRef.current.rotation.x = 0.18 - Math.cos(wAng) * 0.15;
        rightForearmRef.current.rotation.z = 0.62 + Math.sin(wAng) * 0.18;
      }
    } else if (role === "haul") {
      // Menarik tali layar (rigging) secara ritmis
      const pull = Math.sin(t * 2.1);
      if (torsoRef.current) {
        torsoRef.current.rotation.z = -0.12 + pull * 0.16; // Condong maju-mundur
        torsoRef.current.position.y = 0.86 - Math.max(0, pull) * 0.05;
      }
      if (headRef.current) {
        headRef.current.rotation.z = 0.22 - pull * 0.1; // Mendongak ke arah tali atas
      }
      if (leftArmRef.current && leftForearmRef.current) {
        leftArmRef.current.rotation.z = 1.65 - pull * 0.45;
        leftForearmRef.current.rotation.z = 0.55 + pull * 0.35;
      }
      if (rightArmRef.current && rightForearmRef.current) {
        rightArmRef.current.rotation.z = 1.45 - Math.sin(t * 2.1 + 0.6) * 0.45;
        rightForearmRef.current.rotation.z = 0.65 + Math.sin(t * 2.1 + 0.6) * 0.35;
      }
      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.z = 0.18 + pull * 0.08;
        rightLegRef.current.rotation.z = -0.18 + pull * 0.08;
      }
    } else if (role === "walk") {
      // Berjalan menyusuri dek utama (bolak-balik dengan putaran halus)
      const cyclePeriod = 9.0;
      const u = (t % cyclePeriod) / cyclePeriod; // 0..1
      const posAlong = Math.sin(u * Math.PI * 2) * (walkRange * 0.5);
      const dir = Math.cos(u * Math.PI * 2) >= 0 ? 0 : Math.PI;
      const walkCycle = t * 4.4;
      const stride = Math.sin(walkCycle);

      if (rootRef.current) {
        rootRef.current.position.x = posAlong;
        // Putar arah hadap secara halus saat di ujung lintasan
        const targetYaw = dir;
        const diff = Math.atan2(
          Math.sin(targetYaw - rootRef.current.rotation.y),
          Math.cos(targetYaw - rootRef.current.rotation.y)
        );
        rootRef.current.rotation.y += diff * 0.12;
      }
      if (torsoRef.current) {
        torsoRef.current.position.y = 0.88 + Math.abs(Math.cos(walkCycle)) * 0.03;
        torsoRef.current.rotation.z = 0.05;
        torsoRef.current.rotation.y = stride * 0.08;
      }
      if (leftLegRef.current && leftShinRef.current) {
        leftLegRef.current.rotation.z = stride * 0.42;
        leftShinRef.current.rotation.z = -Math.max(0, -stride) * 0.55;
      }
      if (rightLegRef.current && rightShinRef.current) {
        rightLegRef.current.rotation.z = -stride * 0.42;
        rightShinRef.current.rotation.z = -Math.max(0, stride) * 0.55;
      }
      if (leftArmRef.current && leftForearmRef.current) {
        leftArmRef.current.rotation.z = -stride * 0.32;
        leftForearmRef.current.rotation.z = 0.28;
      }
      if (rightArmRef.current && rightForearmRef.current) {
        rightArmRef.current.rotation.z = stride * 0.32;
        rightForearmRef.current.rotation.z = 0.28;
      }
    } else if (role === "lookout") {
      // Pengintai di haluan memegang teropong kuningan ke arah pulau/horizon
      if (torsoRef.current) {
        torsoRef.current.rotation.y = Math.sin(t * 0.55) * 0.22;
        torsoRef.current.rotation.z = 0.06;
      }
      if (headRef.current) {
        headRef.current.rotation.y = Math.sin(t * 0.55) * 0.15;
      }
      if (rightArmRef.current && rightForearmRef.current) {
        rightArmRef.current.rotation.z = 1.25;
        rightArmRef.current.rotation.x = 0.22;
        rightForearmRef.current.rotation.z = 1.1;
      }
      if (leftArmRef.current && leftForearmRef.current) {
        leftArmRef.current.rotation.z = 0.45;
        leftForearmRef.current.rotation.z = 0.35;
      }
    } else if (role === "officer") {
      // Mualim/perwira di quarterdeck menunjuk ke arah haluan
      const gesture = Math.sin(t * 0.9);
      if (torsoRef.current) {
        torsoRef.current.rotation.y = Math.sin(t * 0.5) * 0.18;
      }
      if (headRef.current) {
        headRef.current.rotation.y = Math.sin(t * 0.7) * 0.25;
      }
      if (rightArmRef.current && rightForearmRef.current) {
        rightArmRef.current.rotation.z = 0.95 + Math.max(0, gesture) * 0.45;
        rightForearmRef.current.rotation.z = 0.35;
      }
      if (leftArmRef.current && leftForearmRef.current) {
        leftArmRef.current.rotation.z = 0.35;
        leftForearmRef.current.rotation.z = 0.75;
      }
    }
  });

  const isLongCoat = role === "captain" || role === "officer";

  return (
    <group ref={rootRef}>
      {/* Kaki Kiri */}
      <group ref={leftLegRef} position={[0, 0.88, -0.1]}>
        <mesh position={[0, -0.22, 0]} material={materials.trouser}>
          <cylinderGeometry args={[0.078, 0.064, 0.44, 12]} />
        </mesh>
        <group ref={leftShinRef} position={[0, -0.44, 0]}>
          <mesh position={[0, -0.21, 0]} material={materials.leather}>
            <cylinderGeometry args={[0.066, 0.052, 0.42, 12]} />
          </mesh>
          <mesh position={[0.04, -0.41, 0]} material={materials.leather}>
            <boxGeometry args={[0.21, 0.07, 0.1]} />
          </mesh>
        </group>
      </group>

      {/* Kaki Kanan */}
      <group ref={rightLegRef} position={[0, 0.88, 0.1]}>
        <mesh position={[0, -0.22, 0]} material={materials.trouser}>
          <cylinderGeometry args={[0.078, 0.064, 0.44, 12]} />
        </mesh>
        <group ref={rightShinRef} position={[0, -0.44, 0]}>
          <mesh position={[0, -0.21, 0]} material={materials.leather}>
            <cylinderGeometry args={[0.066, 0.052, 0.42, 12]} />
          </mesh>
          <mesh position={[0.04, -0.41, 0]} material={materials.leather}>
            <boxGeometry args={[0.21, 0.07, 0.1]} />
          </mesh>
        </group>
      </group>

      {/* Torso + Kepala + Lengan */}
      <group ref={torsoRef} position={[0, 0.88, 0]}>
        {/* Mantel / Baju */}
        <mesh
          position={[0, isLongCoat ? -0.32 : -0.1, 0]}
          geometry={isLongCoat ? coatGeo : sailorTorsoGeo}
          material={materials.coat}
        />

        {/* Sabuk kulit & gesper kuningan */}
        <mesh position={[0, 0.1, 0]} scale={[0.84, 1, 1.14]} material={materials.leather}>
          <cylinderGeometry args={[0.175, 0.175, 0.065, 18]} />
        </mesh>
        <mesh position={[0.15, 0.1, 0]} material={materials.brass}>
          <boxGeometry args={[0.02, 0.075, 0.09]} />
        </mesh>

        {/* Epaulet bahu khusus Kapten */}
        {role === "captain" && (
          <>
            <mesh position={[0, 0.56, -0.21]} material={materials.brass}>
              <boxGeometry args={[0.11, 0.035, 0.11]} />
            </mesh>
            <mesh position={[0, 0.56, 0.21]} material={materials.brass}>
              <boxGeometry args={[0.11, 0.035, 0.11]} />
            </mesh>
          </>
        )}

        {/* Leher & Kepala */}
        <group ref={headRef} position={[0, 0.62, 0]}>
          <mesh position={[0, 0.04, 0]} material={materials.skin}>
            <cylinderGeometry args={[0.058, 0.068, 0.11, 14]} />
          </mesh>
          {/* Kepala */}
          <mesh position={[0.01, 0.16, 0]} scale={[1.05, 1.15, 0.96]} material={materials.skin}>
            <sphereGeometry args={[0.105, 18, 18]} />
          </mesh>
          {/* Rambut / Janggut tipis */}
          <mesh position={[-0.02, 0.17, 0]} scale={[1.06, 1.1, 1.0]} material={materials.hair}>
            <sphereGeometry args={[0.104, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
          </mesh>

          {/* Topi */}
          {hatType === "tricorn" && (
            <group position={[0, 0.24, 0]}>
              {/* Crown topi */}
              <mesh material={materials.leather}>
                <cylinderGeometry args={[0.105, 0.115, 0.1, 16]} />
              </mesh>
              {/* Lipatan segitiga tricorn realistis */}
              <mesh position={[0.02, -0.02, 0]} rotation={[0, 0, -0.08]} scale={[1.25, 0.35, 1.35]} material={materials.leather}>
                <torusGeometry args={[0.14, 0.06, 10, 3]} />
              </mesh>
              {/* Pita tepi emas tipis */}
              <mesh position={[0.02, -0.01, 0]} scale={[1.26, 0.2, 1.36]} material={materials.brass}>
                <torusGeometry args={[0.145, 0.015, 8, 3]} />
              </mesh>
            </group>
          )}

          {hatType === "slouch" && (
            <group position={[0, 0.23, 0]} rotation={[0.08, 0, -0.06]}>
              <mesh material={materials.leather}>
                <cylinderGeometry args={[0.095, 0.11, 0.1, 16]} />
              </mesh>
              <mesh position={[0, -0.04, 0]} scale={[1.1, 0.15, 1.15]} material={materials.leather}>
                <cylinderGeometry args={[0.19, 0.19, 0.04, 18]} />
              </mesh>
            </group>
          )}

          {hatType === "bandana" && (
            <mesh position={[-0.01, 0.2, 0]} scale={[1.08, 0.85, 1.02]} material={materials.coat}>
              <sphereGeometry args={[0.108, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            </mesh>
          )}
        </group>

        {/* Lengan Kiri (Z negatif) */}
        <group ref={leftArmRef} position={[0, 0.52, -0.22]}>
          <mesh position={[0, -0.15, 0]} material={materials.coat}>
            <cylinderGeometry args={[0.062, 0.052, 0.32, 12]} />
          </mesh>
          <group ref={leftForearmRef} position={[0, -0.31, 0]}>
            <mesh position={[0, -0.14, 0]} material={materials.coat}>
              <cylinderGeometry args={[0.05, 0.042, 0.28, 12]} />
            </mesh>
            <mesh position={[0, -0.3, 0]} material={materials.skin}>
              <sphereGeometry args={[0.044, 12, 12]} />
            </mesh>
          </group>
        </group>

        {/* Lengan Kanan (Z positif) */}
        <group ref={rightArmRef} position={[0, 0.52, 0.22]}>
          <mesh position={[0, -0.15, 0]} material={materials.coat}>
            <cylinderGeometry args={[0.062, 0.052, 0.32, 12]} />
          </mesh>
          <group ref={rightForearmRef} position={[0, -0.31, 0]}>
            <mesh position={[0, -0.14, 0]} material={materials.coat}>
              <cylinderGeometry args={[0.05, 0.042, 0.28, 12]} />
            </mesh>
            <mesh position={[0, -0.3, 0]} material={materials.skin}>
              <sphereGeometry args={[0.044, 12, 12]} />
            </mesh>
            {/* Teropong kuningan untuk pengintai (lookout) */}
            {role === "lookout" && (
              <mesh position={[0.12, -0.32, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.brass}>
                <cylinderGeometry args={[0.018, 0.032, 0.34, 12]} />
              </mesh>
            )}
          </group>
        </group>
      </group>
    </group>
  );
}

// ── Rig First-Person POV Kapten (Roda Kemudi + Lengan & Tangan Realistis) ──

const _povUp = new THREE.Vector3(0, 1, 0);

function ArticulatedPovHandArm({
  side,
  gripRadius,
  wheelAngleRef,
  coatMat,
  cuffMat,
  brassMat,
  leatherMat,
  skinMat,
}: {
  side: "left" | "right";
  gripRadius: number;
  wheelAngleRef: React.MutableRefObject<number>;
  coatMat: THREE.Material;
  cuffMat: THREE.Material;
  brassMat: THREE.Material;
  leatherMat: THREE.Material;
  skinMat: THREE.Material;
}) {
  const s = side === "left" ? -1 : 1;
  const handRef = useRef<THREE.Group>(null);
  const sleeveRef = useRef<THREE.Group>(null);

  const elbowPos = useMemo(() => new THREE.Vector3(s * 0.36, -0.37, 0.72), [s]);
  const wristPos = useMemo(() => new THREE.Vector3(), []);
  const dirVec = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const wAng = wheelAngleRef.current;
    // Pegang roda di posisi arah jam 10:15 (kiri) dan 1:45 (kanan) sehingga kedua tangan selalu terlihat
    const baseAngle = 0.9;
    const theta = side === "left" ? Math.PI - baseAngle + wAng : baseAngle + wAng;

    const hx = Math.cos(theta) * gripRadius;
    const hy = Math.sin(theta) * gripRadius;

    if (handRef.current) {
      handRef.current.position.set(hx, hy, 0.012);
      handRef.current.rotation.set(0, 0, theta - Math.PI / 2);
    }

    if (sleeveRef.current) {
      // Pergelangan berada tepat di belakang punggung telapak tangan
      wristPos.set(hx + Math.cos(theta) * 0.008, hy + Math.sin(theta) * 0.008, 0.072);
      dirVec.copy(wristPos).sub(elbowPos);
      const dist = Math.max(0.2, dirVec.length());
      sleeveRef.current.position.copy(elbowPos).addScaledVector(dirVec, 0.5);
      dirVec.normalize();
      sleeveRef.current.quaternion.setFromUnitVectors(_povUp, dirVec);
      sleeveRef.current.scale.set(1, dist / 0.8, 1);
    }
  });

  return (
    <group>
      {/* Lengan Mantel Navy Kapten + Manset Linen + Garis Emas mengarah tepat dari bahu ke pergelangan */}
      <group ref={sleeveRef}>
        <mesh position={[0, -0.04, 0]} material={coatMat}>
          <cylinderGeometry args={[0.056, 0.082, 0.72, 16]} />
        </mesh>
        {/* Lipatan ujung manset mantel */}
        <mesh position={[0, 0.28, 0]} material={coatMat}>
          <cylinderGeometry args={[0.066, 0.063, 0.13, 16]} />
        </mesh>
        {/* Lis pita kuningan/emas kapten & dua kancing */}
        <mesh position={[0, 0.23, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
          <torusGeometry args={[0.064, 0.0055, 8, 20]} />
        </mesh>
        <mesh position={[s * -0.062, 0.29, 0.025]} material={brassMat}>
          <sphereGeometry args={[0.009, 10, 10]} />
        </mesh>
        <mesh position={[s * -0.062, 0.255, 0.025]} material={brassMat}>
          <sphereGeometry args={[0.009, 10, 10]} />
        </mesh>
        {/* Manset kemeja putih gading */}
        <mesh position={[0, 0.365, 0]} material={cuffMat}>
          <cylinderGeometry args={[0.047, 0.052, 0.065, 16]} />
        </mesh>
      </group>

      {/* Telapak Tangan & Jari Anatomis Menggenggam Lingkar Kayu */}
      <group ref={handRef}>
        {/* Tali pergelangan kulit pelaut */}
        <mesh position={[0, 0.004, 0.058]} rotation={[Math.PI / 2, 0, 0]} material={leatherMat}>
          <cylinderGeometry args={[0.038, 0.042, 0.032, 14]} />
        </mesh>
        {/* Punggung telapak tangan proporsional */}
        <mesh
          position={[0, 0.012, 0.026]}
          rotation={[-0.3, 0, 0]}
          material={skinMat}
        >
          <boxGeometry args={[0.068, 0.032, 0.066]} />
        </mesh>
        {/* Tulang buku jari (knuckles) di bagian depan punggung tangan */}
        <mesh position={[0, 0.026, -0.004]} rotation={[0, 0, Math.PI / 2]} material={skinMat}>
          <cylinderGeometry args={[0.014, 0.014, 0.066, 12]} />
        </mesh>
        {/* 4 Jari melingkari sisi depan-atas batang kayu kemudi */}
        {[-0.024, -0.008, 0.008, 0.024].map((fx, idx) => (
          <group key={idx} position={[fx, 0.026, -0.008]} rotation={[0.92, 0, 0]}>
            <mesh position={[0, 0.02, 0]} material={skinMat}>
              <cylinderGeometry args={[0.0085, 0.0095, 0.042, 10]} />
            </mesh>
            <mesh position={[0, 0.038, 0.018]} rotation={[1.08, 0, 0]} material={skinMat}>
              <cylinderGeometry args={[0.0072, 0.0082, 0.038, 10]} />
            </mesh>
          </group>
        ))}
        {/* Ibu jari menahan lingkar kemudi dari sisi dalam */}
        <group
          position={[s * -0.038, -0.006, 0.026]}
          rotation={[0.25, s * -0.45, s * -0.65]}
        >
          <mesh position={[0, 0.024, 0]} material={skinMat}>
            <cylinderGeometry args={[0.0105, 0.0125, 0.048, 10]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * Ditampilkan di bagian bawah kamera saat mode First-Person POV Kapten aktif.
 * Kamera berada di sekitar [-6.60, 7.78, 0] menghadap +X.
 */
export function CaptainPovHelmRig({
  wheelAngleRef,
}: {
  wheelAngleRef: React.MutableRefObject<number>;
}) {
  const wheelRef = useRef<THREE.Group>(null);
  const fabricBump = useMemo(() => getFabricBumpTexture(), []);

  const { coatMat, cuffMat, brassMat, leatherMat, skinMat } = useMemo(() => {
    return {
      coatMat: new THREE.MeshStandardMaterial({
        color: "#131c29",
        bumpMap: fabricBump,
        bumpScale: 0.008,
        roughness: 0.72,
        metalness: 0.06,
      }),
      cuffMat: new THREE.MeshStandardMaterial({
        color: "#cfc5b4",
        roughness: 0.78,
      }),
      brassMat: new THREE.MeshStandardMaterial({
        color: "#d4a24c",
        roughness: 0.28,
        metalness: 0.86,
      }),
      leatherMat: new THREE.MeshStandardMaterial({
        color: "#2a1b12",
        roughness: 0.55,
        metalness: 0.08,
      }),
      skinMat: new THREE.MeshStandardMaterial({
        color: "#9e6b4c",
        roughness: 0.62,
        metalness: 0.02,
      }),
    };
  }, [fabricBump]);

  useFrame(() => {
    if (wheelRef.current) {
      wheelRef.current.rotation.z = wheelAngleRef.current;
    }
  });

  const gripRadius = 0.38;

  return (
    <group position={[-5.92, 7.02, 0]} rotation={[0, -Math.PI / 2, 0]}>
      {/* Cahaya senja lembut menerangi kedua lengan mantel & lingkar kayu kemudi POV */}
      <pointLight position={[0, 0.52, 0.62]} color="#ffd59e" intensity={1.7} distance={3.5} />

      <group ref={wheelRef}>
        <ShipWheelRing radius={gripRadius} spokes={10} handleLength={0.1} />
      </group>

      {/* Kedua Lengan & Tangan Kiri-Kanan Kapten menggenggam roda kemudi */}
      <ArticulatedPovHandArm
        side="left"
        gripRadius={gripRadius}
        wheelAngleRef={wheelAngleRef}
        coatMat={coatMat}
        cuffMat={cuffMat}
        brassMat={brassMat}
        leatherMat={leatherMat}
        skinMat={skinMat}
      />
      <ArticulatedPovHandArm
        side="right"
        gripRadius={gripRadius}
        wheelAngleRef={wheelAngleRef}
        coatMat={coatMat}
        cuffMat={cuffMat}
        brassMat={brassMat}
        leatherMat={leatherMat}
        skinMat={skinMat}
      />
    </group>
  );
}

// ── Kru & Kapten Lengkap di Dek Kapal ──────────────────────────

export function ShipDeckCrew({
  inPov = false,
  wheelAngleRef,
}: {
  inPov?: boolean;
  wheelAngleRef: React.MutableRefObject<number>;
}) {
  return (
    <group>
      {/* 1. Stand Roda Kemudi & Kompas di Quarterdeck (x = -6.0, y = 6.08) */}
      <group position={[-6.0, 6.08, 0]}>
        <ShipHelmStand wheelAngleRef={wheelAngleRef} hideWheel={inPov} />
      </group>

      {/* 2. Kapten di belakang Roda Kemudi (x = -6.58, y = 6.08) — berganti ke Tangan POV saat inPov */}
      {!inPov ? (
        <group position={[-6.58, 6.08, 0]} scale={1.14}>
          <pointLight position={[-0.35, 1.45, 0.9]} color="#ffcf88" intensity={2.2} distance={5.0} />
          <RealisticHumanFigure
            role="captain"
            coatColor="#131c29"
            trouserColor="#171412"
            hatType="tricorn"
            wheelAngleRef={wheelAngleRef}
          />
        </group>
      ) : (
        <CaptainPovHelmRig wheelAngleRef={wheelAngleRef} />
      )}

      {/* 3. Mualim / Perwira Navigasi di Lower Quarterdeck (x = -3.1, y = 5.06) */}
      <group position={[-3.1, 5.06, -1.25]} scale={1.08}>
        <RealisticHumanFigure
          role="officer"
          coatColor="#1f2836"
          trouserColor="#1c1815"
          hatType="tricorn"
          phase={1.1}
        />
      </group>

      {/* 4. Awak Kapal Penarik Tali Layar Kiri (x = 1.6, y = 2.95, z = -1.65) */}
      <group position={[1.6, 2.95, -1.65]} rotation={[0, -0.35, 0]} scale={1.08}>
        <RealisticHumanFigure
          role="haul"
          coatColor="#2e231b"
          trouserColor="#1d1916"
          hatType="bandana"
          phase={0.4}
        />
      </group>

      {/* 5. Awak Kapal Patroli Berjalan di Dek Utama (x = 3.6, y = 3.05, z = 0.85) */}
      <group position={[3.6, 3.05, 0.85]} scale={1.08}>
        <RealisticHumanFigure
          role="walk"
          coatColor="#252c35"
          trouserColor="#1a1714"
          hatType="slouch"
          walkRange={3.4}
          phase={2.0}
        />
      </group>

      {/* 6. Awak Kapal Penarik Tali Layar Kanan (x = 5.2, y = 3.38, z = 1.6) */}
      <group position={[5.2, 3.38, 1.6]} rotation={[0, 0.4, 0]} scale={1.08}>
        <RealisticHumanFigure
          role="haul"
          coatColor="#33271e"
          trouserColor="#181512"
          hatType="slouch"
          phase={3.2}
        />
      </group>

      {/* 7. Awak Pengintai (Lookout) dengan Teropong di Forecastle Haluan (x = 9.4, y = 4.95) */}
      <group position={[9.4, 4.95, -0.75]} scale={1.1}>
        <RealisticHumanFigure
          role="lookout"
          coatColor="#1d242e"
          trouserColor="#171411"
          hatType="bandana"
          phase={1.7}
        />
      </group>
    </group>
  );
}
