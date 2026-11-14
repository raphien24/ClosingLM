"use client";

/**
 * Figur awak kapal, kapten, roda kemudi kayu, dan tangan POV kapten berbasis
 * model manusia realistis 3D (`SkinnedMesh` tekstur kulit, wajah, rambut, dan pakaian asli)
 * disertai roda kemudi kayu mahoni dan aksesoris navigasi klasik di bawah cahaya PBR senja.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RiggedCaptainPovArms, RiggedHumanFigure } from "./RiggedHumanCrew";

// ── Tekstur Kayu Prosedural untuk Kemudi (Dibuat sekali di klien) ──

let _woodTex: THREE.CanvasTexture | null = null;

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
          <mesh position={[0, radius * 0.5, 0]} material={woodMat}>
            <cylinderGeometry args={[0.016, 0.022, radius * 0.96, 10]} />
          </mesh>
          <mesh position={[0, radius * 0.45, 0]} material={brassMat}>
            <torusGeometry args={[0.021, 0.006, 8, 14]} />
          </mesh>
          <mesh position={[0, radius + handleLength * 0.55, 0]} material={darkWoodMat}>
            <cylinderGeometry args={[0.017, 0.013, handleLength, 12]} />
          </mesh>
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

// ── Roda Kemudi & Tangan Manusia Realistis POV Kapten ───────────

export function CaptainPovHelmRig({
  wheelAngleRef,
}: {
  wheelAngleRef: React.MutableRefObject<number>;
}) {
  const wheelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (wheelRef.current) {
      wheelRef.current.rotation.z = wheelAngleRef.current;
    }
  });

  const gripRadius = 0.36;

  return (
    <group>
      {/* Roda kemudi mahoni POV di depan kamera Kapten */}
      <group position={[-5.92, 7.14, 0]} rotation={[0, -Math.PI / 2, 0]}>
        {/* Cahaya senja lembut dari arah depan-atas menerangi kulit tangan & lingkar kayu kemudi POV */}
        <pointLight position={[0, 0.72, 0.55]} color="#ffd59e" intensity={1.05} distance={4.5} />
        <group ref={wheelRef}>
          <ShipWheelRing radius={gripRadius} spokes={10} handleLength={0.1} />
        </group>
      </group>

      {/* Lengan & tangan manusia 3D nyata Kapten menggenggam lingkar roda kemudi (tanpa badan/torso) */}
      <RiggedCaptainPovArms wheelAngleRef={wheelAngleRef} gripRadius={gripRadius} />
    </group>
  );
}

// ── Kru & Kapten Manusia Realistis Lengkap di Dek Kapal ─────────

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
        <group position={[-6.58, 6.08, 0]} scale={1.06}>
          <pointLight position={[-0.35, 1.55, 0.95]} color="#ffcf88" intensity={2.4} distance={5.5} />
          <RiggedHumanFigure role="captain" variant="captain" wheelAngleRef={wheelAngleRef} />
        </group>
      ) : (
        <CaptainPovHelmRig wheelAngleRef={wheelAngleRef} />
      )}

      {/* 3. Mualim / Perwira Navigasi di Lower Quarterdeck (x = -3.1, y = 5.06) */}
      <group position={[-3.1, 5.06, -1.25]} scale={1.02}>
        <pointLight position={[0.25, 1.5, 0.85]} color="#ffd499" intensity={1.4} distance={4.2} />
        <RiggedHumanFigure role="officer" variant="sailor1" phaseOffset={1.1} />
      </group>

      {/* 4. Awak Kapal Penarik Tali Layar Kiri (x = 1.6, y = 2.95, z = -1.65) */}
      <group position={[1.6, 2.95, -1.65]} rotation={[0, -0.35, 0]} scale={1.0}>
        <RiggedHumanFigure role="haul" variant="sailor2" phaseOffset={0.4} showRope />
      </group>

      {/* 5. Awak Kapal Patroli Berjalan di Dek Utama (x = 3.6, y = 3.05, z = 0.85) */}
      <group position={[3.6, 3.05, 0.85]} scale={1.0}>
        <RiggedHumanFigure role="walk" variant="sailor3" walkRange={3.4} phaseOffset={2.0} />
      </group>

      {/* 6. Awak Kapal Penarik Tali Layar Kanan (x = 5.2, y = 3.38, z = 1.6) */}
      <group position={[5.2, 3.38, 1.6]} rotation={[0, 0.4, 0]} scale={1.0}>
        <RiggedHumanFigure role="haul" variant="sailor1" phaseOffset={3.2} showRope />
      </group>

      {/* 7. Awak Pengintai (Lookout) dengan Teropong di Forecastle Haluan (x = 9.4, y = 4.95) */}
      <group position={[9.4, 4.95, -0.75]} scale={1.02}>
        <RiggedHumanFigure role="lookout" variant="sailor2" phaseOffset={1.7} />
      </group>
    </group>
  );
}
