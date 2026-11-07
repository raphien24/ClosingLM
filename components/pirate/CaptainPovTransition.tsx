"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  Ocean,
  SkyDome,
  Stars,
  PirateShip,
  Seagull,
} from "./PirateModels";
import { Compass, FastForward, Sparkles } from "lucide-react";

const DURATION_SEC = 3.8;

function CaptainPovScene({
  flowRef,
  onProgress,
}: {
  flowRef: React.MutableRefObject<number>;
  onProgress: (p: number) => void;
}) {
  const wheelRef = useRef<THREE.Group>(null);
  const shipRef = useRef<THREE.Group>(null);
  const speedRef = useRef(1.5);
  const elapsedRef = useRef(0);
  const { size } = useThree();

  useFrame(({ clock, camera }, delta) => {
    elapsedRef.current += delta;
    const progress = Math.min(1, elapsedRef.current / DURATION_SEC);
    onProgress(progress);

    // Kecepatan kapal meningkat (akselerasi berlayar)
    speedRef.current = THREE.MathUtils.lerp(1.5, 14.0, Math.pow(progress, 1.4));
    flowRef.current += delta * speedRef.current;

    const t = clock.elapsedTime;

    // Roda kemudi berputar dikendalikan kapten
    if (wheelRef.current) {
      wheelRef.current.rotation.x = Math.sin(t * 2.2) * 0.45 + Math.sin(t * 1.1) * 0.2;
    }

    // Gerak kapal memecah ombak
    if (shipRef.current) {
      shipRef.current.position.y =
        Math.sin(t * 2.8) * 0.18 + Math.cos(t * 1.6) * 0.08;
      shipRef.current.rotation.z = Math.sin(t * 2.2) * 0.035; // roll
      shipRef.current.rotation.x =
        Math.sin(t * 2.6) * 0.04 - Math.min(0.08, progress * 0.06); // pitch haluan sedikit terangkat
    }

    // Kamera POV orang pertama (posisi mata kapten di anjungan buritan)
    // Disesuaikan secara dinamis agar pas sempurna di HP (portrait) maupun laptop/tablet (landscape)
    const aspect = size.width / Math.max(1, size.height);
    const isPortrait = aspect < 1.0;

    const bobbingY = Math.sin(t * 2.8) * 0.06;
    const swayZ = Math.sin(t * 2.2) * 0.04;

    // Posisi kamera: mundur lebih jauh pada layar HP portrait agar kemudi dan tangan masuk frame sempurna
    const baseCamX = isPortrait ? -3.45 : -2.65;
    const baseCamY = isPortrait ? 2.82 : 2.52;
    const lookTargetY = isPortrait ? 2.15 : 2.25;

    // FOV responsif: pada HP portrait FOV vertikal dinaikkan agar sudut horizontal tidak terpotong
    const baseFov = isPortrait
      ? Math.min(84, Math.max(68, (52 / aspect) * 0.72))
      : 50;
    const fovTarget = baseFov + progress * (isPortrait ? 8 : 12);

    camera.position.set(baseCamX, baseCamY + bobbingY, swayZ);
    camera.lookAt(14, lookTargetY + bobbingY * 0.4, swayZ * 0.25);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fovTarget;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  });

  return (
    <>
      <ambientLight color="#1e293b" intensity={1.1} />
      <directionalLight position={[20, 15, 10]} color="#fde68a" intensity={2.2} />
      <directionalLight position={[-10, 5, -15]} color="#60a5fa" intensity={0.6} />

      {/* Cahaya lentera di dekat kemudi */}
      <pointLight position={[-1.8, 2.4, 0.4]} color="#ffedd5" intensity={2.5} distance={5} />

      <SkyDome top="#030b20" horizon="#1e3a8a" />
      <Stars count={600} />

      {/* Burung camar beterbangan di depan kapal */}
      <Seagull radius={7} height={6} speed={0.6} phase={0.5} />
      <Seagull radius={10} height={7.5} speed={0.45} phase={2.8} />

      {/* Kapal bajak laut dengan tangan kapten di kemudi */}
      <group ref={shipRef} position={[0, 0, 0]}>
        <PirateShip
          showCrew={true}
          crewCount={4}
          wheelRef={wheelRef}
          withHands={true}
          showCaptain={false} // Kapten adalah user sendiri (POV)
          sailLabel="JTT08"
        />
      </group>

      {/* Lautan berarus deras yang bergerak ke belakang */}
      <Ocean
        segments={110}
        size={260}
        deep="#03122c"
        shallow="#0c3b73"
        foam="#e0f2fe"
        fogColor="#0f2b5c"
        fogNear={15}
        fogFar={130}
        flowRef={flowRef}
      />
    </>
  );
}

export function CaptainPovTransition({
  userName,
  onComplete,
}: {
  userName?: string | null;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [fadeWhite, setFadeWhite] = useState(false);
  const flowRef = useRef(0);
  const completedRef = useRef(false);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setFadeWhite(true);
    setTimeout(() => {
      onComplete();
    }, 450);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      finish();
    }, DURATION_SEC * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 w-screen h-screen h-[100dvh] z-[100000] overflow-hidden select-none transition-opacity duration-500 ${
        fadeWhite ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* 3D Canvas */}
      <Canvas
        className="w-full h-full block"
        camera={{
          position: [-2.85, 2.65, 0],
          fov: 54,
          near: 0.1,
          far: 500,
        }}
        dpr={typeof window !== "undefined" && window.innerWidth < 768 ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <CaptainPovScene flowRef={flowRef} onProgress={setProgress} />
      </Canvas>

      {/* Vignette & Cinematic Overlay */}
      <div className="absolute inset-0 bg-radial-[circle_at_50%_45%]_from-transparent_via-slate-950/20_to-slate-950/80 pointer-events-none" />

      {/* Speed lines / Motion mist effect saat kecepatan tinggi */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-blue-500/10 pointer-events-none transition-opacity duration-700"
        style={{ opacity: Math.max(0, (progress - 0.3) * 1.5) }}
      />

      {/* Top Bar: Skip Button */}
      <div className="absolute top-4 sm:top-5 right-4 sm:right-5 z-20">
        <button
          onClick={finish}
          className="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-amber-400/50 hover:border-amber-400 text-amber-300 hover:text-white text-xs font-bold shadow-xl backdrop-blur-md transition-all cursor-pointer group hover:scale-105 active:scale-95"
        >
          <span>Lewati</span>
          <FastForward className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Center Cinematic Welcome Card (Responsive & Compact on Mobile) */}
      <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 w-[92%] sm:w-[85%] max-w-lg z-20 pointer-events-none">
        <div className="bg-slate-950/85 backdrop-blur-md rounded-2xl border border-amber-400/40 p-3 sm:p-4 shadow-2xl text-center text-white">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest mb-1.5">
            <Compass className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" style={{ animationDuration: "8s" }} />
            <span>KAPAL SIAP BERLAYAR · POV KAPTEEN</span>
          </div>

          <h2 className="text-base sm:text-xl font-extrabold text-white tracking-tight flex items-center justify-center gap-1.5">
            <span>Selamat Datang, Kapten {userName ? userName.split(" ")[0] : "JTT08"}!</span>
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
          </h2>

          <p className="text-[11px] sm:text-xs text-blue-200/90 mt-0.5">
            Mengarungi operasional Last Mile Closing &amp; Fleet Productivity...
          </p>

          {/* Progress Bar */}
          <div className="mt-2.5 sm:mt-3 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-blue-400 to-emerald-400 rounded-full transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(251,191,36,0.6)]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Final Flash into Dashboard */}
      <div
        className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-500"
        style={{
          opacity: progress > 0.88 ? Math.min(1, (progress - 0.88) * 8.3) : 0,
        }}
      />
    </div>
  );
}
