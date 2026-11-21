"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export type CrewRole = "captain" | "haul" | "walk" | "lookout" | "officer";
export type HumanModelVariant = "captain" | "sailor1" | "sailor2" | "sailor3";

const MODEL_URLS: Record<HumanModelVariant, string> = {
  captain: "/models/human-captain.glb",
  sailor1: "/models/human-sailor-1.glb",
  sailor2: "/models/human-sailor-2.glb",
  sailor3: "/models/human-sailor-3.glb",
};

interface RigBones {
  hips: THREE.Object3D | null;
  spine: THREE.Object3D | null;
  spine1: THREE.Object3D | null;
  spine2: THREE.Object3D | null;
  neck: THREE.Object3D | null;
  head: THREE.Object3D | null;
  leftShoulder: THREE.Object3D | null;
  leftArm: THREE.Object3D | null;
  leftForeArm: THREE.Object3D | null;
  leftHand: THREE.Object3D | null;
  leftFingerBase: THREE.Object3D | null;
  rightShoulder: THREE.Object3D | null;
  rightArm: THREE.Object3D | null;
  rightForeArm: THREE.Object3D | null;
  rightHand: THREE.Object3D | null;
  rightFingerBase: THREE.Object3D | null;
  leftUpLeg: THREE.Object3D | null;
  leftLeg: THREE.Object3D | null;
  leftFoot: THREE.Object3D | null;
  rightUpLeg: THREE.Object3D | null;
  rightLeg: THREE.Object3D | null;
  rightFoot: THREE.Object3D | null;
  leftFingers: THREE.Object3D[][];
  rightFingers: THREE.Object3D[][];
  leftThumb: THREE.Object3D[];
  rightThumb: THREE.Object3D[];
  restLocalQ: Map<THREE.Object3D, THREE.Quaternion>;
  restWorldQ: Map<THREE.Object3D, THREE.Quaternion>;
  restWorldP: Map<THREE.Object3D, THREE.Vector3>;
  restHipsPos: THREE.Vector3;
  armLen: number;
  foreLen: number;
}

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _vX = new THREE.Vector3();
const _vY = new THREE.Vector3();
const _vZ = new THREE.Vector3();
const _vElbow = new THREE.Vector3();
const _vShoulder = new THREE.Vector3();
const _vDirU = new THREE.Vector3();
const _vDirF = new THREE.Vector3();
const _vPlaneN = new THREE.Vector3();
const _vPalm = new THREE.Vector3();
const _vHandDir = new THREE.Vector3();
const _qParent = new THREE.Quaternion();
const _qTarget = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();
const _qTmp = new THREE.Quaternion();
const _eTmp = new THREE.Euler(0, 0, 0, "XYZ");
const _mBasis = new THREE.Matrix4();
const _mRootInv = new THREE.Matrix4();
const _qRootInv = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);

function configureLoader(loader: THREE.Loader) {
  (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
}

/** Preload seluruh model awak manusia kualitas tinggi secara paralel */
export function preloadHumanModels(_mobileOnly = false) {
  (Object.values(MODEL_URLS) as string[]).forEach((url) => {
    useLoader.preload(GLTFLoader, url, configureLoader);
  });
}

const _sharedDeckMaterials = new WeakMap<THREE.Material, THREE.Material>();
const _sharedArmsMaterials = new WeakMap<THREE.Material, THREE.Material>();
const _sharedEyeMaterials = new WeakMap<THREE.Material, THREE.Material>();

function getSharedHumanMaterial(
  mat: THREE.Material,
  armsOnly: boolean,
  isEye = false
): THREE.Material {
  const cache = isEye
    ? _sharedEyeMaterials
    : armsOnly
    ? _sharedArmsMaterials
    : _sharedDeckMaterials;
  const cached = cache.get(mat);
  if (cached) return cached;

  const sm = (mat as THREE.MeshStandardMaterial).clone();
  if (sm.isMeshStandardMaterial) {
    if (isEye) {
      sm.roughness = 0.12;
      sm.metalness = 0.04;
      sm.envMapIntensity = 1.45;
    } else {
      sm.envMapIntensity = armsOnly ? 1.38 : 1.32;
      sm.roughness = armsOnly ? 0.46 : 0.5;
      sm.metalness = 0.04;
      if (sm.normalMap) {
        sm.normalScale = new THREE.Vector2(armsOnly ? 1.45 : 1.3, armsOnly ? 1.45 : 1.3);
      }
      if (sm.map) {
        sm.map.anisotropy = 4;
      }
    }
  }
  cache.set(mat, sm);
  return sm;
}

const _armOnlyGeoCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Menyaring segitiga SkinnedMesh agar hanya menyisakan lengan bawah, manset & tangan (tanpa badan/torso/kepala) */
function filterArmOnlyGeometry(skinned: THREE.SkinnedMesh) {
  const geo = skinned.geometry;
  const cached = _armOnlyGeoCache.get(geo);
  if (cached) {
    skinned.geometry = cached;
    return;
  }

  const idx = geo.index;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  if (!idx || !si || !sw) return;

  const keepBones = new Set<number>();
  const torsoBones = new Set<number>();
  skinned.skeleton.bones.forEach((b, i) => {
    if (
      /^(Left|Right)(Arm|ForeArm|Hand|FingerBase)/i.test(b.name) ||
      /^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)/i.test(b.name)
    ) {
      keepBones.add(i);
    }
    if (/^(Hips|Spine|Spine1|Spine2|Neck|Head|LeftShoulder|RightShoulder)/i.test(b.name)) {
      torsoBones.add(i);
    }
  });

  const isArmVert = (vi: number) => {
    let armW = 0;
    let torsoW = 0;
    const bIdx = [si.getX(vi), si.getY(vi), si.getZ(vi), si.getW(vi)];
    const bW = [sw.getX(vi), sw.getY(vi), sw.getZ(vi), sw.getW(vi)];
    for (let k = 0; k < 4; k++) {
      if (keepBones.has(bIdx[k])) armW += bW[k];
      if (torsoBones.has(bIdx[k])) torsoW += bW[k];
    }
    return armW > 0.8 && torsoW < 0.15;
  };

  const kept: number[] = [];
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const b = idx.getX(i + 1);
    const c = idx.getX(i + 2);
    if (isArmVert(a) && isArmVert(b) && isArmVert(c)) {
      kept.push(a, b, c);
    }
  }

  // Kloning geometry sebelum mengubah index agar mesh awak kapal di dek tidak ikut terpotong
  const clonedGeo = geo.clone();
  clonedGeo.setIndex(kept);
  _armOnlyGeoCache.set(geo, clonedGeo);
  skinned.geometry = clonedGeo;
}

/** Mengkloning GLTF human dengan aman via SkeletonUtils + menyetel material kulit & kain */
function useHumanRigClone(
  variant: HumanModelVariant,
  hideHead = false,
  armsOnly = false,
  _mobileQuality = false
) {
  const modelUrl = MODEL_URLS[variant];
  const gltf = useLoader(GLTFLoader, modelUrl, configureLoader);

  return useMemo(() => {
    const root = cloneSkinned(gltf.scene) as THREE.Object3D;
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        if (armsOnly && !/H_DDS_HighRes/i.test(mesh.name)) {
          mesh.visible = false;
          return;
        }
        // Sembunyikan gigi & kelenjar mata bagian dalam (~15.7k segitiga tak terlihat per karakter)
        if (/^h_(Teeth|.*gland)/i.test(mesh.name)) {
          mesh.visible = false;
          return;
        }
        if (armsOnly && (mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          filterArmOnlyGeometry(mesh as THREE.SkinnedMesh);
        }

        // Cegah bounding sphere T-pose lama memangkas mesh saat tangan diturunkan / digerakkan
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        // Pisahkan ke layer 1 agar mirrorCamera refleksi air tidak ikut me-render ulang SkinnedMesh manusia
        mesh.layers.set(1);

        // Hapus morph targets yang tidak digunakan agar Three.js tidak mengalokasi DataArrayTexture CPU/GPU & shader morph
        if (mesh.geometry?.morphAttributes && Object.keys(mesh.geometry.morphAttributes).length > 0) {
          mesh.geometry.morphAttributes = {};
        }
        mesh.morphTargetInfluences = undefined;
        mesh.morphTargetDictionary = undefined;

        const isEyeMesh = /^h_[LR]_eye/i.test(mesh.name);
        const orig = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const shared = orig.map((mat) => getSharedHumanMaterial(mat, armsOnly, isEyeMesh));
        mesh.material = Array.isArray(mesh.material) ? shared : shared[0];
      }
    });

    const get = (name: string) => root.getObjectByName(name) ?? null;

    if (hideHead) {
      const neck = get("Neck");
      const head = get("Head");
      if (head) head.scale.setScalar(0.0001);
      if (neck) neck.scale.setScalar(0.0001);
    }

    const collectChain = (prefix: string) =>
      [1, 2, 3].map((idx) => get(`${prefix}${idx}`)).filter((b): b is THREE.Object3D => Boolean(b));

    const bones: RigBones = {
      hips: get("Hips"),
      spine: get("Spine"),
      spine1: get("Spine1"),
      spine2: get("Spine2"),
      neck: get("Neck"),
      head: get("Head"),
      leftShoulder: get("LeftShoulder"),
      leftArm: get("LeftArm"),
      leftForeArm: get("LeftForeArm"),
      leftHand: get("LeftHand"),
      leftFingerBase: get("LeftFingerBase"),
      rightShoulder: get("RightShoulder"),
      rightArm: get("RightArm"),
      rightForeArm: get("RightForeArm"),
      rightHand: get("RightHand"),
      rightFingerBase: get("RightFingerBase"),
      leftUpLeg: get("LeftUpLeg"),
      leftLeg: get("LeftLeg"),
      leftFoot: get("LeftFoot"),
      rightUpLeg: get("RightUpLeg"),
      rightLeg: get("RightLeg"),
      rightFoot: get("RightFoot"),
      leftFingers: [
        collectChain("LeftHandIndex"),
        collectChain("LeftHandMiddle"),
        collectChain("LeftHandRing"),
        collectChain("LeftHandPinky"),
      ],
      rightFingers: [
        collectChain("RightHandIndex"),
        collectChain("RightHandMiddle"),
        collectChain("RightHandRing"),
        collectChain("RightHandPinky"),
      ],
      leftThumb: collectChain("LeftHandThumb"),
      rightThumb: collectChain("RightHandThumb"),
      restLocalQ: new Map(),
      restWorldQ: new Map(),
      restWorldP: new Map(),
      restHipsPos: new THREE.Vector3(0, 0.996, -0.031),
      armLen: 0.262,
      foreLen: 0.243,
    };

    root.traverse((obj) => {
      bones.restLocalQ.set(obj, obj.quaternion.clone());
      bones.restWorldQ.set(obj, obj.getWorldQuaternion(new THREE.Quaternion()));
      bones.restWorldP.set(obj, obj.getWorldPosition(new THREE.Vector3()));
    });

    if (bones.hips) {
      bones.restHipsPos.copy(bones.hips.position);
    }

    const la = bones.leftArm ? bones.restWorldP.get(bones.leftArm) : null;
    const lf = bones.leftForeArm ? bones.restWorldP.get(bones.leftForeArm) : null;
    const lh = bones.leftHand ? bones.restWorldP.get(bones.leftHand) : null;
    if (la && lf && lh) {
      bones.armLen = Math.max(0.18, la.distanceTo(lf));
      bones.foreLen = Math.max(0.18, lf.distanceTo(lh));
    }

    return { root, bones };
  }, [gltf, hideHead, armsOnly]);
}

/** Membaca rotasi world relatif terhadap `root` karakter saat ini */
function getCharSpaceWorldQuat(obj: THREE.Object3D, rootInvQ: THREE.Quaternion, out: THREE.Quaternion) {
  obj.getWorldQuaternion(out);
  return out.premultiply(rootInvQ);
}

/** Membaca posisi titik tulang di koordinat lokal `root` karakter (+Z depan, +Y atas, +X kiri) */
function getCharSpacePos(obj: THREE.Object3D, rootInvM: THREE.Matrix4, out: THREE.Vector3) {
  obj.getWorldPosition(out);
  return out.applyMatrix4(rootInvM);
}

/** Sinkronkan matrix lokal & world 1 tulang terhadap parent tanpa traversal subtree berulang */
function syncSingleBoneWorld(bone: THREE.Object3D) {
  bone.updateMatrix();
  if (bone.parent) {
    bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld, bone.matrix);
  } else {
    bone.matrixWorld.copy(bone.matrix);
  }
}

/** Memutar tulang sebesar delta sudut pada ruang karakter dari pose rest, lalu menyinkronkan matrixWorld */
function applyBoneCharDelta(
  bone: THREE.Object3D | null,
  bones: RigBones,
  rootInvQ: THREE.Quaternion,
  ex: number,
  ey: number,
  ez: number
) {
  if (!bone || !bone.parent) return;
  const restWorld = bones.restWorldQ.get(bone);
  if (!restWorld) return;
  bone.parent.updateWorldMatrix(true, false);
  getCharSpaceWorldQuat(bone.parent, rootInvQ, _qParent);
  _eTmp.set(ex, ey, ez, "YXZ");
  _qDelta.setFromEuler(_eTmp);
  _qTarget.multiplyQuaternions(_qDelta, restWorld);
  bone.quaternion.copy(_qParent).invert().multiply(_qTarget);
  syncSingleBoneWorld(bone);
}

/** Memasang orientasi tulang dari arah +Y tulang dan referensi sumbu +Z pada ruang karakter */
function setBoneBasisChar(
  bone: THREE.Object3D | null,
  rootInvQ: THREE.Quaternion,
  desiredY: THREE.Vector3,
  desiredZRef: THREE.Vector3
) {
  if (!bone || !bone.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  getCharSpaceWorldQuat(bone.parent, rootInvQ, _qParent);

  _vY.copy(desiredY).normalize();
  _vZ.copy(desiredZRef).addScaledVector(_vY, -desiredZRef.dot(_vY));
  if (_vZ.lengthSq() < 1e-6) {
    _vZ.set(0, 0, Math.abs(_vY.z) < 0.9 ? 1 : 0);
    if (_vZ.lengthSq() < 1e-6) _vZ.set(1, 0, 0);
    _vZ.addScaledVector(_vY, -_vZ.dot(_vY));
  }
  _vZ.normalize();
  _vX.crossVectors(_vY, _vZ).normalize();
  _mBasis.makeBasis(_vX, _vY, _vZ);
  _qTarget.setFromRotationMatrix(_mBasis);

  bone.quaternion.copy(_qParent).invert().multiply(_qTarget);
  syncSingleBoneWorld(bone);
}

/** Solver analitik 2-tulang (UpperArm + ForeArm) + Hand di koordinat karakter (+Z depan, +Y atas, +X kiri) */
function solveArmIK(
  side: "left" | "right",
  bones: RigBones,
  rootInvM: THREE.Matrix4,
  rootInvQ: THREE.Quaternion,
  wristTarget: THREE.Vector3,
  elbowPole: THREE.Vector3,
  palmDir: THREE.Vector3,
  handAimDir: THREE.Vector3 | null,
  fingerCurl: number,
  thumbCurl = fingerCurl * 0.85
) {
  const arm = side === "left" ? bones.leftArm : bones.rightArm;
  const fore = side === "left" ? bones.leftForeArm : bones.rightForeArm;
  const hand = side === "left" ? bones.leftHand : bones.rightHand;
  const fingerBase = side === "left" ? bones.leftFingerBase : bones.rightFingerBase;
  const fingers = side === "left" ? bones.leftFingers : bones.rightFingers;
  const thumb = side === "left" ? bones.leftThumb : bones.rightThumb;

  if (!arm || !fore || !hand) return;

  arm.updateWorldMatrix(true, false);
  getCharSpacePos(arm, rootInvM, _vShoulder);

  // Jika tangan sedang menggenggam objek (fingerCurl > 0.5), mundurkan titik pergelangan (LeftHand/RightHand)
  // sejauh ~6.4 cm dari pusat genggaman telapak agar telapak & jari-jari tepat membungkus batang/pelek kemudi
  _vC.copy(wristTarget);
  if (handAimDir && fingerCurl > 0.5) {
    _vHandDir.copy(handAimDir).normalize();
    _vPalm.copy(palmDir).normalize();
    _vC.addScaledVector(_vHandDir, -0.064 * fingerCurl);
    _vC.addScaledVector(_vPalm, -0.022 * fingerCurl);
  }

  const l1 = bones.armLen;
  const l2 = bones.foreLen;
  _vA.subVectors(_vC, _vShoulder);
  const rawDist = _vA.length();
  const minD = Math.abs(l1 - l2) + 0.03;
  const maxD = l1 + l2 - 0.008;
  const d = THREE.MathUtils.clamp(rawDist, minD, maxD);
  if (rawDist > 1e-5) {
    _vA.divideScalar(rawDist);
  } else {
    _vA.set(0, -1, 0);
  }

  // Proyeksi pole vector untuk arah lengkungan siku alami
  _vB.subVectors(elbowPole, _vShoulder);
  _vB.addScaledVector(_vA, -_vB.dot(_vA));
  if (_vB.lengthSq() < 1e-6) {
    _vB.set(side === "left" ? 0.3 : -0.3, -0.4, -0.8);
    _vB.addScaledVector(_vA, -_vB.dot(_vA));
  }
  _vB.normalize();

  const cosAlpha = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
  _vElbow
    .copy(_vShoulder)
    .addScaledVector(_vA, l1 * cosAlpha)
    .addScaledVector(_vB, l1 * sinAlpha);

  _vDirU.subVectors(_vElbow, _vShoulder).normalize();
  _vDirF.copy(_vShoulder).addScaledVector(_vA, d).sub(_vElbow);
  if (_vDirF.lengthSq() < 1e-6) _vDirF.copy(_vA);
  _vDirF.normalize();

  // Normal bidang siku sesuai orientasi +Z tulang anatomis (Left = U x F, Right = F x U)
  if (side === "left") {
    _vPlaneN.crossVectors(_vDirU, _vDirF);
  } else {
    _vPlaneN.crossVectors(_vDirF, _vDirU);
  }
  if (_vPlaneN.lengthSq() < 1e-5) {
    _vPlaneN.set(side === "left" ? -1 : 1, 0, 0);
  } else {
    _vPlaneN.normalize();
  }

  // UpperArm
  setBoneBasisChar(arm, rootInvQ, _vDirU, _vPlaneN);

  // ForeArm: putar pelintiran radioulnar (pronation/supination) secara halus dari bidang siku ke arah telapak
  _vC.copy(_vPlaneN).lerp(palmDir, 0.58);
  setBoneBasisChar(fore, rootInvQ, _vDirF, _vC);

  // Hand
  _vHandDir.copy(handAimDir ?? _vDirF).normalize();
  _vPalm.copy(palmDir).normalize();
  setBoneBasisChar(hand, rootInvQ, _vHandDir, _vPalm);

  // Tekuk tulang pangkal telapak (FingerBase) + keempat jari & ibu jari secara anatomis
  if (fingerBase) {
    const restBaseQ = bones.restLocalQ.get(fingerBase);
    if (restBaseQ) {
      _qTmp.setFromAxisAngle(_axisX, fingerCurl * 0.16);
      fingerBase.quaternion.copy(restBaseQ).multiply(_qTmp);
    }
  }
  for (let fIdx = 0; fIdx < fingers.length; fIdx++) {
    const chain = fingers[fIdx];
    const splaySign = side === "left" ? 1 : -1;
    const convergenceZ = (1.5 - fIdx) * 0.035 * fingerCurl * splaySign;
    for (let j = 0; j < chain.length; j++) {
      const bone = chain[j];
      const restQ = bones.restLocalQ.get(bone);
      if (!restQ) continue;
      const c = fingerCurl * (j === 0 ? 0.78 : j === 1 ? 1.08 : 0.86);
      _eTmp.set(c, 0, j === 0 ? convergenceZ : 0, "XYZ");
      _qTmp.setFromEuler(_eTmp);
      bone.quaternion.copy(restQ).multiply(_qTmp);
    }
  }
  for (let j = 0; j < thumb.length; j++) {
    const bone = thumb[j];
    const restQ = bones.restLocalQ.get(bone);
    if (!restQ) continue;
    const sign = side === "right" ? -1 : 1;
    if (j === 0) {
      _eTmp.set(thumbCurl * 0.35, sign * thumbCurl * 0.22, sign * thumbCurl * 0.42, "XYZ");
      _qTmp.setFromEuler(_eTmp);
    } else {
      _qTmp.setFromAxisAngle(_axisX, thumbCurl * (j === 1 ? 0.68 : 0.76));
    }
    bone.quaternion.copy(restQ).multiply(_qTmp);
  }
}

/** Menggerakkan kaki (paha -> lutut -> telapak) pada koordinat ruang karakter agar telapak tetap rata di dek */
function poseLegForward(
  side: "left" | "right",
  bones: RigBones,
  rootInvQ: THREE.Quaternion,
  hipForwardAngle: number,
  kneeBendAngle: number,
  hipOutwardSplay = 0,
  footPitch = 0
) {
  const upLeg = side === "left" ? bones.leftUpLeg : bones.rightUpLeg;
  const leg = side === "left" ? bones.leftLeg : bones.rightLeg;
  const foot = side === "left" ? bones.leftFoot : bones.rightFoot;
  const signZ = side === "left" ? hipOutwardSplay : -hipOutwardSplay;

  // Di koordinat karakter (+Z depan, +Y atas, +X kiri), rotasi negatif X mengayun ke depan (+Z)
  applyBoneCharDelta(upLeg, bones, rootInvQ, -hipForwardAngle, 0, signZ);
  applyBoneCharDelta(leg, bones, rootInvQ, -hipForwardAngle + Math.max(0, kneeBendAngle), 0, signZ);
  applyBoneCharDelta(foot, bones, rootInvQ, footPitch, 0, 0);
}

let _propMats: {
  hatCrown: THREE.MeshStandardMaterial;
  hatBrim: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  spyBrass1: THREE.MeshStandardMaterial;
  spyBrass2: THREE.MeshStandardMaterial;
  spyWood: THREE.MeshStandardMaterial;
  rope: THREE.MeshStandardMaterial;
} | null = null;

function getSharedPropMats() {
  if (_propMats) return _propMats;
  _propMats = {
    hatCrown: new THREE.MeshStandardMaterial({ color: "#141d2e", roughness: 0.85 }),
    hatBrim: new THREE.MeshStandardMaterial({ color: "#182238", roughness: 0.82 }),
    gold: new THREE.MeshStandardMaterial({ color: "#d4af37", metalness: 0.78, roughness: 0.28 }),
    spyBrass1: new THREE.MeshStandardMaterial({ color: "#c99b32", metalness: 0.85, roughness: 0.24 }),
    spyBrass2: new THREE.MeshStandardMaterial({ color: "#dbb044", metalness: 0.88, roughness: 0.22 }),
    spyWood: new THREE.MeshStandardMaterial({ color: "#704a26", roughness: 0.62 }),
    rope: new THREE.MeshStandardMaterial({ color: "#9c7e54", roughness: 0.94 }),
  };
  return _propMats;
}

/** Membuat Topi Tricorn Kapten Angkatan Laut Abad 17 */
function CaptainTricornHat() {
  const mats = useMemo(() => getSharedPropMats(), []);
  return (
    <group position={[0, 0, 0]} rotation={[-0.06, 0, 0]}>
      {/* Mahkota topi beludru navy gelap */}
      <mesh position={[0, 0.045, 0]} material={mats.hatCrown}>
        <cylinderGeometry args={[0.098, 0.11, 0.09, 18]} />
      </mesh>
      {/* Tepi topi lebar segi tiga (tricorn) dengan pinggiran emas */}
      <mesh position={[0, 0.014, 0]} scale={[1.22, 0.16, 1.26]} material={mats.hatBrim}>
        <cylinderGeometry args={[0.178, 0.168, 0.08, 3]} />
      </mesh>
      <mesh position={[0, 0.021, 0]} scale={[1.23, 0.1, 1.27]} material={mats.gold}>
        <cylinderGeometry args={[0.181, 0.174, 0.06, 3]} />
      </mesh>
      {/* Lencana kokarde emas di sisi depan */}
      <mesh position={[0, 0.048, 0.106]} rotation={[Math.PI / 2, 0, 0]} material={mats.gold}>
        <cylinderGeometry args={[0.024, 0.024, 0.012, 12]} />
      </mesh>
    </group>
  );
}

/** Teropong Kuningan Klasik untuk Awak Pengintai */
function BrassSpyglassMesh() {
  const mats = useMemo(() => getSharedPropMats(), []);
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, 0.08, 0]} material={mats.spyBrass1}>
        <cylinderGeometry args={[0.026, 0.032, 0.19, 14]} />
      </mesh>
      <mesh position={[0, 0.21, 0]} material={mats.spyBrass2}>
        <cylinderGeometry args={[0.021, 0.025, 0.14, 14]} />
      </mesh>
      <mesh position={[0, 0.29, 0]} material={mats.spyWood}>
        <cylinderGeometry args={[0.017, 0.02, 0.05, 14]} />
      </mesh>
    </group>
  );
}

/** Tali Tambang Layar untuk Awak Penarik Tali */
function VerticalRiggingRope() {
  const mats = useMemo(() => getSharedPropMats(), []);
  return (
    <mesh position={[0.3, 1.85, 0.04]} rotation={[0, 0, 0.06]} material={mats.rope}>
      <cylinderGeometry args={[0.016, 0.016, 3.6, 8]} />
    </mesh>
  );
}

// Koordinat genggaman kiri/kanan kemudi Kapten pada dek (-6.0, 6.08, 0) relatif terhadap kaki Kapten (-6.58, 6.08, 0)
const DECK_WHEEL_GRIP_LEFT = new THREE.Vector3();
const DECK_WHEEL_GRIP_RIGHT = new THREE.Vector3();
const DECK_PALM_L = new THREE.Vector3(-0.75, -0.5, 0.42).normalize();
const DECK_PALM_R = new THREE.Vector3(0.75, -0.5, 0.42).normalize();
const DECK_POLE_L = new THREE.Vector3(0.38, 1.15, -0.32);
const DECK_POLE_R = new THREE.Vector3(-0.38, 1.15, -0.32);

/**
 * Awak kapal & Kapten berbasis model manusia realistis `.glb` (`SkinnedMesh` bermaterial foto-realistis),
 * dianimasikan prosedural secara halus dalam koordinat karakter (+X menghadap haluan kapal).
 */
export function RiggedHumanFigure({
  role,
  variant,
  phaseOffset = 0,
  walkRange = 2.6,
  showRope = false,
  wheelAngleRef,
  mobileQuality = false,
  active = true,
}: {
  role: CrewRole;
  variant: HumanModelVariant;
  phaseOffset?: number;
  walkRange?: number;
  showRope?: boolean;
  wheelAngleRef?: React.MutableRefObject<number>;
  mobileQuality?: boolean;
  active?: boolean;
}) {
  const { root, bones } = useHumanRigClone(variant, false, false, mobileQuality);
  const rootWrapRef = useRef<THREE.Group>(null);
  const hatWrapRef = useRef<THREE.Group>(null);
  const spyglassWrapRef = useRef<THREE.Group>(null);
  const lastPoseTime = useRef(-999);

  useFrame(({ clock }) => {
    const wrap = rootWrapRef.current;
    if (!wrap || !active) return;
    const minInterval = role === "captain" || role === "walk" ? 0.022 : 0.036;
    if (clock.elapsedTime - lastPoseTime.current < minInterval) return;
    lastPoseTime.current = clock.elapsedTime;
    const t = clock.elapsedTime + phaseOffset;

    // 1. Tentukan parameter pose tubuh sesuai peran (harus diterapkan ke panggul/punggung lebih dulu)
    let leanForward = 0.04;
    let bodyYaw = 0;
    const bodyRoll = Math.sin(t * 1.1) * 0.015;
    let hipDropY = 0;
    let walkStride = 0;
    let walkStepPhase = 0;

    if (role === "walk") {
      const cycleSpeed = 0.36;
      const u = (t * cycleSpeed) % 2;
      const forward = u < 1;
      const p = forward ? u : 2 - u;
      const smoothP = p * p * (3 - 2 * p);
      walkStepPhase = t * 4.4;
      const xPos = (smoothP - 0.5) * walkRange;
      wrap.position.x = xPos;
      wrap.position.z = Math.sin(smoothP * Math.PI) * 0.22;
      // Child group sudah memutar +90 deg (+Z GLB -> +X haluan); berbalik cukup putar 180 deg
      wrap.rotation.y = forward ? 0 : Math.PI;
      hipDropY = Math.abs(Math.sin(walkStepPhase)) * 0.025 - 0.012;
      leanForward = 0.07;
      walkStride = Math.sin(walkStepPhase) * 0.36;
    } else if (role === "captain") {
      leanForward = 0.06;
    } else if (role === "haul") {
      const pull = Math.sin(t * 2.15);
      leanForward = 0.12 - pull * 0.14;
      hipDropY = -0.05;
    } else if (role === "lookout") {
      leanForward = 0.08;
      bodyYaw = Math.sin(t * 0.55) * 0.26;
    } else {
      leanForward = 0.03;
      bodyYaw = Math.sin(t * 0.45) * 0.14;
    }

    // Perbarui rantai ancestor root (tanpa turun ke anak tulang) sebelum konversi karakter-lokal
    root.updateWorldMatrix(true, false);
    _mRootInv.copy(root.matrixWorld).invert();
    root.getWorldQuaternion(_qRootInv).invert();

    // 2. Gerakkan Hips -> Spine -> Spine1 -> Spine2 -> Neck -> Head SEBELUM IK lengan
    if (bones.hips) {
      bones.hips.position.y = bones.restHipsPos.y + hipDropY;
      applyBoneCharDelta(bones.hips, bones, _qRootInv, 0, bodyYaw * 0.25, bodyRoll);
    }
    applyBoneCharDelta(bones.spine, bones, _qRootInv, leanForward * 0.4, bodyYaw * 0.25, 0);
    applyBoneCharDelta(bones.spine1, bones, _qRootInv, leanForward * 0.35, bodyYaw * 0.2, 0);
    applyBoneCharDelta(bones.spine2, bones, _qRootInv, leanForward * 0.25, bodyYaw * 0.15, 0);
    const headPitch = role === "captain" ? Math.sin(t * 0.7) * 0.04 : Math.sin(t * 0.9) * 0.05;
    const headYaw = role === "captain" ? Math.sin(t * 0.5) * 0.12 : bodyYaw * 0.4;
    applyBoneCharDelta(bones.neck, bones, _qRootInv, headPitch * 0.4, headYaw * 0.4, 0);
    applyBoneCharDelta(bones.head, bones, _qRootInv, headPitch * 0.6, headYaw * 0.6, 0);

    // 3. Terapkan pose kaki & IK lengan
    if (role === "walk") {
      poseLegForward(
        "left",
        bones,
        _qRootInv,
        walkStride,
        Math.max(0, -walkStride * 1.1) + 0.08,
        0.03,
        -walkStride * 0.18
      );
      poseLegForward(
        "right",
        bones,
        _qRootInv,
        -walkStride,
        Math.max(0, walkStride * 1.1) + 0.08,
        0.03,
        walkStride * 0.18
      );

      const lTarget = _vC.set(0.24, 0.92 + Math.sin(walkStepPhase) * 0.04, 0.04 - Math.sin(walkStepPhase) * 0.24);
      solveArmIK(
        "left",
        bones,
        _mRootInv,
        _qRootInv,
        lTarget,
        _vB.set(0.32, 1.12, -0.35),
        _vA.set(-1, -0.15, 0.1).normalize(),
        null,
        0.24
      );
      const rTarget = _vC.set(-0.24, 0.92 - Math.sin(walkStepPhase) * 0.04, 0.04 + Math.sin(walkStepPhase) * 0.24);
      solveArmIK(
        "right",
        bones,
        _mRootInv,
        _qRootInv,
        rTarget,
        _vB.set(-0.32, 1.12, -0.35),
        _vA.set(1, -0.15, 0.1).normalize(),
        null,
        0.24
      );
    } else if (role === "captain") {
      poseLegForward("left", bones, _qRootInv, 0.06, 0.12, 0.07, 0);
      poseLegForward("right", bones, _qRootInv, -0.05, 0.1, 0.07, 0);

      const wAng = wheelAngleRef ? wheelAngleRef.current : Math.sin(t * 1.3) * 0.28;
      // Roda kemudi `ShipHelmStand` (R = 0.54, 12 jari-jari) relatif terhadap badan Kapten (-6.46, scale 1.06)
      // Mengunci tepat ke jari-jari pegangan #11 (-30 deg, tangan kiri) & #1 (+30 deg, tangan kanan)
      const rWheel = 0.51;
      const wheelZCenter = 0.395;
      const wheelYCenter = 0.99;
      const thL = -Math.PI / 6 + wAng;
      const thR = Math.PI / 6 + wAng;
      DECK_WHEEL_GRIP_LEFT.set(-Math.sin(thL) * rWheel, wheelYCenter + Math.cos(thL) * rWheel, wheelZCenter);
      DECK_WHEEL_GRIP_RIGHT.set(-Math.sin(thR) * rWheel, wheelYCenter + Math.cos(thR) * rWheel, wheelZCenter);

      solveArmIK(
        "left",
        bones,
        _mRootInv,
        _qRootInv,
        DECK_WHEEL_GRIP_LEFT,
        DECK_POLE_L,
        DECK_PALM_L,
        _vHandDir.set(0.14, 0.42, 0.89).normalize(),
        0.92
      );
      solveArmIK(
        "right",
        bones,
        _mRootInv,
        _qRootInv,
        DECK_WHEEL_GRIP_RIGHT,
        DECK_POLE_R,
        DECK_PALM_R,
        _vHandDir.set(-0.14, 0.42, 0.89).normalize(),
        0.92
      );
    } else if (role === "haul") {
      const pull = Math.sin(t * 2.15);
      poseLegForward("left", bones, _qRootInv, 0.18, 0.32, 0.08, 0);
      poseLegForward("right", bones, _qRootInv, -0.14, 0.22, 0.08, 0);

      const ropeX = 0.04;
      const ropeZ = 0.34;
      const hL = _vC.set(ropeX + 0.02, 1.32 + pull * 0.16, ropeZ);
      const hR = _vB.set(ropeX - 0.02, 1.08 - pull * 0.15, ropeZ);
      solveArmIK(
        "left",
        bones,
        _mRootInv,
        _qRootInv,
        hL,
        _vA.set(0.32, 1.15, -0.15),
        _vHandDir.set(-0.85, -0.35, 0.35).normalize(),
        _vShoulder.set(-0.2, 0.65, 0.65).normalize(),
        0.88
      );
      solveArmIK(
        "right",
        bones,
        _mRootInv,
        _qRootInv,
        hR,
        _vA.set(-0.32, 1.05, -0.15),
        _vHandDir.set(0.85, -0.35, 0.35).normalize(),
        _vShoulder.set(0.2, 0.65, 0.65).normalize(),
        0.88
      );
    } else if (role === "lookout") {
      poseLegForward("left", bones, _qRootInv, 0.12, 0.2, 0.07, 0);
      poseLegForward("right", bones, _qRootInv, -0.08, 0.14, 0.07, 0);

      solveArmIK(
        "left",
        bones,
        _mRootInv,
        _qRootInv,
        _vC.set(0.26, 0.92, 0.08),
        _vB.set(0.34, 1.16, -0.25),
        _vA.set(-1, -0.15, 0.15).normalize(),
        null,
        0.35
      );
      solveArmIK(
        "right",
        bones,
        _mRootInv,
        _qRootInv,
        _vC.set(-0.08, 1.56, 0.25),
        _vB.set(-0.36, 1.32, -0.05),
        _vA.set(0.85, -0.3, -0.3).normalize(),
        _vHandDir.set(0.2, 0.35, 0.9).normalize(),
        0.9
      );
    } else {
      poseLegForward("left", bones, _qRootInv, 0.04, 0.08, 0.06, 0);
      poseLegForward("right", bones, _qRootInv, -0.04, 0.08, 0.06, 0);
      const pointWave = 0.5 + 0.5 * Math.sin(t * 0.72);

      solveArmIK(
        "left",
        bones,
        _mRootInv,
        _qRootInv,
        _vC.set(0.25, 0.95, 0.06),
        _vB.set(0.32, 1.18, -0.22),
        _vA.set(-1, -0.2, 0.15).normalize(),
        null,
        0.3
      );
      solveArmIK(
        "right",
        bones,
        _mRootInv,
        _qRootInv,
        _vC.set(-0.18, 1.34 + pointWave * 0.12, 0.42),
        _vB.set(-0.34, 1.18, -0.12),
        _vA.set(0.7, -0.5, 0.3).normalize(),
        _vHandDir.set(-0.05, 0.18, 0.96).normalize(),
        0.38
      );
    }

    root.updateMatrixWorld(true);

    // Sinkronkan Topi Kapten tepat tegak di atas mahkota kepala di ruang lokal `root` (+Z depan)
    if (hatWrapRef.current && bones.head) {
      const restHeadQ = bones.restWorldQ.get(bones.head);
      getCharSpacePos(bones.head, _mRootInv, _vA);
      getCharSpaceWorldQuat(bones.head, _qRootInv, _qTmp);
      if (restHeadQ) {
        _qDelta.copy(restHeadQ).invert();
        _qTmp.multiply(_qDelta); // delta rotasi kepala terhadap T-pose
      } else {
        _qTmp.identity();
      }
      _vB.set(0, 0.126, 0.012).applyQuaternion(_qTmp);
      hatWrapRef.current.position.copy(_vA).add(_vB);
      hatWrapRef.current.quaternion.copy(_qTmp);
    }

    // Sinkronkan Teropong di tangan pengintai di ruang lokal `root` menghadap +Z depan
    if (spyglassWrapRef.current && bones.rightHand) {
      getCharSpacePos(bones.rightHand, _mRootInv, _vA);
      spyglassWrapRef.current.position.copy(_vA).add(_vB.set(0.02, 0.055, -0.02));
      spyglassWrapRef.current.rotation.set(-0.04, bodyYaw * 0.65, 0);
    }
  });

  return (
    <group ref={rootWrapRef}>
      {/* Model GLB berhadapan +Z; rotasi +90 deg agar menghadap +X (haluan kapal) */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <primitive object={root} />
        {role === "captain" && (
          <group ref={hatWrapRef}>
            <CaptainTricornHat />
          </group>
        )}
        {role === "lookout" && (
          <group ref={spyglassWrapRef}>
            <BrassSpyglassMesh />
          </group>
        )}
      </group>
      {showRope && <VerticalRiggingRope />}
    </group>
  );
}

// Target koordinat roda kemudi POV pada koordinat dunia kapal (`CaptainPovHelmRig`)
const POV_BODY_POS = new THREE.Vector3(-6.36, 5.72, 0);
const POV_WHEEL_POS = new THREE.Vector3(-5.94, 7.12, 0);
const POV_SCALE = 1.18;
const POV_GRIP_L = new THREE.Vector3();
const POV_GRIP_R = new THREE.Vector3();
const POV_POLE_L = new THREE.Vector3(0.44, 0.96, -0.24);
const POV_POLE_R = new THREE.Vector3(-0.44, 0.96, -0.24);
const POV_PALM_L = new THREE.Vector3(-0.68, -0.38, 0.62).normalize();
const POV_PALM_R = new THREE.Vector3(0.68, -0.38, 0.62).normalize();
const POV_HDIR_L = new THREE.Vector3(0.28, 0.44, 0.85).normalize();
const POV_HDIR_R = new THREE.Vector3(-0.28, 0.44, 0.85).normalize();

/**
 * Lengan & tangan manusia realistis Kapten (dari `human-captain.glb` asli — disaring hanya
 * menampilkan lengan jas, manset kemeja & kulit tangan, tanpa badan/torso/kepala)
 * yang menggenggam dan memutar roda kemudi secara presisi dalam mode First-Person POV.
 */
export function RiggedCaptainPovArms({
  wheelAngleRef,
  gripRadius = 0.37,
  active = true,
}: {
  wheelAngleRef: React.MutableRefObject<number>;
  gripRadius?: number;
  active?: boolean;
}) {
  const { root, bones } = useHumanRigClone("captain", true, true);
  const bodyRef = useRef<THREE.Group>(null);
  const lastPoseTime = useRef(-999);

  useFrame(({ clock }) => {
    const body = bodyRef.current;
    if (!body || !active) return;
    if (clock.elapsedTime - lastPoseTime.current < 0.02) return;
    lastPoseTime.current = clock.elapsedTime;
    const t = clock.elapsedTime;

    root.updateWorldMatrix(true, false);
    _mRootInv.copy(root.matrixWorld).invert();
    root.getWorldQuaternion(_qRootInv).invert();

    // Posisi dasar & condong bahu lebih dulu sebelum menghitung IK
    applyBoneCharDelta(bones.spine, bones, _qRootInv, 0.08, 0, 0);
    applyBoneCharDelta(bones.spine1, bones, _qRootInv, 0.06, 0, 0);
    applyBoneCharDelta(bones.spine2, bones, _qRootInv, 0.06, 0, Math.sin(t * 1.4) * 0.012);

    poseLegForward("left", bones, _qRootInv, 0.08, 0.14, 0.06, 0);
    poseLegForward("right", bones, _qRootInv, -0.06, 0.12, 0.06, 0);

    // Hitung posisi genggaman kiri (spoke #10, -60 deg) & kanan (spoke #2, +60 deg)
    // tepat terkunci pada jari-jari pegangan roda kemudi 12-spoke saat berputar
    const wAng = wheelAngleRef.current;
    const thL = -Math.PI / 3 + wAng;
    const thR = Math.PI / 3 + wAng;
    const wheelLocalZ = (POV_WHEEL_POS.x - POV_BODY_POS.x) / POV_SCALE;
    const wheelLocalY = (POV_WHEEL_POS.y - POV_BODY_POS.y) / POV_SCALE;
    const scaledR = (gripRadius + 0.025) / POV_SCALE;

    POV_GRIP_L.set(
      -Math.sin(thL) * scaledR,
      wheelLocalY + Math.cos(thL) * scaledR,
      wheelLocalZ
    );
    POV_GRIP_R.set(
      -Math.sin(thR) * scaledR,
      wheelLocalY + Math.cos(thR) * scaledR,
      wheelLocalZ
    );

    solveArmIK(
      "left",
      bones,
      _mRootInv,
      _qRootInv,
      POV_GRIP_L,
      POV_POLE_L,
      POV_PALM_L,
      POV_HDIR_L,
      0.96
    );
    solveArmIK(
      "right",
      bones,
      _mRootInv,
      _qRootInv,
      POV_GRIP_R,
      POV_POLE_R,
      POV_PALM_R,
      POV_HDIR_R,
      0.96
    );

    root.updateMatrixWorld(true);
  });

  return (
    <group
      ref={bodyRef}
      position={[POV_BODY_POS.x, POV_BODY_POS.y, POV_BODY_POS.z]}
      rotation={[0, Math.PI / 2, 0]}
      scale={POV_SCALE}
    >
      <primitive object={root} />
    </group>
  );
}

/** Mengompilasi shader sub-grup 3D secara asinkron (KHR_parallel_shader_compile) sebelum ditampilkan */
export function precompileObjectAsync(
  gl: THREE.WebGLRenderer,
  object: THREE.Object3D | null,
  camera: THREE.Camera,
  scene: THREE.Scene,
  onReady: () => void
): () => void {
  if (!object) {
    onReady();
    return () => {};
  }
  let cancelled = false;
  let innerRaf = 0;
  const raf = requestAnimationFrame(() => {
    if (cancelled) return;
    gl.compileAsync(object, camera, scene)
      .then(() => {
        if (cancelled) return;
        innerRaf = requestAnimationFrame(() => {
          if (!cancelled) onReady();
        });
      })
      .catch(() => {
        if (!cancelled) onReady();
      });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    if (innerRaf) cancelAnimationFrame(innerRaf);
  };
}
