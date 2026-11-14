"use client";

/**
 * Komponen scene laut sunset realistis (three.js):
 * - SunsetSky      : langit fisik (Preetham) + awan volumetrik + environment map PBR
 * - SunsetOcean    : air reflektif dengan ombak Gerstner (bergerak 3D) + riak normal map
 * - GalleonShip    : model kapal galleon realistis (Poly Haven, CC0) yang oleng mengikuti ombak
 * - SunsetLights   : pencahayaan matahari terbenam
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GERSTNER_GLSL, WAVE_TIME_SCALE, sampleWaveHeight, wavesAsVec4Array } from "./waves";

export type OceanQuality = "high" | "low";

/** Arah matahari: elevasi rendah (sunset) tepat di depan kamera (arah -Z) */
export function getSunDirection(elevationDeg = 2.6, azimuthOffset = 0.02): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = Math.PI + azimuthOffset;
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

export const SUNSET_FOG_COLOR = "#b98a78";
export const SUN_LIGHT_COLOR = "#ffb27a";

function applySkyUniforms(sky: Sky, sun: THREE.Vector3, withClouds: boolean) {
  const u = sky.material.uniforms;
  u.turbidity.value = 10;
  u.rayleigh.value = 3.2;
  u.mieCoefficient.value = 0.0055;
  u.mieDirectionalG.value = 0.86;
  u.sunPosition.value.copy(sun);
  if (u.cloudCoverage) {
    u.cloudCoverage.value = withClouds ? 0.42 : 0.0;
    u.cloudDensity.value = 0.55;
    u.cloudElevation.value = 0.62;
    u.cloudScale.value = 0.00018;
    u.cloudSpeed.value = 0.000012;
  }
}

// ── Langit Sunset ─────────────────────────────────────────────

export function SunsetSky({ sun }: { sun: THREE.Vector3 }) {
  const { gl, scene } = useThree();

  const sky = useMemo(() => {
    const s = new Sky();
    s.scale.setScalar(10000);
    applySkyUniforms(s, sun, true);
    return s;
  }, [sun]);

  // Environment map dari langit yang sama → kayu & layar kapal memantulkan cahaya senja secara fisik
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(50);
    applySkyUniforms(envSky, sun, false);
    envScene.add(envSky);
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 200);
    scene.environment = rt.texture;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
      envSky.geometry.dispose();
      envSky.material.dispose();
    };
  }, [gl, scene, sun]);

  useEffect(() => {
    return () => {
      sky.geometry.dispose();
      sky.material.dispose();
    };
  }, [sky]);

  useFrame(({ camera, clock }) => {
    // Kotak langit selalu mengikuti kamera agar horizon tak pernah terpotong
    sky.position.copy(camera.position);
    if (sky.material.uniforms.time) sky.material.uniforms.time.value = clock.elapsedTime;
  });

  return <primitive object={sky} />;
}

// ── Grid polar: rapat dekat kamera, renggang ke horizon ─────────

function buildPolarGrid(rings: number, segments: number, firstStep: number, growth: number) {
  const positions: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 0.5];
  const radii: number[] = [];
  let r = 0;
  let step = firstStep;
  for (let i = 0; i < rings; i++) {
    r += step;
    step *= growth;
    radii.push(r);
  }
  const maxR = radii[radii.length - 1];
  for (const rad of radii) {
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      positions.push(x, y, 0);
      uvs.push(0.5 + x / (2 * maxR), 0.5 + y / (2 * maxR));
    }
  }
  const indices: number[] = [];
  // Kipas pusat
  for (let s = 0; s < segments; s++) {
    const a = 1 + s;
    const b = 1 + ((s + 1) % segments);
    indices.push(0, a, b);
  }
  for (let ring = 0; ring < rings - 1; ring++) {
    const base0 = 1 + ring * segments;
    const base1 = 1 + (ring + 1) * segments;
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      const a = base0 + s;
      const b = base0 + s1;
      const c = base1 + s;
      const d = base1 + s1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const WATER_VERTEX_MAIN = /* glsl */ `
  uniform mat4 textureMatrix;
  uniform float time;

  varying vec4 mirrorCoord;
  varying vec4 worldPosition;

  ${GERSTNER_GLSL}

  #include <common>
  #include <fog_pars_vertex>
  #include <shadowmap_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    vec4 wp = modelMatrix * vec4( position, 1.0 );
    float dist = distance( wp.xz, cameraPosition.xz );

    vec3 tangent = vec3( 1.0, 0.0, 0.0 );
    vec3 binormal = vec3( 0.0, 0.0, 1.0 );
    vec3 disp = vec3( 0.0 );
    for ( int i = 0; i < WAVE_COUNT; i++ ) {
      float wl = waves[i].w;
      // Ombak kecil memudar di kejauhan agar tidak aliasing / berkedip
      float fade = 1.0 - smoothstep( wl * 14.0, wl * 45.0, dist );
      disp += gerstner( waves[i], wp.xz, fade, tangent, binormal );
    }
    wp.xyz += disp;

    vWaveNormal = normalize( cross( binormal, tangent ) );
    vWaveHeight = disp.y;

    worldPosition = wp;
    mirrorCoord = textureMatrix * wp;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;

    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
    #include <shadowmap_vertex>
  }
`;

function patchWaterFragment(src: string): string {
  let out = src.replace(
    /varying vec4 worldPosition;/,
    "varying vec4 worldPosition;\nvarying vec3 vWaveNormal;\nvarying float vWaveHeight;\nuniform vec3 crestColor;"
  );
  out = out.replace(
    /vec3 surfaceNormal = normalize\(\s*noise\.xzy \* vec3\(\s*1\.5,\s*1\.0,\s*1\.5\s*\)\s*\);/,
    `vec3 detailN = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
     vec3 surfaceNormal = normalize( vWaveNormal + vec3( detailN.x, 0.0, detailN.z ) * 0.55 );`
  );
  out = out.replace(
    /gl_FragColor = vec4\(\s*outgoingLight,\s*alpha\s*\);/,
    `// Puncak ombak tertembus cahaya senja (subsurface) + buih tipis di puncak
     float crest = smoothstep( 0.55, 1.9, vWaveHeight );
     float backlit = pow( max( 0.0, dot( normalize( vec3( -sunDirection.x, 0.0, -sunDirection.z ) ), -eyeDirection ) ), 2.0 );
     outgoingLight += crestColor * crest * ( 0.05 + 0.18 * backlit );
     outgoingLight = mix( outgoingLight, vec3( 0.95, 0.82, 0.72 ) * sunColor * 0.25, smoothstep( 1.5, 2.4, vWaveHeight ) * 0.25 );
     gl_FragColor = vec4( outgoingLight, alpha );`
  );
  return out;
}

// ── Laut ──────────────────────────────────────────────────────

export function SunsetOcean({
  sun,
  quality = "high",
}: {
  sun: THREE.Vector3;
  quality?: OceanQuality;
}) {
  const normals = useLoader(THREE.TextureLoader, "/textures/waternormals.jpg");

  const water = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    const geo =
      quality === "high"
        ? buildPolarGrid(185, 256, 0.55, 1.035)
        : buildPolarGrid(120, 144, 0.9, 1.05);

    const w = new Water(geo, {
      textureWidth: quality === "high" ? 512 : 256,
      textureHeight: quality === "high" ? 512 : 256,
      waterNormals: normals,
      sunDirection: sun.clone(),
      sunColor: new THREE.Color("#ffc08a"),
      waterColor: new THREE.Color("#0b2a3a"),
      distortionScale: 3.2,
      fog: true,
    });
    const mat = w.material as THREE.ShaderMaterial;
    mat.uniforms.waves = { value: wavesAsVec4Array().map((v) => new THREE.Vector4(...v)) };
    mat.uniforms.waveTime = { value: 0 };
    mat.uniforms.crestColor = { value: new THREE.Color("#ff9a5c") };
    mat.uniforms.size.value = 3.2;
    mat.vertexShader = WATER_VERTEX_MAIN;
    mat.fragmentShader = patchWaterFragment(mat.fragmentShader);
    mat.needsUpdate = true;
    w.rotation.x = -Math.PI / 2;
    w.frustumCulled = false;
    return w;
  }, [normals, quality, sun]);

  useEffect(() => {
    return () => {
      water.geometry.dispose();
      (water.material as THREE.ShaderMaterial).dispose();
    };
  }, [water]);

  useFrame(({ camera, clock }, delta) => {
    const u = (water.material as THREE.ShaderMaterial).uniforms;
    u.time.value += delta * 0.55;
    u.waveTime.value = clock.elapsedTime * WAVE_TIME_SCALE;
    // Grid laut mengikuti kamera (displacement memakai koordinat dunia → tetap mulus)
    water.position.x = camera.position.x;
    water.position.z = camera.position.z;
  });

  return <primitive object={water} />;
}

// ── Kapal Galleon ─────────────────────────────────────────────

export const SHIP_URL_HIGH = "/models/ship-desktop.glb";
export const SHIP_URL_LOW = "/models/ship-mobile.glb";

const _v = new THREE.Vector3();

export function GalleonShip({
  quality = "high",
  position,
  heading,
  speed = 0,
}: {
  quality?: OceanQuality;
  position: [number, number, number];
  /** Rotasi Y (radian). Haluan model menghadap sumbu +X lokal. */
  heading: number;
  /** Kecepatan maju (m/detik) sepanjang arah haluan */
  speed?: number;
}) {
  const gltf = useLoader(GLTFLoader, quality === "high" ? SHIP_URL_HIGH : SHIP_URL_LOW, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  const model = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sm = m as THREE.MeshStandardMaterial;
          if (sm.isMeshStandardMaterial) {
            sm.envMapIntensity = 0.85;
            sm.needsUpdate = true;
          }
        }
      }
    });
    return root;
  }, [gltf]);

  const headingRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const travel = useRef(0);
  const smooth = useRef({ y: 0, pitch: 0, roll: 0, init: false });

  useFrame(({ clock }, delta) => {
    const g = headingRef.current;
    const tilt = tiltRef.current;
    if (!g || !tilt) return;
    const t = clock.elapsedTime;
    travel.current += speed * delta;

    const fx = Math.cos(heading);
    const fz = -Math.sin(heading);
    const px = position[0] + fx * travel.current;
    const pz = position[2] + fz * travel.current;
    g.position.set(px, position[1], pz);
    g.rotation.y = heading;

    // Titik sampel lambung (ruang lokal → dunia): haluan, buritan, kiri, kanan
    const sample = (lx: number, lz: number) => {
      _v.set(lx, 0, lz).applyAxisAngle(THREE.Object3D.DEFAULT_UP, heading);
      return sampleWaveHeight(px + _v.x, pz + _v.z, t);
    };
    const hBow = sample(15, 0);
    const hStern = sample(-10, 0);
    const hPort = sample(3, -4.2);
    const hStar = sample(3, 4.2);
    const hMid = sample(3, 0);

    const targetY = (hBow + hStern + hPort + hStar + hMid * 2) / 6 - 0.35;
    const targetPitch = Math.atan2(hBow - hStern, 25) * 0.7;
    const targetRoll = -Math.atan2(hStar - hPort, 8.4) * 0.55;

    const s = smooth.current;
    if (!s.init) {
      s.y = targetY;
      s.pitch = targetPitch;
      s.roll = targetRoll;
      s.init = true;
    }
    // Inersia kapal berat: respon lambat & halus
    const k = 1 - Math.exp(-delta * 2.2);
    s.y += (targetY - s.y) * k;
    s.pitch += (targetPitch - s.pitch) * k;
    s.roll += (targetRoll - s.roll) * k;

    tilt.position.y = s.y;
    tilt.rotation.z = s.pitch;
    tilt.rotation.x = s.roll;
  });

  return (
    <group ref={headingRef}>
      <group ref={tiltRef}>
        <primitive object={model} />
      </group>
    </group>
  );
}

// ── Cahaya Sunset ─────────────────────────────────────────────

export function SunsetLights({ sun, intensity = 2.6 }: { sun: THREE.Vector3; intensity?: number }) {
  const pos = useMemo(() => sun.clone().multiplyScalar(500).toArray() as [number, number, number], [sun]);
  return (
    <>
      <hemisphereLight args={["#ffcfa8", "#1b2436", 0.35]} />
      <directionalLight position={pos} color={SUN_LIGHT_COLOR} intensity={intensity} />
    </>
  );
}

/** Kabut tipis sunset agar laut menyatu dengan horizon */
export function SunsetFog({ density = 0.00022 }: { density?: number }) {
  return <fogExp2 attach="fog" args={[SUNSET_FOG_COLOR, density]} />;
}
