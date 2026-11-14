"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  GalleonShip,
  SunsetFog,
  SunsetLights,
  SunsetOcean,
  SunsetSky,
  getSunDirection,
} from "./SunsetOcean";

/** Pose kamera awal login (dipakai juga sebagai titik awal transisi ke dashboard) */
export const LOGIN_CAMERA = {
  position: new THREE.Vector3(0, 4.2, 0),
  lookAt: new THREE.Vector3(0, 12.6, -100),
};

export const LOGIN_SHIP = {
  desktop: { position: [-17, 0, -80] as [number, number, number], heading: -2.5 },
  mobile: { position: [-2, 0, -112] as [number, number, number], heading: -2.35 },
};

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
    // Kamera seperti mengapung di perahu kecil: naik-turun sangat halus + parallax kursor
    const tx = LOGIN_CAMERA.position.x + (isMobile ? 0 : mouse.current.x * 1.6);
    const ty = LOGIN_CAMERA.position.y + Math.sin(t * 0.55) * 0.18 - (isMobile ? 0 : mouse.current.y * 0.5);
    camera.position.x += (tx - camera.position.x) * 0.025;
    camera.position.y += (ty - camera.position.y) * 0.04;
    camera.position.z = LOGIN_CAMERA.position.z;
    look.copy(LOGIN_CAMERA.lookAt);
    look.x += isMobile ? 0 : mouse.current.x * 3;
    look.y += Math.sin(t * 0.4) * 0.25;
    camera.lookAt(look);
  });

  const ship = isMobile ? LOGIN_SHIP.mobile : LOGIN_SHIP.desktop;

  return (
    <>
      <SunsetFog />
      <SunsetLights sun={sun} />
      <SunsetSky sun={sun} />
      <SunsetOcean sun={sun} quality={isMobile ? "low" : "high"} />
      <GalleonShip
        quality={isMobile ? "low" : "high"}
        position={ship.position}
        heading={ship.heading}
        speed={0.35}
      />
    </>
  );
}

export function SunsetLoginBackground() {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none bg-gradient-to-b from-[#1b1530] via-[#7a3b3a] to-[#e08a4f]">
      {mounted && (
        <Canvas
          camera={{
            position: LOGIN_CAMERA.position.toArray() as [number, number, number],
            fov: isMobile ? 62 : 45,
            near: 0.5,
            far: 20000,
          }}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.42;
          }}
        >
          <Suspense fallback={null}>
            <LoginScene isMobile={isMobile} onReady={() => setReady(true)} />
          </Suspense>
        </Canvas>
      )}

      {/* Tirai senja: memudar mulus setelah scene 3D siap */}
      <div
        className={`absolute inset-0 bg-gradient-to-b from-[#1b1530] via-[#5a2c3a] to-[#c9774a] transition-opacity duration-[1600ms] ease-out ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Vignette sinematik + gradasi bawah untuk keterbacaan teks */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_45%,rgba(10,6,20,0.55)_100%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0b0814]/75 to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-[#0b0814]/45 to-transparent" />
    </div>
  );
}
