"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FastForward, Sunset } from "lucide-react";
import {
  GalleonShip,
  SunsetFog,
  SunsetLights,
  SunsetOcean,
  SunsetSky,
  getSunDirection,
} from "./SunsetOcean";
import { LOGIN_CAMERA, LOGIN_SHIP } from "./SunsetLoginBackground";

/** Durasi perjalanan kamera menuju matahari terbenam (detik, setelah aset siap) */
const SAIL_DURATION = 3.4;
/** Batas aman: jika aset terlalu lama dimuat, langsung lanjut ke dashboard */
const MAX_WAIT_MS = 10000;

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeInCubic = (x: number) => x * x * x;

function SailScene({
  isMobile,
  onStart,
  onProgress,
}: {
  isMobile: boolean;
  onStart: () => void;
  onProgress: (p: number) => void;
}) {
  const sun = useMemo(() => getSunDirection(), []);
  const { gl } = useThree();
  const elapsed = useRef(0);
  const started = useRef(false);
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock }, delta) => {
    if (!started.current) {
      started.current = true;
      onStart();
    }
    // Batasi delta agar frame pertama yang berat tidak membuat kamera "lompat"
    elapsed.current += Math.min(delta, 1 / 30);
    const p = Math.min(1, elapsed.current / SAIL_DURATION);
    onProgress(p);

    const t = clock.elapsedTime;
    const move = 0.55 * easeInOutCubic(p) + 0.45 * easeInCubic(p);

    // Kamera melaju di atas permukaan laut menuju matahari, melewati kapal galleon
    const dist = move * 520;
    const camY = THREE.MathUtils.lerp(LOGIN_CAMERA.position.y, 7.5, easeInOutCubic(p));
    camera.position.set(
      Math.sin(t * 0.7) * 0.25,
      camY + Math.sin(t * 1.4) * 0.12 * (1 - p),
      LOGIN_CAMERA.position.z - dist
    );
    look.set(0, THREE.MathUtils.lerp(LOGIN_CAMERA.lookAt.y, 9.5, easeInOutCubic(p)), camera.position.z - 100);
    camera.lookAt(look);
    camera.rotateZ(Math.sin(t * 0.9) * 0.008);

    if (camera instanceof THREE.PerspectiveCamera) {
      const base = isMobile ? 62 : 45;
      camera.fov = base + easeInCubic(p) * 14;
      camera.updateProjectionMatrix();
    }

    // Cahaya senja makin menyilaukan di akhir perjalanan
    const glow = Math.max(0, (p - 0.5) / 0.5);
    gl.toneMappingExposure = 0.42 + easeInCubic(glow) * 2.0;
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

export function SunsetSailTransition({
  userName,
  onReadyForDashboard,
  onComplete,
}: {
  userName?: string | null;
  onReadyForDashboard?: () => void;
  onComplete: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sceneStarted, setSceneStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dissolve, setDissolve] = useState(false);
  const completedRef = useRef(false);
  const revealedRef = useRef(false);
  const lastReported = useRef(0);

  useEffect(() => {
    setMounted(true);
    setIsMobile(window.innerWidth < 768);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    onReadyForDashboard?.();
  }, [onReadyForDashboard]);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    reveal();
    setDissolve(true);
    setTimeout(onComplete, 750);
  }, [reveal, onComplete]);

  const handleProgress = useCallback(
    (p: number) => {
      // Throttle update state (~30fps cukup untuk UI overlay)
      if (p < 1 && p - lastReported.current < 0.012) return;
      lastReported.current = p;
      setProgress(p);
      // Dashboard di-mount diam-diam di balik cahaya sebelum dissolve
      if (p >= 0.85) reveal();
      if (p >= 1) finish();
    },
    [reveal, finish]
  );

  // Pengaman: jika model/tekstur gagal / sangat lambat dimuat
  useEffect(() => {
    if (sceneStarted) return;
    const timer = setTimeout(finish, MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [sceneStarted, finish]);

  const glow = Math.max(0, (progress - 0.62) / 0.38);
  const firstName = userName ? userName.split(" ")[0] : "JTT08";

  const content = (
    <div
      className={`fixed inset-0 w-screen h-[100dvh] z-[999999] overflow-hidden select-none bg-[#1b1530] transition-opacity duration-700 ease-out ${
        dissolve ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <Canvas
        className="w-full h-full block"
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
          <SailScene
            isMobile={isMobile}
            onStart={() => setSceneStarted(true)}
            onProgress={handleProgress}
          />
        </Suspense>
      </Canvas>

      {/* Tirai senja awal (fade-in mulus begitu scene siap) */}
      <div
        className={`absolute inset-0 bg-gradient-to-b from-[#1b1530] via-[#5a2c3a] to-[#c9774a] pointer-events-none transition-opacity duration-1000 ease-out ${
          sceneStarted ? "opacity-0" : "opacity-100"
        }`}
      >
        {!sceneStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-amber-100/90">
            <div className="h-10 w-10 rounded-full border-2 border-amber-200/30 border-t-amber-200 animate-spin" />
            <p className="text-xs font-semibold tracking-[0.25em] uppercase">Menyiapkan pelayaran…</p>
          </div>
        )}
      </div>

      {/* Vignette sinematik */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_50%,transparent_50%,rgba(10,6,20,0.55)_100%)]" />

      {/* Cahaya matahari yang membesar & menyilaukan di akhir */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: Math.min(1, glow * 1.15),
          background:
            "radial-gradient(circle at 50% 48%, rgba(255,247,230,1) 0%, rgba(255,214,160,0.95) 35%, rgba(255,170,110,0.9) 70%, rgba(255,150,100,0.85) 100%)",
        }}
      />

      {/* Tombol lewati */}
      <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-20">
        <button
          onClick={finish}
          className="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-black/30 hover:bg-black/45 border border-white/25 text-amber-50 text-xs font-semibold backdrop-blur-md transition-all cursor-pointer group"
        >
          <span>Lewati</span>
          <FastForward className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Kartu sambutan kaca (glassmorphism) */}
      <div
        className={`absolute bottom-5 sm:bottom-8 left-1/2 -translate-x-1/2 w-[92%] sm:w-[85%] max-w-md z-20 pointer-events-none transition-all duration-700 ease-out ${
          sceneStarted && progress < 0.8 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="rounded-2xl border border-white/20 bg-[#1b1022]/35 backdrop-blur-xl px-4 py-3.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] text-center">
          <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200/90">
            <Sunset className="h-3.5 w-3.5" />
            <span>Berlayar Menuju Dashboard</span>
          </div>
          <h2 className="mt-1 text-base sm:text-xl font-bold text-white tracking-tight drop-shadow">
            Selamat Datang, Kapten {firstName}
          </h2>
          <div className="mt-2.5 h-1 w-full rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ffcf8a] via-[#ff9f6b] to-[#e8678a]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) {
    return <div className="fixed inset-0 w-screen h-[100dvh] z-[999999] bg-[#1b1530]" />;
  }
  return createPortal(content, document.body);
}
