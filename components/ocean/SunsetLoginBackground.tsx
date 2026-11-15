"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
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

function LoginScene({ isMobile, onReady }: { isMobile: boolean; onReady: () => void }) {
  const sun = useMemo(() => getSunDirection(), []);
  const mouse = useRef({ x: 0, y: 0 });
  const look = useMemo(() => new THREE.Vector3(), []);
  const readyFired = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(({ camera, clock }) => {
    if (!readyFired.current) {
      readyFired.current = true;
      onReady();
    }
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
      <SunsetLights sun={sun} />
      <SunsetSky sun={sun} />
      <SunsetOcean sun={sun} quality={isMobile ? "low" : "high"} />
      {/* Kapal & awak dimuat bertahap di Suspense terpisah agar langit & samudra senja langsung muncul tanpa menunggu aset 3D */}
      <Suspense fallback={null}>
        <GalleonShip
          quality={isMobile ? "low" : "high"}
          position={ship.position}
          heading={ship.heading}
          speed={0}
          inPov={false}
          progressive
        />
      </Suspense>
    </>
  );
}

export function SunsetLoginBackground() {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    // Mulai preload model kapal aktif & awak secara paralel sejak awal agar tidak antre beruntun
    useLoader.preload(GLTFLoader, mobile ? SHIP_URL_LOW : SHIP_URL_HIGH, (loader) => {
      (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
    });
    preloadHumanModels();

    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none bg-[#120d1d]">
      {mounted && (
        <Canvas
          camera={{
            position: LOGIN_CAMERA.position.toArray() as [number, number, number],
            fov: isMobile ? 58 : 44,
            near: 0.25,
            far: 20000,
          }}
          dpr={isMobile ? [1, 1.25] : [1, 1.5]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.46;
            gl.debug.checkShaderErrors = false;
          }}
        >
          <color attach="background" args={["#181124"]} />
          <LoginScene isMobile={isMobile} onReady={() => setReady(true)} />
        </Canvas>
      )}

      {/* Transisi singkat hanya sampai frame WebGL pertama (langit & laut) selesai digambar */}
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
