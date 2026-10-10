"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { detailRecipeOf, type DetailRecipe } from "@/lib/creature/geometryDetail";

/**
 * Roughly how many on-screen pixels one segment of a rounded outline may span. The full-detail
 * models already use about 11 pixels per segment at their size in the aquarium.
 */
const pixelsPerSegment = 8;
/** Creatures grow and shrink as they swim through the depth; detail allows for this much growth. */
const growthAllowance = 1.3;
/** Shapes without a single around-count, like extrusions, are assumed to start with this many. */
const assumedSegmentsAround = 32;
/** Reductions are spread over frames, so a full aquarium does not stall at once. */
const creaturesPerFrame = 3;

let budgetFrame = -1;
let budgetUsed = 0;

function takeBudget(frameTime: number) {
  if (budgetFrame !== frameTime) {
    budgetFrame = frameTime;
    budgetUsed = 0;
  }
  if (budgetUsed >= creaturesPerFrame) return false;
  budgetUsed += 1;
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Parameters = Record<string, any>;
type DetailedGeometry = THREE.BufferGeometry & { parameters: Parameters };

/** Lower-detail geometries are shared by every mesh that asks for the same shape and detail. */
const reducedCache = new Map<string, THREE.BufferGeometry>();
/** A freshly built geometry per shape, to tell whether a mesh's geometry was reshaped afterwards. */
const pristineCache = new Map<string, THREE.BufferGeometry>();
const reducedGeometries = new WeakSet<THREE.BufferGeometry>();
/** Lower-detail rebuilds of hand-made geometries, kept for as long as the original exists. */
const recipeCache = new WeakMap<THREE.BufferGeometry, Map<number, THREE.BufferGeometry>>();

function rebuiltFromRecipe(geometry: THREE.BufferGeometry, recipe: DetailRecipe, factor: number) {
  const byFactor = recipeCache.get(geometry) ?? new Map<number, THREE.BufferGeometry>();
  recipeCache.set(geometry, byFactor);
  let rebuilt = byFactor.get(factor);
  if (!rebuilt) {
    rebuilt = recipe.build(factor);
    reducedGeometries.add(rebuilt);
    byFactor.set(factor, rebuilt);
  }
  return rebuilt;
}

function shapeKey(geometry: DetailedGeometry) {
  // Shapes and curves serialise with a fresh uuid each, which must not split identical shapes.
  return `${geometry.type}:${JSON.stringify(geometry.parameters, (key, value) => (key === "uuid" ? undefined : value))}`;
}

/** How many segments run around the shape, which the detail factor is measured against. */
function segmentsAround(geometry: DetailedGeometry) {
  const p = geometry.parameters;
  switch (geometry.type) {
    case "SphereGeometry":
      return p.widthSegments;
    case "CylinderGeometry":
    case "ConeGeometry":
    case "CapsuleGeometry":
      return p.radialSegments;
    case "TorusGeometry":
      return p.tubularSegments;
    case "LatheGeometry":
      return p.segments;
    case "TubeGeometry":
      return p.tubularSegments;
    case "ExtrudeGeometry":
    case "ShapeGeometry":
      return assumedSegmentsAround;
    default:
      return null;
  }
}

/** Builds the same shape with its segment counts scaled by `factor`, never adding segments. */
function buildShape(type: string, p: Parameters, factor: number): THREE.BufferGeometry | null {
  const segments = (count: number, minimum: number) => Math.max(minimum, Math.min(count, Math.round(count * factor)));
  switch (type) {
    case "SphereGeometry":
      return new THREE.SphereGeometry(p.radius, segments(p.widthSegments, 6), segments(p.heightSegments, 4), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
    case "CylinderGeometry":
      return new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, segments(p.radialSegments, 6), p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
    case "ConeGeometry":
      return new THREE.ConeGeometry(p.radius, p.height, segments(p.radialSegments, 6), p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
    case "CapsuleGeometry":
      return new THREE.CapsuleGeometry(p.radius, p.height, segments(p.capSegments, 2), segments(p.radialSegments, 6), p.heightSegments);
    case "TorusGeometry":
      return new THREE.TorusGeometry(p.radius, p.tube, segments(p.radialSegments, 4), segments(p.tubularSegments, 8), p.arc, p.thetaStart, p.thetaLength);
    case "LatheGeometry":
      return new THREE.LatheGeometry(p.points, segments(p.segments, 6), p.phiStart, p.phiLength);
    case "TubeGeometry":
      return new THREE.TubeGeometry(p.path, segments(p.tubularSegments, 8), p.radius, segments(p.radialSegments, 4), p.closed);
    case "ExtrudeGeometry":
      return new THREE.ExtrudeGeometry(p.shapes, {
        ...p.options,
        curveSegments: segments(p.options.curveSegments ?? 12, 3),
        bevelSegments: segments(p.options.bevelSegments ?? 3, 1),
      });
    case "ShapeGeometry":
      return new THREE.ShapeGeometry(p.shapes, segments(p.curveSegments, 3));
    default:
      return null;
  }
}

/** False when the geometry was moved, bent or recoloured after it was built, so rebuilding it would lose that. */
function isPristine(geometry: DetailedGeometry, key: string) {
  let pristine = pristineCache.get(key);
  if (!pristine) {
    const built = buildShape(geometry.type, geometry.parameters, 1);
    if (!built) return false;
    pristine = built;
    pristineCache.set(key, pristine);
  }
  const ours = geometry.getAttribute("position");
  const fresh = pristine.getAttribute("position");
  if (!ours || ours.count !== fresh.count) return false;
  if (Object.keys(geometry.attributes).sort().join() !== Object.keys(pristine.attributes).sort().join()) return false;
  for (let index = 0; index < ours.count; index += 1) {
    if (
      Math.abs(ours.getX(index) - fresh.getX(index)) > 1e-6 ||
      Math.abs(ours.getY(index) - fresh.getY(index)) > 1e-6 ||
      Math.abs(ours.getZ(index) - fresh.getZ(index)) > 1e-6
    ) {
      return false;
    }
  }
  return true;
}

const worldScale = new THREE.Vector3();

/**
 * A geometry with only as many segments as the mesh's size on screen needs (when `fitToScreen`),
 * and at most `quality` of its full segments, or null to keep it.
 */
function reducedGeometryFor(mesh: THREE.Mesh, pixelsPerUnit: number, fitToScreen: boolean, quality: number) {
  const geometry = mesh.geometry as DetailedGeometry;
  if (reducedGeometries.has(geometry)) return null;
  const recipe = detailRecipeOf(geometry);
  const around = recipe ? recipe.segmentsAround : geometry.parameters ? segmentsAround(geometry) : null;
  if (!around) return null;

  let screenFactor = 1;
  if (fitToScreen) {
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    mesh.getWorldScale(worldScale);
    const largestScale = Math.max(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z));
    const diameter = 2 * geometry.boundingSphere!.radius * largestScale * pixelsPerUnit * growthAllowance;
    const neededAround = Math.max(6, Math.ceil((Math.PI * diameter) / pixelsPerSegment));
    // Snap to quarters, so creatures of similar size share the same reduced shapes.
    screenFactor = Math.ceil(Math.min(1, neededAround / around) * 4) / 4;
  }
  // Snap to twentieths, so a quality slider shares reduced shapes between nearby positions.
  const factor = Math.round(Math.min(screenFactor, quality) * 20) / 20;
  if (factor >= 1) return null;
  if (recipe) return rebuiltFromRecipe(geometry, recipe, factor);

  const key = shapeKey(geometry);
  if (!isPristine(geometry, key)) return null;
  const reducedKey = `${key}@${factor}`;
  let reduced = reducedCache.get(reducedKey);
  if (!reduced) {
    const built = buildShape(geometry.type, geometry.parameters, factor);
    if (!built) return null;
    reduced = built;
    reducedGeometries.add(reduced);
    reducedCache.set(reducedKey, reduced);
  }
  return reduced;
}

type Swap = { mesh: THREE.Mesh; original: THREE.BufferGeometry; reduced: THREE.BufferGeometry };

function restore(swaps: Swap[]) {
  for (const { mesh, original, reduced } of swaps) {
    // React may have given the mesh a new geometry since; only undo our own swap.
    if (mesh.geometry === reduced) mesh.geometry = original;
  }
  swaps.length = 0;
}

/**
 * Rebuilds the rounded shapes of its children with only as many segments as their size on
 * screen needs, and with `quality` (0–1) of their full segments at most. Shapes that were
 * reshaped after they were built are left alone, and turning `enabled` off with full quality
 * restores the original geometry. `isHeld` delays it, for example while a creature is still
 * shown large.
 */
export function GeometryDetailReducer({
  enabled,
  quality = 1,
  isHeld,
  children,
}: {
  enabled: boolean;
  quality?: number;
  isHeld?: (elapsed: number) => boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const swapsRef = useRef<Swap[]>([]);
  const appliedRef = useRef(false);
  const active = enabled || quality < 1;

  // Any change starts over from the original geometry, which the next frame reduces again.
  useEffect(() => {
    restore(swapsRef.current);
    appliedRef.current = false;
  }, [enabled, quality]);

  useEffect(() => {
    const swaps = swapsRef.current;
    return () => restore(swaps);
  }, []);

  useFrame(({ camera, clock }) => {
    const root = rootRef.current;
    if (!active || appliedRef.current || !root || !(camera instanceof THREE.OrthographicCamera)) return;
    if (isHeld?.(clock.elapsedTime) || !takeBudget(clock.elapsedTime)) return;
    root.updateWorldMatrix(true, true);
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.mergedStaticMesh) return;
      const reduced = reducedGeometryFor(mesh, camera.zoom, enabled, quality);
      if (!reduced) return;
      swapsRef.current.push({ mesh, original: mesh.geometry, reduced });
      mesh.geometry = reduced;
    });
    appliedRef.current = true;
  });

  return <group ref={rootRef}>{children}</group>;
}
