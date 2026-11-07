"use client";

/**
 * Low-poly procedural 3D models (tanpa file model eksternal) untuk tema bajak laut:
 * Ocean (shader gelombang), SkyDome, PirateShip, Crew, ShipWheel, Seagull.
 */

import { useMemo, useRef, forwardRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── Ocean ───────────────────────────────────────────────────────────────

const oceanVertex = /* glsl */ `
  uniform float uTime;
  uniform float uFlow;
  varying float vH;
  varying vec3 vWorld;
  float wave(vec2 p) {
    return sin(p.x * 0.22 + uTime * 0.9) * 0.38
         + sin(p.y * 0.31 + uTime * 1.25) * 0.28
         + sin((p.x + p.y) * 0.55 + uTime * 1.7) * 0.12
         + sin((p.x - p.y) * 1.1 + uTime * 2.3) * 0.05;
  }
  void main() {
    vec3 pos = position;
    vec2 p = vec2(pos.x, pos.y + uFlow);
    float h = wave(p);
    pos.z += h;
    vH = h;
    vec4 w = modelMatrix * vec4(pos, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const oceanFragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uCam;
  varying float vH;
  varying vec3 vWorld;
  void main() {
    float t = smoothstep(-0.7, 0.7, vH);
    vec3 c = mix(uDeep, uShallow, t);
    float foam = smoothstep(0.5, 0.8, vH);
    c = mix(c, uFoam, foam * 0.55);
    float d = distance(vWorld, uCam);
    float f = smoothstep(uFogNear, uFogFar, d);
    c = mix(c, uFogColor, f);
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function Ocean({
  segments = 128,
  size = 260,
  deep = "#061a33",
  shallow = "#1d4f86",
  foam = "#cfe3ff",
  fogColor = "#1e3a6e",
  fogNear = 20,
  fogFar = 110,
  flowSpeed = 0,
  flowRef,
}: {
  segments?: number;
  size?: number;
  deep?: string;
  shallow?: string;
  foam?: string;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
  flowSpeed?: number;
  /** Jika diberikan, nilai flow dibaca dari ref (untuk akselerasi kapal). */
  flowRef?: React.MutableRefObject<number>;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uFoam: { value: new THREE.Color(foam) },
      uFogColor: { value: new THREE.Color(fogColor) },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
      uCam: { value: new THREE.Vector3() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame((_, delta) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value += delta;
    if (flowRef) m.uniforms.uFlow.value = flowRef.current;
    else m.uniforms.uFlow.value += delta * flowSpeed;
    m.uniforms.uCam.value.copy(camera.position);
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.2}>
      <planeGeometry args={[size, size, segments, segments]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={oceanVertex}
        fragmentShader={oceanFragment}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ── Sky Dome ────────────────────────────────────────────────────────────

export function SkyDome({
  top = "#050b1f",
  horizon = "#1e3a6e",
}: {
  top?: string;
  horizon?: string;
}) {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
    }),
    [top, horizon]
  );
  return (
    <mesh scale={400}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vDir;
          void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(uHorizon, uTop, pow(h, 0.45)); gl_FragColor = vec4(c, 1.0); }`}
      />
    </mesh>
  );
}

export function Stars({ count = 900 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9 + 0.08); // hanya belahan atas
      const r = 300;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#e2ecff" size={1.4} sizeAttenuation={false} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

// ── Canvas textures ─────────────────────────────────────────────────────

function useCanvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function useSailTexture(label?: string) {
  return useCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#efe4c8";
    ctx.fillRect(0, 0, w, h);
    // seams
    ctx.strokeStyle = "rgba(120,90,50,0.25)";
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    if (label) {
      ctx.fillStyle = "#0f2a5c";
      ctx.font = "bold 64px Arial Black, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, w / 2, h / 2);
      ctx.strokeStyle = "#d4a63a";
      ctx.lineWidth = 3;
      ctx.strokeText(label, w / 2, h / 2);
    }
  });
}

function useFlagTexture() {
  return useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f5f5f5";
      // skull
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.42, h * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w / 2 - h * 0.11, h * 0.5, h * 0.22, h * 0.14);
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.arc(w / 2 - h * 0.08, h * 0.42, h * 0.055, 0, Math.PI * 2);
      ctx.arc(w / 2 + h * 0.08, h * 0.42, h * 0.055, 0, Math.PI * 2);
      ctx.fill();
      // crossbones
      ctx.strokeStyle = "#f5f5f5";
      ctx.lineWidth = h * 0.06;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(w / 2 - h * 0.32, h * 0.62);
      ctx.lineTo(w / 2 + h * 0.32, h * 0.86);
      ctx.moveTo(w / 2 + h * 0.32, h * 0.62);
      ctx.lineTo(w / 2 - h * 0.32, h * 0.86);
      ctx.stroke();
    },
    256,
    170
  );
}

// ── Ship Wheel ──────────────────────────────────────────────────────────

const WOOD_DARK = "#4a2c14";
const WOOD = "#6b4423";
const WOOD_LIGHT = "#9a6b3f";
const GOLD = "#d4a63a";

export const ShipWheel = forwardRef<THREE.Group, { radius?: number; withHands?: boolean }>(
  function ShipWheel({ radius = 0.45, withHands = false }, ref) {
    const spokes = 8;
    return (
      // Bidang roda = YZ (menghadap sumbu X / arah haluan)
      <group ref={ref}>
        <mesh rotation-y={Math.PI / 2}>
          <torusGeometry args={[radius, 0.045, 8, 28]} />
          <meshStandardMaterial color={WOOD} roughness={0.7} />
        </mesh>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 12]} />
          <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} />
        </mesh>
        {Array.from({ length: spokes }).map((_, i) => {
          const a = (i / spokes) * Math.PI * 2;
          return (
            <group key={i} rotation-x={a}>
              <mesh position-y={radius / 2}>
                <cylinderGeometry args={[0.022, 0.022, radius, 6]} />
                <meshStandardMaterial color={WOOD_LIGHT} roughness={0.7} />
              </mesh>
              <mesh position-y={radius + 0.11}>
                <cylinderGeometry args={[0.03, 0.04, 0.2, 8]} />
                <meshStandardMaterial color={WOOD_LIGHT} roughness={0.6} />
              </mesh>
            </group>
          );
        })}
        {withHands && (
          <>
            {/* Tangan kapten menggenggam pegangan roda (ikut berputar) */}
            {[Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35].map((a, i) => (
              <group key={i} rotation-x={a}>
                <group position={[-0.06, radius + 0.1, 0]}>
                  <mesh>
                    <sphereGeometry args={[0.075, 12, 10]} />
                    <meshStandardMaterial color="#1f1f1f" roughness={0.8} />
                  </mesh>
                  {/* lengan baju */}
                  <mesh position={[-0.32, -0.05, 0]} rotation-z={Math.PI / 2 - 0.25}>
                    <cylinderGeometry args={[0.07, 0.09, 0.55, 10]} />
                    <meshStandardMaterial color="#7f1d1d" roughness={0.8} />
                  </mesh>
                  {/* manset emas */}
                  <mesh position={[-0.08, -0.01, 0]} rotation-z={Math.PI / 2 - 0.25}>
                    <cylinderGeometry args={[0.085, 0.085, 0.06, 10]} />
                    <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.35} />
                  </mesh>
                </group>
              </group>
            ))}
          </>
        )}
      </group>
    );
  }
);

// ── Crew ────────────────────────────────────────────────────────────────

export type CrewPose = "wave" | "swab" | "lookout" | "helm" | "cheer" | "idle";

export function Crew({
  position,
  rotationY = 0,
  shirt = "#b91c1c",
  pants = "#1e293b",
  hat = "bandana",
  pose = "idle",
  phase = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
  shirt?: string;
  pants?: string;
  hat?: "bandana" | "tricorn" | "none";
  pose?: CrewPose;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  const skin = "#e0a77a";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (root.current) root.current.position.y = position[1] + Math.abs(Math.sin(t * 2)) * 0.03;
    const L = armL.current;
    const R = armR.current;
    if (!L || !R) return;
    switch (pose) {
      case "wave":
        R.rotation.x = 0;
        R.rotation.z = 2.6 + Math.sin(t * 6) * 0.35;
        L.rotation.z = -0.15;
        break;
      case "cheer":
        R.rotation.z = 2.8 + Math.sin(t * 4) * 0.2;
        L.rotation.z = -2.8 - Math.sin(t * 4 + 1) * 0.2;
        break;
      case "swab":
        L.rotation.x = -0.9 + Math.sin(t * 3) * 0.4;
        R.rotation.x = -0.9 + Math.sin(t * 3) * 0.4;
        if (prop.current) prop.current.rotation.x = Math.sin(t * 3) * 0.4;
        if (root.current) root.current.rotation.y = rotationY + Math.sin(t * 1.5) * 0.4;
        break;
      case "lookout":
        R.rotation.x = -1.5;
        R.rotation.z = 0.25;
        L.rotation.x = -1.4;
        L.rotation.z = -0.35;
        if (root.current) root.current.rotation.y = rotationY + Math.sin(t * 0.5) * 0.35;
        break;
      case "helm":
        L.rotation.x = -1.2 + Math.sin(t * 1.2) * 0.12;
        R.rotation.x = -1.2 - Math.sin(t * 1.2) * 0.12;
        break;
      default:
        L.rotation.z = -0.12 + Math.sin(t * 1.5) * 0.05;
        R.rotation.z = 0.12 - Math.sin(t * 1.5) * 0.05;
    }
  });

  return (
    <group ref={root} position={position} rotation-y={rotationY} scale={0.55}>
      {/* legs */}
      <mesh position={[0, 0.35, 0.12]}>
        <capsuleGeometry args={[0.1, 0.45, 4, 8]} />
        <meshStandardMaterial color={pants} />
      </mesh>
      <mesh position={[0, 0.35, -0.12]}>
        <capsuleGeometry args={[0.1, 0.45, 4, 8]} />
        <meshStandardMaterial color={pants} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 1.0, 0]}>
        <capsuleGeometry args={[0.24, 0.45, 4, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      {/* belt */}
      <mesh position={[0, 0.74, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.08, 12]} />
        <meshStandardMaterial color="#1c1917" />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* eye patch */}
      <mesh position={[0.19, 1.63, 0.08]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {hat === "bandana" && (
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.235, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
      )}
      {hat === "tricorn" && (
        <group position={[0, 1.8, 0]}>
          <mesh>
            <cylinderGeometry args={[0.42, 0.42, 0.05, 3]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh position-y={0.12}>
            <cylinderGeometry args={[0.18, 0.22, 0.22, 12]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh position-y={0.03}>
            <cylinderGeometry args={[0.43, 0.43, 0.02, 3]} />
            <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      )}
      {/* arms (pivot di bahu) */}
      <group ref={armL} position={[0, 1.3, 0.3]}>
        <mesh position-y={-0.28}>
          <capsuleGeometry args={[0.07, 0.4, 4, 8]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position-y={-0.55}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group ref={armR} position={[0, 1.3, -0.3]}>
        <mesh position-y={-0.28}>
          <capsuleGeometry args={[0.07, 0.4, 4, 8]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position-y={-0.55}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        {pose === "lookout" && (
          <mesh position={[0, -0.6, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.04, 0.06, 0.45, 8]} />
            <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} />
          </mesh>
        )}
      </group>
      {pose === "swab" && (
        <group ref={prop} position={[0.35, 0.9, 0]}>
          <mesh rotation-z={0.5}>
            <cylinderGeometry args={[0.03, 0.03, 1.3, 6]} />
            <meshStandardMaterial color={WOOD_LIGHT} />
          </mesh>
          <mesh position={[0.32, -0.6, 0]}>
            <boxGeometry args={[0.2, 0.12, 0.3]} />
            <meshStandardMaterial color="#d6d3d1" />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ── Pirate Ship ─────────────────────────────────────────────────────────

const DECK_Y = 0.6;

function useHullGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-3.2, -1.15);
    s.lineTo(1.6, -1.15);
    s.quadraticCurveTo(3.4, -0.9, 4.0, 0);
    s.quadraticCurveTo(3.4, 0.9, 1.6, 1.15);
    s.lineTo(-3.2, 1.15);
    s.quadraticCurveTo(-3.5, 0, -3.2, -1.15);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 1.3,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.12,
      bevelSegments: 2,
      curveSegments: 16,
    });
    // shape di bidang XY → putar agar extrude mengarah ke +Y
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.7, 0);
    return g;
  }, []);
}

function useDeckGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-3.1, -1.05);
    s.lineTo(1.6, -1.05);
    s.quadraticCurveTo(3.3, -0.8, 3.85, 0);
    s.quadraticCurveTo(3.3, 0.8, 1.6, 1.05);
    s.lineTo(-3.1, 1.05);
    s.lineTo(-3.1, -1.05);
    const g = new THREE.ShapeGeometry(s, 16);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
}

function Sail({
  width = 2.6,
  height = 2.2,
  y,
  x,
  texture,
  billow = 0.35,
}: {
  width?: number;
  height?: number;
  y: number;
  x: number;
  texture: THREE.Texture;
  billow?: number;
}) {
  // Segmen silinder sebagai layar yang menggembung ke arah haluan (+X)
  const radius = (width * width) / (8 * billow) + billow / 2;
  const theta = 2 * Math.asin(width / 2 / radius);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.x = 1 + Math.sin(clock.elapsedTime * 1.3 + x) * 0.08;
  });
  return (
    <group position={[x, y, 0]}>
      <group ref={ref}>
        <mesh position-x={-radius + billow + 0.05}>
          <cylinderGeometry args={[radius, radius, height, 18, 1, true, Math.PI / 2 - theta / 2, theta]} />
          <meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
      </group>
      {/* yard (palang layar) */}
      <mesh position={[0.05, height / 2, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.05, 0.05, width + 0.4, 8]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
    </group>
  );
}

export function PirateShip({
  showCrew = true,
  crewCount = 5,
  wheelRef,
  withHands = false,
  showCaptain = true,
  sailLabel = "JTT08",
}: {
  showCrew?: boolean;
  crewCount?: number;
  wheelRef?: React.Ref<THREE.Group>;
  withHands?: boolean;
  showCaptain?: boolean;
  sailLabel?: string;
}) {
  const hull = useHullGeometry();
  const deck = useDeckGeometry();
  const sailTex = useSailTexture();
  const mainSailTex = useSailTexture(sailLabel);
  const flagTex = useFlagTexture();
  const flagRef = useRef<THREE.Mesh>(null);
  const lanternRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (flagRef.current) flagRef.current.rotation.y = Math.PI / 2 + Math.sin(t * 3) * 0.25;
    if (lanternRef.current) lanternRef.current.intensity = 6 + Math.sin(t * 9) * 0.8 + Math.sin(t * 23) * 0.4;
  });

  const crewList: { pos: [number, number, number]; rot: number; pose: CrewPose; shirt: string; hat: "bandana" | "tricorn" | "none" }[] = [
    { pos: [1.9, DECK_Y, 0.35], rot: 0, pose: "lookout", shirt: "#1d4ed8", hat: "bandana" },
    { pos: [0.0, DECK_Y, 0.55], rot: Math.PI / 2, pose: "swab", shirt: "#f5f5f4", hat: "bandana" },
    { pos: [-0.3, DECK_Y, -0.6], rot: -Math.PI / 2.4, pose: "wave", shirt: "#b91c1c", hat: "bandana" },
    { pos: [1.2, DECK_Y, -0.55], rot: -Math.PI / 2, pose: "cheer", shirt: "#ca8a04", hat: "none" },
    { pos: [-1.1, DECK_Y, 0.6], rot: Math.PI / 1.6, pose: "idle", shirt: "#15803d", hat: "bandana" },
  ];

  return (
    <group>
      {/* Hull */}
      <mesh geometry={hull} castShadow>
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      {/* Gold stripe */}
      <mesh geometry={hull} scale={[1.005, 0.12, 1.02]} position-y={0.36}>
        <meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Deck */}
      <mesh geometry={deck} position-y={DECK_Y + 0.01}>
        <meshStandardMaterial color={WOOD_LIGHT} roughness={0.9} />
      </mesh>
      {/* Railings */}
      {[-1.12, 1.12].map((z) => (
        <mesh key={z} position={[0.3, DECK_Y + 0.25, z]}>
          <boxGeometry args={[5.6, 0.08, 0.08]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
      ))}
      {/* Stern castle */}
      <mesh position={[-2.45, DECK_Y + 0.45, 0]}>
        <boxGeometry args={[1.5, 0.9, 2.3]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      <mesh position={[-2.45, DECK_Y + 0.91, 0]}>
        <boxGeometry args={[1.5, 0.04, 2.3]} />
        <meshStandardMaterial color={WOOD_LIGHT} />
      </mesh>
      {/* Stern windows (glow) */}
      {[-0.6, 0, 0.6].map((z) => (
        <mesh key={z} position={[-3.21, DECK_Y + 0.45, z]}>
          <boxGeometry args={[0.02, 0.3, 0.3]} />
          <meshStandardMaterial color="#fcd34d" emissive="#f59e0b" emissiveIntensity={2} />
        </mesh>
      ))}
      {/* Lantern */}
      <mesh position={[-3.1, DECK_Y + 1.5, 0]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={3} />
      </mesh>
      <pointLight ref={lanternRef} position={[-3.1, DECK_Y + 1.5, 0]} color="#ffb347" intensity={6} distance={7} />
      {/* Helm wheel */}
      <group position={[-1.75, DECK_Y + 1.5, 0]}>
        <mesh position-y={-0.33}>
          <cylinderGeometry args={[0.06, 0.09, 0.6, 8]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
        <ShipWheel ref={wheelRef} withHands={withHands} />
      </group>
      {/* Bowsprit */}
      <mesh position={[4.4, DECK_Y + 0.4, 0]} rotation-z={-Math.PI / 2 + 0.3}>
        <cylinderGeometry args={[0.05, 0.09, 1.8, 8]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      {/* Masts */}
      <mesh position={[0.9, DECK_Y + 3.3, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 6.6, 10]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      <mesh position={[-0.9, DECK_Y + 2.7, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 5.4, 10]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      {/* Crow's nest */}
      <mesh position={[0.9, DECK_Y + 5.6, 0]}>
        <cylinderGeometry args={[0.35, 0.28, 0.3, 12, 1, true]} />
        <meshStandardMaterial color={WOOD} side={THREE.DoubleSide} />
      </mesh>
      {/* Sails */}
      <Sail x={0.9} y={DECK_Y + 2.4} width={2.8} height={2.3} texture={mainSailTex} billow={0.4} />
      <Sail x={0.9} y={DECK_Y + 4.5} width={2.2} height={1.4} texture={sailTex} billow={0.3} />
      <Sail x={-0.9} y={DECK_Y + 2.6} width={2.3} height={1.9} texture={sailTex} billow={0.35} />
      {/* Jib (layar segitiga depan) */}
      <mesh position={[2.6, DECK_Y + 2.2, 0]} rotation-y={Math.PI / 2}>
        <shapeGeometry
          args={[
            (() => {
              const t = new THREE.Shape();
              t.moveTo(-1.6, -1.3);
              t.lineTo(0, 2.6);
              t.lineTo(0, -1.3);
              return t;
            })(),
          ]}
        />
        <meshStandardMaterial color="#efe4c8" side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      {/* Jolly Roger flag */}
      <mesh ref={flagRef} position={[0.9, DECK_Y + 6.9, 0.45]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.9, 0.6]} />
        <meshStandardMaterial map={flagTex} side={THREE.DoubleSide} />
      </mesh>

      {/* Crew */}
      {showCrew &&
        crewList.slice(0, crewCount).map((c, i) => (
          <Crew key={i} position={c.pos} rotationY={c.rot} pose={c.pose} shirt={c.shirt} hat={c.hat} phase={i * 1.7} />
        ))}
      {/* Captain at helm */}
      {showCaptain && (
        <Crew position={[-2.25, DECK_Y + 0.92, 0]} rotationY={0} pose="helm" shirt="#7f1d1d" hat="tricorn" phase={0.3} />
      )}
    </group>
  );
}

// ── Seagull ─────────────────────────────────────────────────────────────

export function Seagull({ radius = 9, height = 9, speed = 0.35, phase = 0 }: { radius?: number; height?: number; speed?: number; phase?: number }) {
  const ref = useRef<THREE.Group>(null);
  const wl = useRef<THREE.Mesh>(null);
  const wr = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + phase;
    if (ref.current) {
      ref.current.position.set(Math.cos(t) * radius, height + Math.sin(t * 3) * 0.6, Math.sin(t) * radius);
      ref.current.rotation.y = -t;
    }
    const flap = Math.sin(clock.elapsedTime * 8 + phase) * 0.6;
    if (wl.current) wl.current.rotation.x = flap;
    if (wr.current) wr.current.rotation.x = -flap;
  });
  return (
    <group ref={ref}>
      <mesh ref={wl} position={[0, 0, 0.3]}>
        <boxGeometry args={[0.18, 0.02, 0.6]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh ref={wr} position={[0, 0, -0.3]}>
        <boxGeometry args={[0.18, 0.02, 0.6]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh>
        <capsuleGeometry args={[0.06, 0.25, 4, 6]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </group>
  );
}
