"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Marks meshes this merger creates, so tools that count or index a model's meshes can skip them. */
export const mergedMeshTag = "mergedStaticMesh";
/**
 * Marks parts that move only now and then, like a blinking eye, so they are never merged in a
 * pose they hold only briefly. Parts that move all the time are found by watching them instead.
 */
export const movingPartTag = "movesOnItsOwn";

/** Originals that are merged stay in the scene for their animation code, but only on this layer. */
const hiddenLayer = 31;
/** Time for traits to measure their mount points before parts are observed. */
const settleSeconds = 0.4;
/** How long parts are observed to learn which of them move. */
const sampleSeconds = 1.2;
/** How often merged parts are checked for movement that started later, like a blink. */
const watchEverySeconds = 1;
/** Merging is spread over frames, so a full aquarium does not stall at once. */
const mergesPerFrame = 2;
const epsilon = 1e-5;

let budgetFrame = -1;
let budgetUsed = 0;

function takeMergeBudget(frameTime: number) {
  if (budgetFrame !== frameTime) {
    budgetFrame = frameTime;
    budgetUsed = 0;
  }
  if (budgetUsed >= mergesPerFrame) return false;
  budgetUsed += 1;
  return true;
}

type Pose = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; visible: boolean };

function poseOf(object: THREE.Object3D): Pose {
  return {
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
    visible: object.visible,
  };
}

function poseChanged(object: THREE.Object3D, pose: Pose) {
  return (
    object.visible !== pose.visible ||
    object.position.distanceToSquared(pose.position) > epsilon * epsilon ||
    Math.abs(Math.abs(object.quaternion.dot(pose.quaternion)) - 1) > epsilon ||
    object.scale.distanceToSquared(pose.scale) > epsilon * epsilon
  );
}

function isMergedMesh(object: THREE.Object3D) {
  return object.userData[mergedMeshTag] === true;
}

type MergeableMaterial = THREE.Material & { color: THREE.Color; vertexColors: boolean };

const mergeableMaterialTypes = new Set(["MeshToonMaterial", "MeshStandardMaterial", "MeshBasicMaterial"]);
// A colour map is allowed: parts sharing the same one are merged with their texture coordinates.
const textureSlots = ["alphaMap", "aoMap", "bumpMap", "normalMap", "emissiveMap", "envMap", "lightMap", "roughnessMap", "metalnessMap", "displacementMap", "gradientMap"] as const;

function mergeableMaterial(mesh: THREE.Mesh): MergeableMaterial | null {
  const material = mesh.material;
  if (Array.isArray(material) || !mergeableMaterialTypes.has(material.type)) return null;
  const record = material as unknown as Record<string, unknown>;
  if (textureSlots.some((slot) => record[slot])) return null;
  // Geometry groups only matter with several materials, which were ruled out above.
  if (mesh.geometry.morphAttributes.position) return null;
  return material as MergeableMaterial;
}

/** Everything that must match for two meshes to share one draw call; colour is baked into vertices. */
function materialSignature(mesh: THREE.Mesh, material: MergeableMaterial) {
  const standard = material as unknown as Partial<THREE.MeshStandardMaterial>;
  return [
    material.type,
    material.transparent,
    material.opacity,
    material.side,
    material.depthWrite,
    material.depthTest,
    material.alphaTest,
    material.blending,
    material.toneMapped,
    material.forceSinglePass,
    (material as unknown as { wireframe?: boolean }).wireframe,
    (material as unknown as { flatShading?: boolean }).flatShading,
    standard.emissive?.getHexString(),
    standard.emissiveIntensity,
    standard.roughness,
    standard.metalness,
    (material as unknown as { map?: THREE.Texture | null }).map?.uuid,
    mesh.renderOrder,
  ].join("|");
}

/** The mesh's geometry in the anchor's space, with position, normal and baked colour only. */
function bakedGeometry(mesh: THREE.Mesh, material: MergeableMaterial, toAnchor: THREE.Matrix4) {
  const source = mesh.geometry;
  const position = source.getAttribute("position");
  if (!position) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", position.clone());
  if (source.getAttribute("normal")) geometry.setAttribute("normal", source.getAttribute("normal").clone());
  else geometry.computeVertexNormals();
  if ((material as unknown as { map?: THREE.Texture | null }).map) {
    const uv = source.getAttribute("uv");
    if (!uv) return null;
    geometry.setAttribute("uv", uv.clone());
  }

  const colors = new Float32Array(position.count * 3);
  const vertexColors = material.vertexColors ? source.getAttribute("color") : undefined;
  const color = new THREE.Color();
  for (let index = 0; index < position.count; index += 1) {
    if (vertexColors) color.setRGB(vertexColors.getX(index), vertexColors.getY(index), vertexColors.getZ(index));
    else color.setRGB(1, 1, 1);
    color.multiply(material.color).toArray(colors, index * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const indices = source.index
    ? Array.from(source.index.array as ArrayLike<number>)
    : Array.from({ length: position.count }, (_, index) => index);
  // A mirrored transform turns faces inside out once it is baked in, so restore their winding.
  if (toAnchor.determinant() < 0) {
    for (let index = 0; index + 2 < indices.length; index += 3) {
      [indices[index + 1], indices[index + 2]] = [indices[index + 2], indices[index + 1]];
    }
  }
  geometry.setIndex(indices);
  geometry.applyMatrix4(toAnchor);
  return geometry;
}

type MergeState = {
  phase: "settling" | "sampling" | "queued" | "merged";
  startedAt: number;
  poses: Map<THREE.Object3D, Pose>;
  moving: Set<THREE.Object3D>;
  merged: THREE.Mesh[];
  hidden: Array<{ mesh: THREE.Mesh; layers: number; material: THREE.Material | THREE.Material[]; geometry: THREE.BufferGeometry }>;
  nextWatch: number;
};

function freshState(now: number): MergeState {
  return { phase: "settling", startedAt: now, poses: new Map(), moving: new Set(), merged: [], hidden: [], nextWatch: 0 };
}

function unmerge(state: MergeState) {
  for (const mesh of state.merged) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  for (const { mesh, layers } of state.hidden) mesh.layers.mask = layers;
  state.merged = [];
  state.hidden = [];
}

function recordPoses(root: THREE.Object3D, state: MergeState) {
  state.poses.clear();
  root.traverse((object) => {
    if (object === root || isMergedMesh(object)) return;
    state.poses.set(object, poseOf(object));
    if (object.userData[movingPartTag]) state.moving.add(object);
  });
}

/** The nearest node at or above `object` that moves on its own, or the root if none does. */
function anchorOf(object: THREE.Object3D, root: THREE.Object3D, moving: Set<THREE.Object3D>) {
  let current: THREE.Object3D | null = object;
  while (current && current !== root) {
    if (moving.has(current)) return current;
    current = current.parent;
  }
  return root;
}

function merge(root: THREE.Object3D, state: MergeState) {
  type Batch = { anchor: THREE.Object3D; material: MergeableMaterial; geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[] };
  const batches = new Map<string, Batch>();
  const anchorIds = new Map<THREE.Object3D, number>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || isMergedMesh(mesh) || !state.poses.has(mesh)) return;
    // Hidden parts and anything under them stay as they are.
    for (let node: THREE.Object3D | null = mesh; node && node !== root; node = node.parent) {
      if (!node.visible) return;
    }
    const material = mergeableMaterial(mesh);
    if (!material) return;

    const anchor = anchorOf(mesh, root, state.moving);
    const toAnchor = new THREE.Matrix4();
    if (anchor !== mesh) {
      for (let node: THREE.Object3D | null = mesh; node && node !== anchor; node = node.parent) {
        node.updateMatrix();
        toAnchor.premultiply(node.matrix);
      }
    }
    const geometry = bakedGeometry(mesh, material, toAnchor);
    if (!geometry) return;

    if (!anchorIds.has(anchor)) anchorIds.set(anchor, anchorIds.size);
    const key = `${anchorIds.get(anchor)}:${materialSignature(mesh, material)}`;
    const batch = batches.get(key) ?? { anchor, material, geometries: [], meshes: [] };
    batch.geometries.push(geometry);
    batch.meshes.push(mesh);
    batches.set(key, batch);
  });

  for (const batch of batches.values()) {
    // A single part gains nothing from merging.
    if (batch.meshes.length < 2) {
      batch.geometries.forEach((geometry) => geometry.dispose());
      continue;
    }
    const geometry = mergeGeometries(batch.geometries, false);
    batch.geometries.forEach((part) => part.dispose());
    if (!geometry) continue;
    const material = batch.material.clone() as MergeableMaterial;
    material.color.set("#FFFFFF");
    material.vertexColors = true;
    const mergedMesh = new THREE.Mesh(geometry, material);
    mergedMesh.userData[mergedMeshTag] = true;
    mergedMesh.renderOrder = batch.meshes[0].renderOrder;
    batch.anchor.add(mergedMesh);
    state.merged.push(mergedMesh);
    for (const mesh of batch.meshes) {
      state.hidden.push({ mesh, layers: mesh.layers.mask, material: mesh.material, geometry: mesh.geometry });
      mesh.layers.set(hiddenLayer);
    }
  }
}

/** True when a merged part has moved, been replaced or been removed since it was merged. */
function mergeIsStale(root: THREE.Object3D, state: MergeState) {
  for (const [object, pose] of state.poses) {
    if (state.moving.has(object)) continue;
    if (poseChanged(object, pose)) {
      state.moving.add(object);
      return true;
    }
  }
  return state.hidden.some(({ mesh, material, geometry }) => {
    if (mesh.material !== material || mesh.geometry !== geometry) return true;
    let node: THREE.Object3D | null = mesh;
    while (node && node !== root) node = node.parent;
    return node !== root;
  });
}

/**
 * Merges the parts of its children that never move relative to each other into a few meshes,
 * so a creature needs a handful of draw calls instead of dozens. Parts are watched for a moment
 * first: whatever moves on its own (a tail, a claw, an eye) keeps moving, carrying its merged
 * still parts with it. Turning `enabled` off restores the original meshes.
 */
export function StaticMeshMerger({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const rootRef = useRef<THREE.Group>(null);
  const stateRef = useRef<MergeState | null>(null);

  useEffect(() => {
    if (enabled) return;
    if (stateRef.current) unmerge(stateRef.current);
    stateRef.current = null;
  }, [enabled]);

  useEffect(() => () => {
    if (stateRef.current) unmerge(stateRef.current);
  }, []);

  useFrame(({ clock }) => {
    const root = rootRef.current;
    if (!enabled || !root) return;
    const now = clock.elapsedTime;
    const state = (stateRef.current ??= freshState(now));

    if (state.phase === "settling") {
      if (now - state.startedAt < settleSeconds) return;
      recordPoses(root, state);
      state.phase = "sampling";
      state.startedAt = now;
      return;
    }

    if (state.phase === "sampling") {
      for (const [object, pose] of state.poses) {
        if (!state.moving.has(object) && poseChanged(object, pose)) state.moving.add(object);
      }
      if (now - state.startedAt >= sampleSeconds) state.phase = "queued";
      return;
    }

    if (state.phase === "queued") {
      if (!takeMergeBudget(now)) return;
      recordPoses(root, state);
      merge(root, state);
      state.phase = "merged";
      state.nextWatch = now + watchEverySeconds * (0.5 + Math.random());
      return;
    }

    if (now < state.nextWatch) return;
    state.nextWatch = now + watchEverySeconds;
    if (!mergeIsStale(root, state)) return;
    unmerge(state);
    state.phase = "queued";
  });

  return <group ref={rootRef}>{children}</group>;
}
