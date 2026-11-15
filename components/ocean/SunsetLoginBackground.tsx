"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  GalleonShip,
  SHIP_URL_HIGH,
  SHIP_URL_LOW,
  SunsetFog,
  SunsetLights,
  SunsetOcean,
  SunsetSky,
  getSunDirection,
} from "./SunsetOcean";
import { preloadHumanModels } from "./RiggedHumanCrew";
import { isLowSpecActive, subscribePerformanceMode } from "@/lib/hardwareDetection";

/** Pose kamera awal login (dipakai juga sebagai titik awal transisi zoom ke kapten) */
export const LOGIN_CAMERA = {
  position: new THREE.Vector3(3.2, 7.6, 26.5),
  lookAt: new THREE.Vector3(1.5, 5.4, 0),
};

export const LOGIN_SHIP = {
  desktop: { position: [0, 0, 0] as [number, number, number], heading: 0 },
  mobile: { position: [0, 0, 0] as [number, number, number], heading: 0 },
};

export const ISLAND_POSITION: [number, number, number] = [310, 0, -24];

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

function LoginScene({ isMobile, onReady }: { isMobile: boolean; onReady: () => void }) {
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
    const baseX = isMobile ? 1.5 : LOGIN_CAMERA.position.x;
    const baseY = isMobile ? 6.5 : LOGIN_CAMERA.position.y;
    const baseZ = isMobile ? 33.0 : LOGIN_CAMERA.position.z;

    const tx = baseX + (isMobile ? 0 : mouse.current.x * 1.4);
    const ty = baseY + Math.sin(t * 0.6) * 0.16 - (isMobile ? 0 : mouse.current.y * 0.45);
    camera.position.x += (tx - camera.position.x) * 0.03;
    camera.position.y += (ty - camera.position.y) * 0.04;
    camera.position.z += (baseZ - camera.position.z) * 0.04;

    look.set(
      (isMobile ? 0.5 : LOGIN_CAMERA.lookAt.x) + (isMobile ? 0 : mouse.current.x * 1.8),
      LOGIN_CAMERA.lookAt.y + Math.sin(t * 0.45) * 0.15,
      LOGIN_CAMERA.lookAt.z
    );
    camera.lookAt(look);
  });

  const ship = isMobile ? LOGIN_SHIP.mobile : LOGIN_SHIP.desktop;

  return (
    <>
      <SunsetFog />
      <SunsetLights sun={sun} deckLightPosition={[-5.65, 7.53, 0.15]} />
      <SunsetSky sun={sun} />
      <SunsetOcean sun={sun} quality={isMobile ? "low" : "high"} />
      {/* Tampilkan kapal & kru bersama laut dalam 1 frame tanpa kedipan / pop-in */}
      <Suspense fallback={null}>
        <GalleonShip
          quality={isMobile ? "low" : "high"}
          position={ship.position}
          heading={ship.heading}
          speed={0}
          inPov={false}
          progressive
          mobileCompact={isMobile}
          hasExternalDeckLight
          onShipReady={onReady}
        />
      </Suspense>
    </>
  );
}

export function SunsetLoginBackground() {
  const [mounted, setMounted] = useState(false);
  const [isLowSpec, setIsLowSpec] = useState(false);
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    setMounted(true);
    const low = isLowSpecActive();
    setIsLowSpec(low);

    const unsub = subscribePerformanceMode((mode) => {
      setIsLowSpec(mode === "light");
    });

    // Mulai preload model kapal aktif & awak secara paralel sejak awal agar tidak antre beruntun
    useLoader.preload(GLTFLoader, low ? SHIP_URL_LOW : SHIP_URL_HIGH, (loader) => {
      (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
    });
    preloadHumanModels(low);

    // Fallback aman bila jaringan sangat lambat agar layar tidak tertahan
    const fallbackTimer = window.setTimeout(() => setReady(true), 2500);
    const check = () => setIsLowSpec(isLowSpecActive());
    window.addEventListener("resize", check);
    return () => {
      unsub();
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none bg-[#120d1d]">
      {mounted && (
        <Canvas
          frameloop={isLowSpec ? "demand" : "always"}
          camera={{
            position: LOGIN_CAMERA.position.toArray() as [number, number, number],
            fov: isLowSpec ? 56 : 44,
            near: 0.28,
            far: 16000,
          }}
          dpr={isLowSpec ? 1 : [1, 1.25]}
          gl={{
            antialias: !isLowSpec,
            alpha: false,
            powerPreference: isLowSpec ? "default" : "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.46;
            gl.debug.checkShaderErrors = false;
          }}
        >
          <color attach="background" args={["#181124"]} />
          <MobileFramerateDriver active={isLowSpec} />
          <LoginScene isMobile={isLowSpec} onReady={handleReady} />
        </Canvas>
      )}

      {/* Selubung gelap senja singkat hingga langit, laut, dan kapal siap tergambar bersama */}
      <div
        className={`absolute inset-0 bg-gradient-to-b from-[#151025] via-[#261831] to-[#1a1326] transition-opacity duration-300 ease-out ${
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
