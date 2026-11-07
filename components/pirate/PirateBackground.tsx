"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  Ocean,
  SkyDome,
  Stars,
  PirateShip,
  Seagull,
} from "./PirateModels";

function AnimatedScene({ isMobile }: { isMobile: boolean }) {
  const shipRef = useRef<THREE.Group>(null);
  const mouseTarget = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseTarget.current.x = (e.clientX / window.innerWidth - 0.5) * 1.5;
      mouseTarget.current.y = (e.clientY / window.innerHeight - 0.5) * 0.8;
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;

    // Rocking kapal mengikuti gelombang laut
    if (shipRef.current) {
      shipRef.current.position.y =
        Math.sin(t * 1.3) * 0.22 + Math.cos(t * 0.85) * 0.12;
      shipRef.current.rotation.z =
        Math.sin(t * 1.1) * 0.05 + Math.cos(t * 0.7) * 0.03; // roll
      shipRef.current.rotation.x =
        Math.sin(t * 1.25 + 0.9) * 0.045; // pitch
      shipRef.current.rotation.y =
        Math.sin(t * 0.5) * 0.035; // gentle yaw
    }

    // Parallax kamera normal mengikuti pergerakan kursor mouse
    const targetX = isMobile ? -0.5 : -2.5 + mouseTarget.current.x;
    const targetY = isMobile ? 4.5 : 4.0 - mouseTarget.current.y;
    const targetZ = isMobile ? 12 : 9.5;

    camera.position.x += (targetX - camera.position.x) * 0.03;
    camera.position.y += (targetY - camera.position.y) * 0.03;
    camera.position.z += (targetZ - camera.position.z) * 0.03;

    const lookTargetX = isMobile ? 0 : 0.8;
    const lookTargetY = 1.6;
    const lookTargetZ = 0;
    camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
  });

  return (
    <>
      {/* Pencahayaan Maritim Malam Hari */}
      <ambientLight color="#1e293b" intensity={0.9} />
      <directionalLight
        position={[-15, 20, 10]}
        color="#93c5fd"
        intensity={1.8}
        castShadow={!isMobile}
      />
      <directionalLight
        position={[10, 5, -10]}
        color="#f59e0b"
        intensity={0.4}
      />
      {/* Cahaya hangat dari arah kapal */}
      <pointLight position={[-1, 3, 2]} color="#fbbf24" intensity={2} distance={8} />

      {/* Langit & Bintang */}
      <SkyDome top="#030712" horizon="#0f2b5c" />
      <Stars count={isMobile ? 350 : 800} />

      {/* Burung Camar */}
      <Seagull radius={8} height={7.5} speed={0.4} phase={0} />
      <Seagull radius={11} height={9} speed={0.3} phase={2.2} />
      {!isMobile && <Seagull radius={14} height={10.5} speed={0.25} phase={4.5} />}

      {/* Kapal Bajak Laut + Kru */}
      <group
        ref={shipRef}
        position={isMobile ? [0, 0, 0] : [0.5, 0, 0]}
        scale={isMobile ? 0.88 : 1.05}
      >
        <PirateShip
          showCrew={true}
          crewCount={isMobile ? 3 : 5}
          sailLabel="JTT08"
        />
      </group>

      {/* Samudra Bergelombang */}
      <Ocean
        segments={isMobile ? 64 : 110}
        size={240}
        deep="#031126"
        shallow="#0c3260"
        foam="#99c4ff"
        fogColor="#071b38"
        fogNear={18}
        fogFar={120}
      />
    </>
  );
}

export function PirateBackground() {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none bg-gradient-to-b from-[#020617] via-[#071b38] to-[#041226]">
      {mounted && (
        <Canvas
          camera={{
            position: [-2.5, 4.0, 9.5],
            fov: isMobile ? 55 : 45,
            near: 0.1,
            far: 500,
          }}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
        >
          <AnimatedScene isMobile={isMobile} />
        </Canvas>
      )}

      {/* Subtle vignette & soft maritime gradient overlay */}
      <div className="absolute inset-0 bg-radial-[circle_at_75%_50%]_from-transparent_via-slate-950/20_to-slate-950/70 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />
    </div>
  );
}
