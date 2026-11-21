"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  GalleonShip,
  SHIP_URL_HIGH,
  SunsetFog,
  SunsetLights,
  SunsetOcean,
  SunsetSky,
  getSunDirection,
} from "./SunsetOcean";
import { preloadHumanModels } from "./RiggedHumanCrew";
import { TropicalIsland } from "./TropicalIsland";
import { detectHardwareSpecs } from "@/lib/hardwareDetection";

/** Pose kamera awal login (dipakai juga sebagai titik awal transisi zoom ke kapten) */
export const LOGIN_CAMERA = {
  position: new THREE.Vector3(-1.4, 7.35, 22.2),
  lookAt: new THREE.Vector3(2.2, 5.3, -1.0),
};

export const LOGIN_SHIP = {
  desktop: { position: [0, 0, 0] as [number, number, number], heading: 0 },
  mobile: { position: [0, 0, 0] as [number, number, number], heading: 0 },
};

export const ISLAND_POSITION: [number, number, number] = [310, 0, -24];
/** Posisi pulau di cakrawala halaman login agar tulisan 3D LAST MILE, mercusuar & dermaga menghadap tepat ke kamera */
export const LOGIN_HORIZON_ISLAND_POS: [number, number, number] = [56, -0.4, -215];
export const LOGIN_HORIZON_ISLAND_ROT: [number, number, number] = [0, 1.32, 0];

function MobileFramerateDriver({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!active) return;
    invalidate();
    const id = window.setInterval(() => {
      if (!document.hidden) invalidate();
    }, 38);
    return () => window.clearInterval(id);
  }, [active, invalidate]);

  return null;
}

function LoginScene({
  isLowSpecDevice,
  isCompactViewport,
  onReady,
}: {
  isLowSpecDevice: boolean;
  isCompactViewport: boolean;
  onReady: () => void;
}) {
  const sun = useMemo(() => getSunDirection(), []);
  const mouse = useRef({ x: 0, y: 0 });
  const look = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    const baseX = isCompactViewport ? 0.4 : LOGIN_CAMERA.position.x;
    const baseY = isCompactViewport ? 6.9 : LOGIN_CAMERA.position.y;
    const baseZ = isCompactViewport ? 27.5 : LOGIN_CAMERA.position.z;

    const tx = baseX + (isCompactViewport ? 0 : mouse.current.x * 1.4);
    const ty = baseY + Math.sin(t * 0.6) * 0.16 - (isCompactViewport ? 0 : mouse.current.y * 0.45);
    camera.position.x += (tx - camera.position.x) * 0.03;
    camera.position.y += (ty - camera.position.y) * 0.04;
    camera.position.z += (baseZ - camera.position.z) * 0.04;

    look.set(
      (isCompactViewport ? 0.8 : LOGIN_CAMERA.lookAt.x) + (isCompactViewport ? 0 : mouse.current.x * 1.8),
      LOGIN_CAMERA.lookAt.y + Math.sin(t * 0.45) * 0.15,
      LOGIN_CAMERA.lookAt.z
    );
    camera.lookAt(look);
  });

  const ship = LOGIN_SHIP.desktop;

  return (
    <>
      <SunsetFog density={0.00014} />
      <SunsetLights sun={sun} deckLightPosition={[-5.75, 7.62, 0.75]} />
      <SunsetSky sun={sun} />
      <SunsetOcean sun={sun} quality={isLowSpecDevice ? "low" : "high"} />
      {/* Pulau Tropis dengan tulisan 3D "LAST MILE", mercusuar, dermaga & air terjun di cakrawala */}
      <TropicalIsland
        position={LOGIN_HORIZON_ISLAND_POS}
        rotation={LOGIN_HORIZON_ISLAND_ROT}
        isLowSpec={isLowSpecDevice}
      />
      {/* Tampilkan kapal & seluruh kru manusia kualitas tinggi bersama laut dalam 1 mode */}
      <Suspense fallback={null}>
        <GalleonShip
          quality="high"
          position={ship.position}
          heading={ship.heading}
          speed={0}
          inPov={false}
          progressive
          mobileCompact={false}
          hasExternalDeckLight
          onShipReady={onReady}
        />
      </Suspense>
    </>
  );
}

export function SunsetLoginBackground({ onReady }: { onReady?: () => void } = {}) {
  const [mounted, setMounted] = useState(false);
  const [isLowSpecDevice, setIsLowSpecDevice] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [ready, setReady] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const handleReady = useCallback(() => {
    setReady(true);
    onReadyRef.current?.();
  }, []);

  useEffect(() => {
    setMounted(true);
    const specs = detectHardwareSpecs();
    setIsLowSpecDevice(specs.isLowSpec);
    setIsCompactViewport(window.innerWidth < 768);

    // Preload model kapal & seluruh awak manusia kualitas tinggi secara paralel
    useLoader.preload(GLTFLoader, SHIP_URL_HIGH, (loader) => {
      (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
    });
    preloadHumanModels(false);

    const fallbackTimer = window.setTimeout(handleReady, 10000);
    const onResize = () => setIsCompactViewport(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("resize", onResize);
    };
  }, [handleReady]);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none bg-[#0b1120]">
      {mounted && (
        <Canvas
          frameloop="always"
          camera={{
            position: LOGIN_CAMERA.position.toArray() as [number, number, number],
            fov: isCompactViewport ? 52 : 44,
            near: 0.28,
            far: 16000,
          }}
          dpr={isLowSpecDevice ? 1 : [1, 1.25]}
          gl={{
            antialias: !isLowSpecDevice,
            alpha: false,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.58;
            gl.debug.checkShaderErrors = false;
          }}
        >
          <color attach="background" args={["#0b1120"]} />
          <MobileFramerateDriver active={false} />
          <LoginScene
            isLowSpecDevice={isLowSpecDevice}
            isCompactViewport={isCompactViewport}
            onReady={handleReady}
          />
        </Canvas>
      )}

      {/* Tirai gelap netral (disembunyikan di background tanpa warna oranye) hingga seluruh scene 3D & kapal siap */}
      <div
        className={`absolute inset-0 bg-[#0b1120] transition-opacity duration-500 ease-out ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Vignette sinematik + gradasi bawah untuk keterbacaan teks */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_48%,rgba(10,6,20,0.52)_100%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-[#0b0814]/75 to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0b0814]/45 to-transparent" />
    </div>
  );
}
