"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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

const DURATION_SEC = 4.2;
const ZOOM_DURATION = 1.35; // Durasi fase zoom in ke arah kapten (detik)

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
  const [inPov, setInPov] = useState(false);

  useFrame(({ clock, camera }, delta) => {
    elapsedRef.current += delta;
    const progress = Math.min(1, elapsedRef.current / DURATION_SEC);
    onProgress(progress);

    // Zoom in progress: 0 -> 1 selama ZOOM_DURATION detik
    const zoomProgress = Math.min(1, elapsedRef.current / ZOOM_DURATION);
    // Smooth cubic ease-in-out
    const easeZoom =
      zoomProgress < 0.5
        ? 4 * zoomProgress * zoomProgress * zoomProgress
        : 1 - Math.pow(-2 * zoomProgress + 2, 3) / 2;

    // Transisi pergantian model: dari kapten berdiri di luar menjadi tangan POV di kemudi
    if (easeZoom >= 0.85 && !inPov) {
      setInPov(true);
    } else if (easeZoom < 0.85 && inPov) {
      setInPov(false);
    }

    // Kecepatan kapal: saat fase zoom in masih pelan (1.5 - 3.0),
    // setelah masuk POV kamera berakselerasi kencang hingga 14.5
    const baseSpeed = THREE.MathUtils.lerp(1.5, 3.2, easeZoom);
    const accelProgress = Math.max(
      0,
      (progress - ZOOM_DURATION / DURATION_SEC) / (1 - ZOOM_DURATION / DURATION_SEC)
    );
    speedRef.current = baseSpeed + Math.pow(accelProgress, 1.35) * 11.5;
    flowRef.current += delta * speedRef.current;

    const t = clock.elapsedTime;

    // Roda kemudi berputar dikendalikan kapten
    if (wheelRef.current) {
      wheelRef.current.rotation.x =
        Math.sin(t * 2.2) * 0.45 + Math.sin(t * 1.1) * 0.2;
    }

    // Gerak kapal memecah ombak
    if (shipRef.current) {
      shipRef.current.position.y =
        Math.sin(t * 2.8) * 0.18 + Math.cos(t * 1.6) * 0.08;
      shipRef.current.rotation.z = Math.sin(t * 2.2) * 0.035; // roll
      shipRef.current.rotation.x =
        Math.sin(t * 2.6) * 0.04 - Math.min(0.08, progress * 0.06); // pitch haluan sedikit terangkat
    }

    // Perhitungan kamera: responsif portrait HP vs landscape desktop
    const aspect = size.width / Math.max(1, size.height);
    const isPortrait = aspect < 1.0;

    const bobbingY = Math.sin(t * 2.8) * 0.06;
    const swayZ = Math.sin(t * 2.2) * 0.04;

    // Target POV orang pertama di mata kapten
    const targetCamX = isPortrait ? -3.45 : -2.65;
    const targetCamY = isPortrait ? 2.82 : 2.52;
    const targetLookY = isPortrait ? 2.15 : 2.25;

    // Posisi awal kamera: zoom in dari atas dan belakang kapal mengarah ke kapten
    const startCamX = isPortrait ? -6.8 : -6.2;
    const startCamY = isPortrait ? 4.6 : 4.2;
    const startCamZ = isPortrait ? 2.2 : 3.4;

    const startLookX = -1.8; // Koordinat kapten & roda kemudi
    const startLookY = 2.2;
    const startLookZ = 0.2;

    // Interpolasi posisi kamera (zoom in mulus ke arah kapten)
    const camX = THREE.MathUtils.lerp(startCamX, targetCamX, easeZoom);
    const camY =
      THREE.MathUtils.lerp(startCamY, targetCamY, easeZoom) + bobbingY * easeZoom;
    const camZ = THREE.MathUtils.lerp(startCamZ, swayZ, easeZoom);

    // Interpolasi arah pandang (dari memandangi kapten -> beralih melihat horizon samudra)
    const lookX = THREE.MathUtils.lerp(startLookX, 14, easeZoom);
    const lookY = THREE.MathUtils.lerp(
      startLookY,
      targetLookY + bobbingY * 0.4,
      easeZoom
    );
    const lookZ = THREE.MathUtils.lerp(startLookZ, swayZ * 0.25, easeZoom);

    // FOV responsif yang ikut bertransisi secara dinamis
    const baseFov = isPortrait
      ? Math.min(84, Math.max(68, (52 / aspect) * 0.72))
      : 50;
    const startFov = isPortrait ? 66 : 56;
    const fovTarget = baseFov + progress * (isPortrait ? 8 : 12);
    const currentFov = THREE.MathUtils.lerp(startFov, fovTarget, easeZoom);

    camera.position.set(camX, camY, camZ);
    camera.lookAt(lookX, lookY, lookZ);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = currentFov;
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

      {/* Kapal bajak laut: menampilkan figur kapten saat zoom in, lalu beralih ke tangan kapten saat POV */}
      <group ref={shipRef} position={[0, 0, 0]}>
        <PirateShip
          showCrew={true}
          crewCount={4}
          wheelRef={wheelRef}
          withHands={inPov}
          showCaptain={!inPov}
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
  onReadyForDashboard,
  onComplete,
}: {
  userName?: string | null;
  onReadyForDashboard?: () => void;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [dissolve, setDissolve] = useState(false);
  const [introFade, setIntroFade] = useState(true);
  const [mounted, setMounted] = useState(false);
  const flowRef = useRef(0);
  const completedRef = useRef(false);
  const revealedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Mulai animasi fade in yang mulus dari gelap
    const fadeTimer = setTimeout(() => {
      setIntroFade(false);
    }, 40);

    return () => {
      clearTimeout(fadeTimer);
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleProgress = useCallback(
    (p: number) => {
      setProgress(p);
      // Ketika flash putih sudah mulai menutupi layar (>= 92%),
      // mount dashboard secara tersembunyi di balik layer putih agar siap instan
      if (p >= 0.92 && !revealedRef.current) {
        revealedRef.current = true;
        onReadyForDashboard?.();
      }
    },
    [onReadyForDashboard]
  );

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    // Pastikan dashboard di-mount di latar belakang sebelum transisi dissolve
    if (!revealedRef.current) {
      revealedRef.current = true;
      onReadyForDashboard?.();
    }

    setDissolve(true);
    setTimeout(() => {
      onComplete();
    }, 480);
  }, [onReadyForDashboard, onComplete]);

  useEffect(() => {
    const timer = setTimeout(() => {
      finish();
    }, DURATION_SEC * 1000);
    return () => clearTimeout(timer);
  }, [finish]);

  const content = (
    <div
      className={`fixed inset-0 w-screen h-screen h-[100dvh] z-[999999] overflow-hidden select-none bg-[#020617] transition-opacity duration-500 ease-out ${
        dissolve ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* 3D Canvas */}
      <Canvas
        className="w-full h-full block"
        camera={{
          position: [-6.2, 4.2, 3.4],
          fov: 56,
          near: 0.1,
          far: 500,
        }}
        dpr={typeof window !== "undefined" && window.innerWidth < 768 ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <CaptainPovScene flowRef={flowRef} onProgress={handleProgress} />
      </Canvas>

      {/* Smooth Intro Fade Overlay (Fade in dari gelap ke terang dengan mulus) */}
      <div
        className={`absolute inset-0 bg-[#020617] pointer-events-none transition-opacity duration-700 ease-out z-30 ${
          introFade ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Vignette & Cinematic Overlay */}
      <div className="absolute inset-0 bg-radial-[circle_at_50%_45%]_from-transparent_via-slate-950/20_to-slate-950/80 pointer-events-none" />

      {/* Speed lines / Motion mist effect saat kecepatan tinggi */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-blue-500/10 pointer-events-none transition-opacity duration-700"
        style={{ opacity: Math.max(0, (progress - 0.35) * 1.5) }}
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

      {/* Center Cinematic Welcome Card (Muncul mulus setelah fase zoom in selesai) */}
      <div
        className={`absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 w-[92%] sm:w-[85%] max-w-lg z-20 pointer-events-none transition-all duration-700 ease-out ${
          progress > 0.22 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
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
        className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-300"
        style={{
          opacity: dissolve ? 1 : progress > 0.85 ? Math.min(1, (progress - 0.85) * 6.6) : 0,
        }}
      />
    </div>
  );

  if (!mounted) {
    return (
      <div className="fixed inset-0 w-screen h-screen h-[100dvh] z-[999999] bg-[#020617]" />
    );
  }

  return createPortal(content, document.body);
}
