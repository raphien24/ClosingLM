"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Compass, FastForward } from "lucide-react";
import {
  GalleonShip,
  SHIP_URL_HIGH,
  ShipPose,
  SunsetFog,
  SunsetLights,
  SunsetOcean,
  SunsetSky,
  getSunDirection,
} from "./SunsetOcean";
import { preloadHumanModels } from "./RiggedHumanCrew";
import { ISLAND_POSITION, LOGIN_CAMERA, LOGIN_SHIP } from "./SunsetLoginBackground";
import { TropicalIsland, getIslandSignMetrics } from "./TropicalIsland";
import { detectHardwareSpecs } from "@/lib/hardwareDetection";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** Batas waktu aman apabila pemuatan aset sangat lambat */
const MAX_WAIT_MS = 10000;

const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeInCubic = (x: number) => x * x * x;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function SailScene({
  isLowSpecDevice,
  shipCompiled,
  onShipReady,
  onStart,
  onProgress,
}: {
  isLowSpecDevice: boolean;
  shipCompiled: boolean;
  onShipReady: () => void;
  onStart: () => void;
  onProgress: (p: number) => void;
}) {
  const sun = useMemo(() => getSunDirection(), []);
  const signMetrics = useMemo(() => getIslandSignMetrics(), []);
  const { gl, size } = useThree();
  const ship = LOGIN_SHIP.desktop;
  const elapsed = useRef(0);
  const started = useRef(false);
  const inPovRef = useRef(false);
  const [inPov, setInPov] = useState(false);
  const travelOffsetRef = useRef(0);
  const shipPoseRef = useRef<ShipPose>({ x: 0, y: 0, z: 0, pitch: 0, roll: 0 });
  const look = useMemo(() => new THREE.Vector3(), []);
  const povEyeVec = useMemo(() => new THREE.Vector3(), []);
  const povLookVec = useMemo(() => new THREE.Vector3(), []);
  const tiltEuler = useMemo(() => new THREE.Euler(0, 0, 0, "XYZ"), []);
  const lastFovRef = useRef(0);

  // Durasi transisi halus dan gesit
  const sailDuration = isLowSpecDevice ? 4.8 : 5.6;

  useFrame(({ camera, clock }, delta) => {
    if (!shipCompiled) return;
    if (!started.current) {
      started.current = true;
      onStart();
    }
    elapsed.current += Math.min(delta, 1 / 20);
    const p = clamp01(elapsed.current / sailDuration);
    onProgress(p);

    const t = clock.elapsedTime;
    const aspect = size.width / Math.max(1, size.height);
    const isPortrait = aspect < 1.0;

    // ── Fase 1 (0.00 .. 0.26): Zoom dari kamera login ke Kapten di kemudi kapal
    const zoomPhase = clamp01(p / 0.26);
    const easeZoom = easeInOutCubic(zoomPhase);

    // ── Pergantian model: dari figur penuh Kapten -> Tangan POV Kapten di kemudi (tanpa mount/compile baru)
    const shouldPov = p >= 0.21;
    if (shouldPov !== inPovRef.current) {
      inPovRef.current = shouldPov;
      setInPov(shouldPov);
    }

    // ── Fase 2 & 3 (0.21 .. 0.84): Kapal melaju kencang menuju Pulau JTT08 (update via ref tanpa re-render React)
    const sailPhase = clamp01((p - 0.21) / 0.63);
    const sailCurve = 0.35 * easeInOutCubic(sailPhase) + 0.65 * easeInCubic(sailPhase);
    travelOffsetRef.current = sailCurve * 208;

    // ── Fase 4 (0.78 .. 1.00): Zoom in dari haluan kapal menuju tulisan 3D LAST MILE di bukit pulau
    const islandZoomPhase = clamp01((p - 0.78) / 0.22);
    const easeIslandZoom = easeInOutCubic(islandZoomPhase);

    const sp = shipPoseRef.current;

    tiltEuler.set(sp.roll, 0, sp.pitch, "XYZ");
    povEyeVec
      .set(isPortrait ? -6.82 : -6.74, isPortrait ? 7.72 : 7.66, 0)
      .applyEuler(tiltEuler)
      .addScaledVector(THREE.Object3D.DEFAULT_UP, sp.y)
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP, ship.heading);
    const povEyeX = sp.x + povEyeVec.x;
    const povEyeY = povEyeVec.y + Math.sin(t * 2.6) * 0.014;
    const povEyeZ = sp.z + povEyeVec.z;

    povLookVec
      .set(120, isPortrait ? 1.5 : 0.5, 0)
      .applyEuler(tiltEuler)
      .addScaledVector(THREE.Object3D.DEFAULT_UP, sp.y)
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP, ship.heading);
    const povLookX = sp.x + povLookVec.x;
    const povLookY = povLookVec.y;
    const povLookZ = sp.z + povLookVec.z;

    let camX: number;
    let camY: number;
    let camZ: number;
    let lookX: number;
    let lookY: number;
    let lookZ: number;

    if (p < 0.26) {
      const startX = LOGIN_CAMERA.position.x;
      const startY = LOGIN_CAMERA.position.y;
      const startZ = LOGIN_CAMERA.position.z;

      const midX = -10.5;
      const midY = 8.8;
      const midZ = 5.5;

      const u = easeZoom;
      const inv = 1 - u;
      camX = inv * inv * startX + 2 * inv * u * midX + u * u * povEyeX;
      camY = inv * inv * startY + 2 * inv * u * midY + u * u * povEyeY;
      camZ = inv * inv * startZ + 2 * inv * u * midZ + u * u * povEyeZ;

      const turnForward = clamp01((zoomPhase - 0.52) / 0.48);
      const easeTurn = easeInOutCubic(turnForward);
      const captainFocusX = THREE.MathUtils.lerp(1.5, -6.3, clamp01(zoomPhase * 2));
      const captainFocusY = THREE.MathUtils.lerp(5.8, 7.25, clamp01(zoomPhase * 2));

      lookX = THREE.MathUtils.lerp(captainFocusX, povLookX, easeTurn);
      lookY = THREE.MathUtils.lerp(captainFocusY, povLookY, easeTurn);
      lookZ = THREE.MathUtils.lerp(0, povLookZ, easeTurn);
    } else {
      const signWorldX = ISLAND_POSITION[0] + signMetrics.centerX;
      const signWorldZ = ISLAND_POSITION[2] + signMetrics.centerZ;
      const signTargetCamX = signWorldX - (isPortrait ? 86 : 74);
      const signTargetCamY = signMetrics.centerY - 2.0;
      const signLookX = signWorldX;
      const signLookY = signMetrics.centerY - 0.5;

      camX = THREE.MathUtils.lerp(povEyeX, signTargetCamX, easeIslandZoom);
      camY = THREE.MathUtils.lerp(povEyeY, signTargetCamY, easeIslandZoom);
      camZ = THREE.MathUtils.lerp(povEyeZ, signWorldZ, easeIslandZoom);

      lookX = THREE.MathUtils.lerp(povLookX, signLookX, easeIslandZoom);
      lookY = THREE.MathUtils.lerp(povLookY, signLookY, easeIslandZoom);
      lookZ = THREE.MathUtils.lerp(povLookZ, signWorldZ, easeIslandZoom);
    }

    camera.position.set(camX, camY, camZ);
    look.set(lookX, lookY, lookZ);
    camera.lookAt(look);

    if (p >= 0.22 && p < 0.84) {
      const rollInfluence = 1 - easeIslandZoom;
      camera.rotateZ((sp.roll * 0.42 + Math.sin(t * 2.1) * 0.01) * rollInfluence);
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const loginFov = isPortrait ? 60 : 44;
      const povFov = isPortrait ? 66 : 58;
      const speedFovBoost = Math.sin(sailPhase * Math.PI) * 5;
      const finalZoomFov = isPortrait ? 52 : 46;

      let fov = THREE.MathUtils.lerp(loginFov, povFov, easeZoom) + speedFovBoost;
      fov = THREE.MathUtils.lerp(fov, finalZoomFov, easeIslandZoom);
      if (Math.abs(fov - lastFovRef.current) > 0.02) {
        lastFovRef.current = fov;
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }

    gl.toneMappingExposure = 0.54;
  });

  return (
    <>
      <SunsetFog density={0.00016} />
      <SunsetLights sun={sun} intensity={2.9} />
      <SunsetSky sun={sun} />
      <SunsetOcean
        sun={sun}
        quality={isLowSpecDevice ? "low" : "high"}
        flowTimeScale={inPov ? 3.8 : 1.2}
      />
      <GalleonShip
        quality="high"
        position={ship.position}
        heading={ship.heading}
        speed={0}
        travelOffsetRef={travelOffsetRef}
        inPov={inPov}
        enablePovRig
        progressive
        shipPoseRef={shipPoseRef}
        mobileCompact={false}
        onShipReady={onShipReady}
      />
      <TropicalIsland position={ISLAND_POSITION} isLowSpec={isLowSpecDevice} />
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
  const [isLowSpecDevice, setIsLowSpecDevice] = useState(false);
  const [shipCompiled, setShipCompiled] = useState(false);
  const [sceneStarted, setSceneStarted] = useState(false);
  const [hudVisible, setHudVisible] = useState(false);
  const [dissolve, setDissolve] = useState(false);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const stageTextRef = useRef<HTMLSpanElement>(null);
  const fadeEndRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const revealedRef = useRef(false);
  const hudHiddenRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    setIsLowSpecDevice(detectHardwareSpecs().isLowSpec);
    useLoader.preload(GLTFLoader, SHIP_URL_HIGH, (loader: THREE.Loader) => {
      (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
    });
    preloadHumanModels(false);

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
    setTimeout(onComplete, 650);
  }, [reveal, onComplete]);

  const handleShipReady = useCallback(() => {
    setShipCompiled(true);
  }, []);

  const handleStart = useCallback(() => {
    setSceneStarted(true);
    setHudVisible(true);
  }, []);

  const handleProgress = useCallback(
    (p: number) => {
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${Math.round(p * 100)}%`;
      }
      if (stageTextRef.current) {
        stageTextRef.current.textContent =
          p < 0.25
            ? "Menuju Kemudi Kapten…"
            : p < 0.78
            ? "POV Kapten · Melaju ke Pulau JTT08"
            : "Tiba di Pelabuhan Komando JTT08";
      }
      if (fadeEndRef.current) {
        const endFade = clamp01((p - 0.89) / 0.11);
        fadeEndRef.current.style.opacity = String(endFade);
      }
      if (p >= 0.88) {
        reveal();
        if (!hudHiddenRef.current) {
          hudHiddenRef.current = true;
          setHudVisible(false);
        }
      }
      if (p >= 1) finish();
    },
    [reveal, finish]
  );

  useEffect(() => {
    if (sceneStarted) return;
    const timer = setTimeout(finish, MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [sceneStarted, finish]);

  const firstName = userName ? userName.split(" ")[0] : "JTT08";

  const content = (
    <div
      className={`fixed inset-0 w-screen h-[100dvh] z-[999999] overflow-hidden select-none bg-[#0b1120] transition-opacity duration-700 ease-out ${
        dissolve ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <Canvas
        className="w-full h-full block"
        frameloop="always"
        camera={{
          position: LOGIN_CAMERA.position.toArray() as [number, number, number],
          fov: 44,
          near: 0.28,
          far: 16000,
        }}
        dpr={isLowSpecDevice ? 1 : [1, 1.25]}
        gl={{ antialias: !isLowSpecDevice, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.54;
          gl.debug.checkShaderErrors = false;
        }}
      >
        <Suspense fallback={null}>
          <SailScene
            isLowSpecDevice={isLowSpecDevice}
            shipCompiled={shipCompiled}
            onShipReady={handleShipReady}
            onStart={handleStart}
            onProgress={handleProgress}
          />
        </Suspense>
      </Canvas>

      {/* Tirai gelap netral (disembunyikan di background tanpa background oranye) sampai kapal & kru selesai dimuat */}
      <div
        className={`absolute inset-0 bg-[#0b1120] pointer-events-none transition-opacity duration-300 ease-out ${
          sceneStarted ? "opacity-0" : "opacity-100"
        }`}
      >
        {!sceneStarted && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-7 w-7 rounded-full border-2 border-slate-700 border-t-slate-300 animate-spin" />
          </div>
        )}
      </div>

      {/* Vignette sinematik */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_50%,transparent_52%,rgba(10,6,20,0.52)_100%)]" />

      {/* Transisi akhir gelap-navy lembut menuju DashboardShipWipeOverlay (tanpa kilau oranye) */}
      <div
        ref={fadeEndRef}
        className="absolute inset-0 pointer-events-none bg-[#0b1528]"
        style={{ opacity: 0 }}
      />

      {/* Tombol Lewati (hanya muncul setelah scene 3D siap) */}
      {sceneStarted && (
        <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-30 pointer-events-auto animate-fadeIn">
          <button
            onClick={finish}
            className="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-black/60 hover:bg-black/80 border border-white/30 text-amber-50 text-xs font-bold transition-all cursor-pointer group shadow-lg"
            title="Lewati animasi langsung menuju Dashboard"
          >
            <span>Lewati</span>
            <FastForward className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* Kartu status pelayaran (hanya muncul setelah scene 3D siap) */}
      <div
        className={`absolute top-4 left-4 sm:top-5 sm:left-6 max-w-xs sm:max-w-sm z-20 pointer-events-none transition-all duration-500 ease-out ${
          hudVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <div className="rounded-2xl border border-white/20 bg-[#1b1022]/85 px-4 py-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.75)]">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/95">
            <Compass className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "8s" }} />
            <span ref={stageTextRef}>Menuju Kemudi Kapten…</span>
          </div>
          <h2 className="mt-0.5 text-sm sm:text-base font-bold text-white tracking-tight drop-shadow">
            Selamat Datang, Kapten {firstName}
          </h2>
          <div className="mt-2 h-1 w-full rounded-full bg-white/15 overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full rounded-full bg-gradient-to-r from-[#ffcf8a] via-[#ff9f6b] to-[#e8678a]"
              style={{ width: "0%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) {
    return <div className="fixed inset-0 w-screen h-[100dvh] z-[999999] bg-[#0b1120]" />;
  }
  return createPortal(content, document.body);
}
