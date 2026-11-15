"use client";

/**
 * Komponen scene laut sunset realistis (three.js):
 * - SunsetSky      : langit fisik (Preetham) + awan volumetrik + environment map PBR
 * - SunsetOcean    : air reflektif dengan ombak Gerstner (bergerak 3D) + riak normal map
 * - GalleonShip    : model kapal galleon realistis (Poly Haven, CC0) + kru & kapten di kemudi
 * - SunsetLights   : pencahayaan matahari terbenam
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GERSTNER_GLSL, WAVE_TIME_SCALE, sampleWaveHeight, wavesAsVec4Array } from "./waves";
import { ShipDeckCrew } from "./RealisticCrew";
import { precompileObjectAsync } from "./RiggedHumanCrew";

export type OceanQuality = "high" | "low";

export interface ShipPose {
  x: number;
  y: number;
  z: number;
  pitch: number;
  roll: number;
}

/**
 * Arah matahari sore (sunset):
 * - Dari kamera login (menghadap -Z): matahari berada di belakang kapal sehingga kapal & kru tampak siluet keemasan.
 * - Dari POV Kapten (menghadap +X menuju pulau): matahari berada di samping kiri-depan sehingga pulau pasir putih & JTT08 terang terkena sinar senja.
 */
export function getSunDirection(elevationDeg = 4.2, azimuthOffset = -0.38): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = Math.PI + azimuthOffset;
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

export const SUNSET_FOG_COLOR = "#c4927a";
export const SUN_LIGHT_COLOR = "#ffba82";

function applySkyUniforms(sky: Sky, sun: THREE.Vector3, withClouds: boolean) {
  const u = sky.material.uniforms;
  u.turbidity.value = 9.2;
  u.rayleigh.value = 2.8;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.85;
  u.sunPosition.value.copy(sun);
  if (u.cloudCoverage) {
    u.cloudCoverage.value = withClouds ? 0.38 : 0.0;
    u.cloudDensity.value = 0.5;
    u.cloudElevation.value = 0.62;
    u.cloudScale.value = 0.00018;
    u.cloudSpeed.value = 0.000012;
  }
}

// ── Langit Sunset ─────────────────────────────────────────────

let _cachedSunsetEnvRT: THREE.WebGLRenderTarget | null = null;

function createSunsetEquirectDataTexture(): THREE.DataTexture {
  const w = 32;
  const h = 16;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1); // 0 = bawah (laut gelap), 1 = atas (langit zenith)
    let r = 24;
    let g = 20;
    let b = 42;
    if (v < 0.45) {
      const k = v / 0.45;
      r = 22 + k * 60;
      g = 32 + k * 46;
      b = 54 + k * 28;
    } else if (v < 0.56) {
      const k = (v - 0.45) / 0.11;
      r = 82 + k * 173;
      g = 78 + k * 102;
      b = 82 + k * 34;
    } else {
      const k = (v - 0.56) / 0.44;
      r = 255 - k * 226;
      g = 180 - k * 158;
      b = 116 - k * 68;
    }
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = Math.round(r);
      data[i + 1] = Math.round(g);
      data[i + 2] = Math.round(b);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function SunsetSky({ sun }: { sun: THREE.Vector3 }) {
  const { gl, scene } = useThree();

  const sky = useMemo(() => {
    const s = new Sky();
    s.scale.setScalar(10000);
    applySkyUniforms(s, sun, true);
    return s;
  }, [sun]);

  useEffect(() => {
    // Environment map gradien senja ringan (<5ms) langsung siap di frame 0 agar material kapal & kru tidak dikompilasi dua kali
    const pmrem = new THREE.PMREMGenerator(gl);
    const eqTex = createSunsetEquirectDataTexture();
    const rt = pmrem.fromEquirectangular(eqTex);
    _cachedSunsetEnvRT = rt;
    scene.environment = rt.texture;
    eqTex.dispose();
    pmrem.dispose();

    return () => {
      if (scene.environment === rt.texture) {
        scene.environment = null;
      }
      if (_cachedSunsetEnvRT === rt) {
        _cachedSunsetEnvRT = null;
      }
      rt.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    return () => {
      sky.geometry.dispose();
      sky.material.dispose();
    };
  }, [sky]);

  useFrame(({ camera, clock }) => {
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
    `float crest = smoothstep( 0.55, 1.9, vWaveHeight );
     float backlit = pow( max( 0.0, dot( normalize( vec3( -sunDirection.x, 0.0, -sunDirection.z ) ), -eyeDirection ) ), 2.0 );
     outgoingLight += crestColor * crest * ( 0.05 + 0.18 * backlit );
     outgoingLight = mix( outgoingLight, vec3( 0.95, 0.82, 0.72 ) * sunColor * 0.25, smoothstep( 1.5, 2.4, vWaveHeight ) * 0.25 );
     gl_FragColor = vec4( outgoingLight, alpha );`
  );
  return out;
}

// ── Laut ──────────────────────────────────────────────────────

let _fallbackWaterNormals: THREE.DataTexture | null = null;
let _loadedWaterNormals: THREE.Texture | null = null;

function getFallbackWaterNormals(): THREE.DataTexture {
  if (_fallbackWaterNormals) return _fallbackWaterNormals;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * tau;
      const v = (y / size) * tau;
      const nx = Math.sin(u * 2 + Math.cos(v * 2)) * 26 + Math.cos(u * 5 - v * 3) * 14;
      const ny = Math.cos(v * 2 + Math.sin(u * 3)) * 26 + Math.sin(u * 3 + v * 5) * 14;
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, Math.round(128 + nx)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(128 + ny)));
      data[i + 2] = 250;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  _fallbackWaterNormals = tex;
  return tex;
}

export function SunsetOcean({
  sun,
  quality = "high",
  flowTimeScale = 1,
}: {
  sun: THREE.Vector3;
  quality?: OceanQuality;
  flowTimeScale?: number;
}) {
  const { camera } = useThree();
  const initialNormals = useMemo(() => _loadedWaterNormals ?? getFallbackWaterNormals(), []);

  useEffect(() => {
    // Layer 1 dipakai untuk awak manusia agar terlihat di kamera utama tetapi dilewati mirrorCamera refleksi air
    camera.layers.enable(1);
  }, [camera]);

  const water = useMemo(() => {
    initialNormals.wrapS = initialNormals.wrapT = THREE.RepeatWrapping;
    const geo =
      quality === "high"
        ? buildPolarGrid(105, 144, 0.85, 1.064)
        : buildPolarGrid(44, 60, 1.4, 1.13);

    const w = new Water(geo, {
      textureWidth: quality === "high" ? 256 : 128,
      textureHeight: quality === "high" ? 256 : 128,
      waterNormals: initialNormals,
      sunDirection: sun.clone(),
      sunColor: new THREE.Color("#ffc08a"),
      waterColor: new THREE.Color("#0b2f42"),
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

    const mirrorTex = mat.uniforms.mirrorSampler?.value as THREE.Texture | undefined;
    if (mirrorTex && quality === "low") {
      mirrorTex.generateMipmaps = false;
      mirrorTex.minFilter = THREE.LinearFilter;
    }

    if (quality === "low") {
      const origBeforeRender = w.onBeforeRender;
      let reflTick = 0;
      w.onBeforeRender = function (renderer, scene, cam, geometry, material, group) {
        if (reflTick++ % 3 !== 0) return;
        origBeforeRender.call(this, renderer, scene, cam, geometry, material, group);
      };
    }

    w.rotation.x = -Math.PI / 2;
    w.frustumCulled = false;
    return w;
  }, [initialNormals, quality, sun]);

  useEffect(() => {
    if (_loadedWaterNormals) {
      const mat = water.material as THREE.ShaderMaterial;
      if (mat.uniforms.normalSampler) {
        mat.uniforms.normalSampler.value = _loadedWaterNormals;
      }
      return;
    }
    let cancelled = false;
    new THREE.TextureLoader().load("/textures/waternormals.jpg", (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      _loadedWaterNormals = tex;
      if (!cancelled) {
        const mat = water.material as THREE.ShaderMaterial;
        if (mat.uniforms.normalSampler) {
          mat.uniforms.normalSampler.value = tex;
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [water]);

  useEffect(() => {
    return () => {
      water.geometry.dispose();
      (water.material as THREE.ShaderMaterial).dispose();
    };
  }, [water]);

  useFrame(({ camera, clock }, delta) => {
    const u = (water.material as THREE.ShaderMaterial).uniforms;
    u.time.value += delta * 0.55 * flowTimeScale;
    u.waveTime.value = clock.elapsedTime * WAVE_TIME_SCALE;
    water.position.x = camera.position.x;
    water.position.z = camera.position.z;
  });

  return <primitive object={water} />;
}

// ── Kapal Galleon + Kru & Kapten di Kemudi ─────────────────────

export const SHIP_URL_HIGH = "/models/ship-desktop.glb";
export const SHIP_URL_LOW = "/models/ship-mobile.glb";

const _v = new THREE.Vector3();

const _shipMatCache = new WeakMap<THREE.Material, THREE.Material>();

function getSharedShipMaterial(mat: THREE.Material): THREE.Material {
  const cached = _shipMatCache.get(mat);
  if (cached) return cached;
  const sm = mat as THREE.MeshStandardMaterial;
  if (sm.isMeshStandardMaterial) {
    sm.envMapIntensity = 0.9;
  }
  _shipMatCache.set(mat, mat);
  return mat;
}

export function GalleonShip({
  quality = "high",
  position,
  heading,
  speed = 0,
  travelOffset = 0,
  inPov = false,
  shipPoseRef,
  progressive = false,
  mobileCompact = false,
}: {
  quality?: OceanQuality;
  position: [number, number, number];
  /** Rotasi Y (radian). Haluan model menghadap sumbu +X lokal. */
  heading: number;
  /** Kecepatan maju konstan (m/detik) */
  speed?: number;
  /** Jarak maju tambahan yang dikendalikan dari luar (mis. saat akselerasi ke pulau) */
  travelOffset?: number;
  /** Mode First-Person POV Kapten */
  inPov?: boolean;
  /** Ref opsional agar kamera luar dapat mengikuti posisi & oleng kapal secara presisi */
  shipPoseRef?: React.MutableRefObject<ShipPose>;
  /** Kompilasi shader asinkron & tampilkan dek bertahap agar animasi ombak tidak macet saat login */
  progressive?: boolean;
  /** Mode HP super ringan: kurangi jumlah & detail awak manusia di dek login */
  mobileCompact?: boolean;
}) {
  const gltf = useLoader(GLTFLoader, quality === "high" ? SHIP_URL_HIGH : SHIP_URL_LOW, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  const { gl, camera, scene } = useThree();
  const wheelAngleRef = useRef(0);
  const shipMeshRef = useRef<THREE.Group>(null);
  const [shipReady, setShipReady] = useState(!progressive);
  const [crewMounted, setCrewMounted] = useState(!progressive);

  const model = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        // Biarkan seluruh layar dan tiang mast kapal 100% utuh (tidak dipotong/dikecilkan saat berlayar)
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        const origMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const sharedMats = origMats.map(getSharedShipMaterial);
        mesh.material = Array.isArray(mesh.material) ? sharedMats : sharedMats[0];
      }
    });
    return root;
  }, [gltf]);

  useEffect(() => {
    if (!progressive || shipReady) return;
    return precompileObjectAsync(gl, shipMeshRef.current, camera, scene, () => {
      setShipReady(true);
    });
  }, [progressive, shipReady, model, gl, camera, scene]);

  useEffect(() => {
    if (!progressive || !shipReady || crewMounted) return;
    const raf = requestAnimationFrame(() => setCrewMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [progressive, shipReady, crewMounted]);

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

    // Sudut putar roda kemudi kayu (stabil agar kedua tangan kapten tetap terlihat jelas di POV)
    wheelAngleRef.current =
      Math.sin(t * (inPov ? 1.85 : 1.35)) * (inPov ? 0.22 : 0.34) +
      Math.sin(t * 0.85) * (inPov ? 0.08 : 0.14);

    const totalDist = travel.current + travelOffset;
    const fx = Math.cos(heading);
    const fz = -Math.sin(heading);
    const px = position[0] + fx * totalDist;
    const pz = position[2] + fz * totalDist;
    g.position.set(px, position[1], pz);
    g.rotation.y = heading;

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
    const targetPitch = Math.atan2(hBow - hStern, 25) * 0.65;
    const targetRoll = -Math.atan2(hStar - hPort, 8.4) * 0.5;

    const s = smooth.current;
    if (!s.init) {
      s.y = targetY;
      s.pitch = targetPitch;
      s.roll = targetRoll;
      s.init = true;
    }
    const k = 1 - Math.exp(-delta * 2.4);
    s.y += (targetY - s.y) * k;
    s.pitch += (targetPitch - s.pitch) * k;
    s.roll += (targetRoll - s.roll) * k;

    tilt.position.y = s.y;
    tilt.rotation.z = s.pitch;
    tilt.rotation.x = s.roll;
    g.updateMatrixWorld(true);

    if (shipPoseRef) {
      shipPoseRef.current.x = px;
      shipPoseRef.current.y = position[1] + s.y;
      shipPoseRef.current.z = pz;
      shipPoseRef.current.pitch = s.pitch;
      shipPoseRef.current.roll = s.roll;
    }
  });

  return (
    <group ref={headingRef}>
      <group ref={tiltRef}>
        {/* Cahaya hangat lentera kompas selalu aktif agar jumlah lampu shader stabil sejak frame 0 */}
        <pointLight position={[-5.65, 7.53, 0.15]} color="#ffcf87" intensity={2.6} distance={7.5} />
        <group ref={shipMeshRef} visible={shipReady}>
          <primitive object={model} />
        </group>
        {/* Awak kapal & Kapten di kemudi kapal dimuat bertahap setelah kapal tampil */}
        {(!progressive || crewMounted) && (
          <Suspense fallback={null}>
            <ShipDeckCrew
              inPov={inPov}
              wheelAngleRef={wheelAngleRef}
              progressive={progressive}
              mobileCompact={mobileCompact}
            />
          </Suspense>
        )}
      </group>
    </group>
  );
}

// ── Cahaya Sunset ─────────────────────────────────────────────

export function SunsetLights({ sun, intensity = 2.8 }: { sun: THREE.Vector3; intensity?: number }) {
  const pos = useMemo(() => sun.clone().multiplyScalar(500).toArray() as [number, number, number], [sun]);
  return (
    <>
      <hemisphereLight args={["#ffe0be", "#223044", 0.78]} />
      <directionalLight position={pos} color={SUN_LIGHT_COLOR} intensity={intensity} />
    </>
  );
}

/** Kabut tipis sunset agar laut menyatu dengan horizon */
export function SunsetFog({ density = 0.00018 }: { density?: number }) {
  return <fogExp2 attach="fog" args={[SUNSET_FOG_COLOR, density]} />;
}
