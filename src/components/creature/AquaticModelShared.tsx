"use client";

import { useFrame } from "@react-three/fiber";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CreaturePiece } from "@/components/creature/CreatureModel";
import { applyAddonModelOverrides } from "@/lib/creature/addonOverrides";
import { traitMarksTag } from "@/lib/creature/modelOverrides";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import { creatureColorPalette, type CreatureColorPalette } from "@/lib/creature/colorPalettes";
import { withDetailRecipe } from "@/lib/creature/geometryDetail";
import type { CreaturePartId } from "@/types/exhibition";

export function aquaticPalette(
  pieces: CreaturePiece[],
  baseSeed?: string,
  colorPalette?: CreatureColorPalette,
) {
  const signature = baseSeed ?? pieces[0]?.artifactId ?? "new";
  const palette = colorPalette ?? creatureColorPalette(signature);
  const base = new THREE.Color(palette.body);
  return {
    body: base.getStyle(),
    light: palette.belly,
    dark: palette.marking,
    accent: palette.fin,
  };
}

/** Marks the group a trait grows inside, so camera fitting can measure the trait at full size. */
export const growingTraitTag = "growingTrait";

/**
 * A trait that is about to emerge during a reveal: it stays collapsed while `growing` is
 * false, so the creature reads as it was before, then grows out of the body.
 */
export const TraitGrowthContext = createContext<{ artifactId?: string; growing: boolean }>({ growing: false });

export function GrowingTrait({ active, held = false, children }: { active: boolean; held?: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const startedAt = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (!ref.current || !active) return;
    if (held) {
      startedAt.current = null;
      ref.current.scale.setScalar(0.001);
      return;
    }
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAt.current;
    const progress = Math.min(1, elapsed / 2.2);
    const eased = 1 - Math.pow(1 - progress, 3);
    const settle = progress < 1 ? Math.sin(progress * Math.PI * 4) * (1 - progress) * 0.16 : 0;
    ref.current.scale.setScalar(Math.max(0.001, eased + settle));
    ref.current.rotation.z = (1 - eased) * -0.35;
  });

  return <group ref={ref} scale={active ? 0.001 : 1} userData={active ? { [growingTraitTag]: true } : undefined}>{children}</group>;
}

function TraitMaterial({ color, highlighted, opacity = 1, glow = 0.24 }: { color: string; highlighted: boolean; opacity?: number; glow?: number }) {
  return (
    <meshToonMaterial
      color={color}
      emissive={color}
      emissiveIntensity={highlighted ? 0.85 : glow}
      transparent={opacity < 1}
      opacity={opacity}
      side={THREE.DoubleSide}
      // Two-pass rendering of see-through double-sided traits recompiles their shader every frame.
      forceSinglePass
    />
  );
}

export type TraitMount = "top" | "bottom" | "left" | "right";

function hashUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

// The beak always grows from the mouth; every other trait can grow from any side of the body.
const mouthPartIds = new Set<CreaturePartId>(["cockatoo-beak"]);
// Volumetric traits stand off the flanks; flat ones fold down so their face turns toward the viewer.
const volumetricPartIds = new Set<CreaturePartId>(["inner-eye", "heart-plume", "helping-arms"]);
const traitSides: TraitMount[] = ["top", "bottom", "left", "right"];

// Lets the creature editor reshuffle trait positions or pin every trait to one side.
export const TraitPreviewContext = createContext<{ seed?: string; side?: TraitMount }>({});

// How far along a side traits may sit, from tail to head, and how far apart two traits on one side stay.
const alongLimit = { mixed: 0.45, forced: 0.8 };
const alongGap = 0.22;
const mountAttempts = 24;

/**
 * Each trait keeps the spot it first grew on: traits are placed in the order they were found, and a
 * new one draws a seeded random side and spot, drawing again while that spot is already taken. The
 * traits found before it never move.
 */
function assignMounts(pieces: CreaturePiece[], signature: string, forcedSide?: TraitMount, radial = false) {
  const limit = forcedSide ? alongLimit.forced : alongLimit.mixed;
  const mounts: Record<string, { mount: TraitMount; along: number }> = {};
  const taken: Array<{ mount: TraitMount; along: number }> = [];
  // How much room a spot leaves to the nearest trait on the same side; a face arm of a radial body holds one trait.
  const room = (mount: TraitMount, along: number) => taken.reduce((nearest, other) => {
    if (other.mount !== mount) return nearest;
    if (radial && (mount === "left" || mount === "right")) return radialArm(mount, other.along) === radialArm(mount, along) ? 0 : nearest;
    return Math.min(nearest, Math.abs(other.along - along));
  }, Infinity);
  for (const piece of pieces) {
    if (mouthPartIds.has(piece.partId)) continue;
    let best: { mount: TraitMount; along: number; room: number } | null = null;
    for (let attempt = 0; attempt < mountAttempts; attempt += 1) {
      const draw = `${signature}:${piece.artifactId}:${attempt}`;
      const mount = forcedSide ?? traitSides[Math.floor(hashUnit(`${draw}:side`) * traitSides.length) % traitSides.length];
      const along = (hashUnit(`${draw}:along`) * 2 - 1) * limit;
      const spotRoom = room(mount, along);
      if (!best || spotRoom > best.room) best = { mount, along, room: spotRoom };
      if (spotRoom >= alongGap) break;
    }
    // When every side is crowded, the trait takes the roomiest spot it drew.
    mounts[piece.artifactId] = { mount: best!.mount, along: best!.along };
    taken.push(mounts[piece.artifactId]);
  }
  return mounts;
}

function shapeFrom(points: Array<[number, number]>) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => (index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  return shape;
}

// A leaf-like outline from the base (0, 0) to the tip (0, length), bending sideways by `bend`.
function leafShape(length: number, width: number, bend = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.35, 0);
  shape.bezierCurveTo(-width, length * 0.3, -width * 0.6 + bend, length * 0.8, bend, length);
  shape.bezierCurveTo(width * 0.6 + bend, length * 0.75, width, length * 0.3, width * 0.35, 0);
  shape.closePath();
  return shape;
}

// A tube along `curve` whose radius goes from `radius` at its start to `radius * end` at its end.
// `detail` scales its segment counts, for creatures shown small.
/**
 * Closes both ends of a tube built by THREE.TubeGeometry, so no add-on ever shows a hollow
 * opening, whichever way it is mounted.
 */
function cappedTube(geometry: THREE.BufferGeometry, tubular: number, radial: number) {
  const positions = geometry.getAttribute("position");
  const ringCenter = (ring: number) => {
    const center = new THREE.Vector3();
    for (let side = 0; side < radial; side += 1) center.add(new THREE.Vector3().fromBufferAttribute(positions, ring * (radial + 1) + side));
    return center.divideScalar(radial);
  };
  const cap = (ring: number, neighbour: number) => {
    const center = ringCenter(ring);
    const facing = center.clone().sub(ringCenter(neighbour)).normalize();
    const capPositions = [center.x, center.y, center.z];
    const normals = [facing.x, facing.y, facing.z];
    for (let side = 0; side <= radial; side += 1) {
      const index = ring * (radial + 1) + side;
      capPositions.push(positions.getX(index), positions.getY(index), positions.getZ(index));
      normals.push(facing.x, facing.y, facing.z);
    }
    const indices: number[] = [];
    for (let side = 1; side <= radial; side += 1) indices.push(0, side, side + 1);
    const capGeometry = new THREE.BufferGeometry();
    capGeometry.setAttribute("position", new THREE.Float32BufferAttribute(capPositions, 3));
    capGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    capGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((radial + 2) * 2).fill(0), 2));
    capGeometry.setIndex(indices);
    return capGeometry;
  };
  return mergeGeometries([geometry, cap(0, 1), cap(tubular, tubular - 1)], false);
}

function taperedTube(curve: THREE.Curve<THREE.Vector3>, radius: number, end = 0.15, detail = 1) {
  const tubular = Math.max(8, Math.round(48 * detail));
  const radial = Math.max(5, Math.round(10 * detail));
  const geometry = new THREE.TubeGeometry(curve, tubular, radius, radial, false);
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (let ring = 0; ring <= tubular; ring += 1) {
    const t = ring / tubular;
    const center = curve.getPointAt(t);
    const taper = 1 - (1 - end) * Math.pow(t, 1.4);
    for (let side = 0; side <= radial; side += 1) {
      const index = ring * (radial + 1) + side;
      vertex.fromBufferAttribute(positions, index).sub(center).multiplyScalar(taper).add(center);
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  geometry.computeVertexNormals();
  return cappedTube(geometry, tubular, radial);
}

function curve(points: Array<[number, number, number]>) {
  return new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
}

// Moves a geometry so it is centred on x and its lowest point sinks `sink` below the skin.
// A single bevel step keeps the outline and thickness of a rounded one; on parts this thin it reads the same at half the triangles.
const flatExtrude = { depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 18 };
const thinExtrude = { ...flatExtrude, depth: 0.015, bevelThickness: 0.012, bevelSize: 0.012 };

const traitShapes = {
  comb: shapeFrom([
    [-0.42, 0], [-0.4, 0.34], [-0.3, 0.12], [-0.2, 0.46], [-0.1, 0.16], [0, 0.56],
    [0.1, 0.16], [0.2, 0.46], [0.3, 0.12], [0.4, 0.34], [0.42, 0],
  ]),
  flame: leafShape(0.78, 0.2, -0.16),
  scale: leafShape(0.55, 0.34),
  glassFin: leafShape(0.72, 0.34, -0.22),
  page: (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.14, 0.02, 0.3, 0.04, 0.32, 0.1);
    shape.bezierCurveTo(0.34, 0.3, 0.28, 0.5, 0.18, 0.58);
    shape.bezierCurveTo(0.1, 0.62, 0.04, 0.64, 0, 0.64);
    shape.closePath();
    return shape;
  })(),
  surfFin: (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.22, 0);
    shape.bezierCurveTo(0.12, 0.26, -0.12, 0.5, -0.42, 0.64);
    shape.bezierCurveTo(-0.34, 0.46, -0.24, 0.24, -0.26, 0);
    shape.closePath();
    return shape;
  })(),
  fan: (() => {
    // A half-fan whose rim is scalloped like a frilled gill.
    const shape = new THREE.Shape();
    shape.moveTo(-0.08, 0);
    for (let lobe = 0; lobe < 5; lobe += 1) {
      const from = Math.PI - (lobe / 5) * Math.PI;
      const to = Math.PI - ((lobe + 1) / 5) * Math.PI;
      const middle = (from + to) / 2;
      if (lobe === 0) shape.lineTo(Math.cos(from) * 0.34, Math.sin(from) * 0.34);
      shape.quadraticCurveTo(Math.cos(middle) * 0.46, Math.sin(middle) * 0.46, Math.cos(to) * 0.34, Math.sin(to) * 0.34);
    }
    shape.lineTo(0.08, 0);
    shape.closePath();
    return shape;
  })(),
};

const traitGeometries = {
  lure: withDetailRecipe(48, (detail) => taperedTube(new THREE.LineCurve3(new THREE.Vector3(0, -0.12, 0), new THREE.Vector3(0, 0.72, 0)), 0.05, 0.5, detail)),
  thorn: (() => {
    // Few radial segments keep the spine faceted, like a crystal grown into a thorn.
    const path = curve([[0, -0.12, 0], [0.02, 0.3, 0], [-0.1, 0.6, 0], [-0.26, 0.78, 0]]);
    const geometry = new THREE.TubeGeometry(path, 12, 0.13, 5, false);
    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let ring = 0; ring <= 12; ring += 1) {
      const center = path.getPointAt(ring / 12);
      for (let side = 0; side <= 5; side += 1) {
        const index = ring * 6 + side;
        vertex.fromBufferAttribute(positions, index).sub(center).multiplyScalar(1 - 0.95 * (ring / 12)).add(center);
        positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
      }
    }
    return cappedTube(geometry, 12, 5).toNonIndexed();
  })(),
  beak: withDetailRecipe(48, (detail) => taperedTube(curve([[0, -0.12, 0], [0.08, 0.2, 0], [0.26, 0.34, 0], [0.42, 0.26, 0]]), 0.17, 0.08, detail)),
  // A fiddlehead: a short stem that rolls into a spiral.
  curl: withDetailRecipe(48, (detail) => taperedTube(curve([
    [0, -0.12, 0],
    [0.01, 0.2, 0],
    ...Array.from({ length: 16 }, (_, index) => {
      const t = index / 15;
      const angle = Math.PI - t * Math.PI * 2.1;
      const radius = 0.15 * (1 - t * 0.75);
      return [0.15 + Math.cos(angle) * radius, 0.4 + Math.sin(angle) * radius, 0] as [number, number, number];
    }),
  ]), 0.065, 0.35, detail)),
  // One barnacle, a unit tall: a ribbed cone of fused plates rising to a lipped crater that dips back in.
  barnacle: withDetailRecipe(30, (detail) => {
    const profile: Array<[number, number]> = [[0.5, -0.04], [0.47, 0.18], [0.39, 0.46], [0.28, 0.72], [0.22, 0.84], [0.19, 0.86], [0.16, 0.82], [0.13, 0.62], [0.001, 0.58]];
    const around = Math.max(12, Math.round(30 * detail));
    const positions: number[] = [];
    const indices: number[] = [];
    profile.forEach(([radius, y]) => {
      for (let step = 0; step <= around; step += 1) {
        const angle = (step / around) * Math.PI * 2;
        // Six plates make the wall bulge out between their seams.
        const ribbed = radius * (1 + 0.07 * Math.abs(Math.cos(angle * 3)));
        positions.push(Math.cos(angle) * ribbed, y, Math.sin(angle) * ribbed);
      }
    });
    for (let ring = 0; ring < profile.length - 1; ring += 1) {
      for (let step = 0; step < around; step += 1) {
        const a = ring * (around + 1) + step;
        const b = a + around + 1;
        // Up the profile and around the axis, this order faces the wall outward.
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }),
  // A sea anemone's squat column, flaring slightly into the rim that carries its tentacles.
  anemoneColumn: new THREE.CylinderGeometry(0.17, 0.2, 0.1, 24),
  // One short tentacle rising from the rim and curling in over the centre.
  anemoneTentacle: withDetailRecipe(10, (detail) => taperedTube(curve([[0, 0, 0], [0.005, 0.07, 0], [-0.03, 0.12, 0], [-0.07, 0.13, 0]]), 0.028, 0.45, detail)),
};
traitGeometries.thorn.computeVertexNormals();

// Three parallel streamers that trail backward and sway one after another, like a wake through the water.
function StreamingLines({ color, highlighted }: { color: string; highlighted: boolean }) {
  const lineRefs = useRef<Array<THREE.Group | null>>([]);
  const offsets = [-0.17, 0, 0.17];

  useFrame(({ clock }) => {
    lineRefs.current.forEach((line, index) => {
      if (line) line.rotation.z = Math.sin(clock.elapsedTime * 2.6 - index * 0.7) * 0.1;
    });
  });

  return (
    <group rotation={[0, 0, 0.85]}>
      {offsets.map((offset, index) => {
        const length = 1.1 + index * 0.22;
        return (
          <group key={offset} position={[offset, 0, 0]} ref={(node) => { lineRefs.current[index] = node; }}>
            {/* Each streamer starts a little below the mount, so it stays rooted where the body curves away. */}
            <mesh position={[0, length / 2 - 0.12, 0]}>
              <capsuleGeometry args={[0.075, length, 6, 12]} />
              <TraitMaterial color={color} highlighted={highlighted} opacity={0.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Bubbles of tank water welling out of the skin: x, y, z and radius, largest at the pore, smaller as they rise. */
const seepingBubbles: Array<[number, number, number, number]> = [
  [0, 0.05, 0, 0.13],
  [0.15, 0.04, 0.03, 0.075],
  [-0.13, 0.03, -0.02, 0.065],
  [0.04, 0.27, 0, 0.09],
  [-0.08, 0.42, 0.02, 0.062],
  [0.09, 0.51, -0.02, 0.046],
  [-0.02, 0.63, 0, 0.034],
  [0.06, 0.73, 0, 0.024],
];

// A cluster of glassy bubbles seeping out through the skin, as if the creature itself is leaking.
function SeepingBubbles({ color, highlighted }: { color: string; highlighted: boolean }) {
  const bubbleRefs = useRef<Array<THREE.Group | null>>([]);

  useFrame(({ clock }) => {
    bubbleRefs.current.forEach((bubble, index) => {
      if (!bubble || index < 3) return;
      // Risen bubbles wobble a little as they drift; the ones still welling out of the pore stay put.
      const [x, y] = seepingBubbles[index];
      bubble.position.x = x + Math.sin(clock.elapsedTime * 1.3 + index * 1.7) * 0.018;
      bubble.position.y = y + Math.sin(clock.elapsedTime * 0.9 + index) * 0.012;
    });
  });

  return (
    <>
      {seepingBubbles.map(([x, y, z, radius], index) => (
        <group key={index} position={[x, y, z]} ref={(node) => { bubbleRefs.current[index] = node; }}>
          <mesh>
            <sphereGeometry args={[radius, 18, 14]} />
            <TraitMaterial color={color} highlighted={highlighted} opacity={0.55} glow={0.5} />
          </mesh>
          {/* A glint on each bubble's upper side reads as curved, glassy water. */}
          <mesh position={[-radius * 0.42, radius * 0.47, radius * 0.69]} scale={[1, 0.7, 0.45]}>
            <sphereGeometry args={[radius * 0.22, 8, 6]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={0.75} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** A cluster of barnacles on the skin: x, z, height, and how far each leans out (around x and z). */
const barnacles: Array<[number, number, number, number, number]> = [
  [0, 0, 0.36, 0, 0],
  [0.2, 0.05, 0.25, 0.1, -0.4],
  [-0.19, -0.03, 0.27, -0.05, 0.38],
  [0.06, 0.19, 0.2, 0.42, -0.1],
  [-0.08, -0.19, 0.22, -0.4, 0.12],
  [0.17, -0.16, 0.16, -0.32, -0.3],
  [-0.18, 0.15, 0.15, 0.3, 0.32],
];

// Barnacles grown over the skin: small sand-coloured chambers, each closing over what it keeps.
function BarnacleCluster({ color, highlighted }: { color: string; highlighted: boolean }) {
  return (
    <>
      {barnacles.map(([x, z, height, leanX, leanZ], index) => (
        <group key={index} position={[x, -0.02, z]} rotation={[leanX, index * 0.9, leanZ]} scale={[height * 1.1, height * 0.8, height * 1.1]}>
          <mesh geometry={traitGeometries.barnacle}>
            <TraitMaterial color={color} highlighted={highlighted} glow={0.3} />
          </mesh>
          {/* The two little plates that close the crater, meeting in a seam. */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.055, 0.63, 0]} rotation={[0, 0, side * -0.35]} scale={[0.07, 0.05, 0.11]}>
              <sphereGeometry args={[1, 10, 8]} />
              <TraitMaterial color={color} highlighted={highlighted} glow={0.08} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Tentacle rings of the anemone: how far out from the centre they rise, how many there are and how large. */
const anemoneRings = [
  { radius: 0.155, count: 18, size: 1.1 },
  { radius: 0.09, count: 11, size: 0.8 },
];

// A low sea anemone hugging the skin, its short tentacles curled in over its centre: a shelter that keeps close.
function SeaAnemone({ color, highlighted }: { color: string; highlighted: boolean }) {
  const tentacleRefs = useRef<Array<THREE.Group | null>>([]);
  const tentacles = anemoneRings.flatMap((ring, ringIndex) => Array.from({ length: ring.count }, (_, index) => ({
    ...ring,
    angle: (index / ring.count) * Math.PI * 2 + ringIndex * 0.2,
  })));

  useFrame(({ clock }) => {
    tentacleRefs.current.forEach((tentacle, index) => {
      // Each tentacle sways a little in and out, in a ripple running round the ring.
      if (tentacle) tentacle.rotation.z = Math.sin(clock.elapsedTime * 1.4 + index * 0.6) * 0.12;
    });
  });

  return (
    <>
      <mesh position={[0, 0.02, 0]} geometry={traitGeometries.anemoneColumn}>
        <TraitMaterial color={color} highlighted={highlighted} glow={0.25} />
      </mesh>
      <mesh position={[0, 0.07, 0]} scale={[0.17, 0.035, 0.17]}>
        <sphereGeometry args={[1, 20, 10]} />
        <TraitMaterial color={color} highlighted={highlighted} glow={0.6} />
      </mesh>
      {tentacles.map(({ radius, size, angle }, index) => (
        // Turned so each tentacle's curl points toward the centre.
        <group key={index} position={[Math.cos(angle) * radius, 0.06, Math.sin(angle) * radius]} rotation={[0, -angle, 0]}>
          <group ref={(node) => { tentacleRefs.current[index] = node; }} scale={size}>
            <mesh geometry={traitGeometries.anemoneTentacle}>
              <TraitMaterial color={color} highlighted={highlighted} glow={0.45} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

// One form per part, built in a mount frame: origin on the skin, +y pointing away from the body
// and +x pointing toward the head. Every form stands in the xy plane so it reads from any side.
function AquaticTraitForm({ partId, color, highlighted }: { partId: CreaturePartId; color: string; highlighted: boolean }) {
  const material = <TraitMaterial color={color} highlighted={highlighted} />;
  switch (partId) {
    case "signal-antenna":
      return (
        <>
          <mesh geometry={traitGeometries.lure}>{material}</mesh>
          <mesh position={[0, 0.78, 0]}><sphereGeometry args={[0.11, 16, 12]} /><TraitMaterial color={color} highlighted={highlighted} glow={1.2} /></mesh>
        </>
      );
    case "goliath-horns":
      return <mesh position={[0, -0.06, -0.05]}><extrudeGeometry args={[traitShapes.comb, { ...flatExtrude, depth: 0.06, curveSegments: 4 }]} />{material}</mesh>;
    case "spark-plume":
      return <mesh position={[0, -0.06, -0.03]}><extrudeGeometry args={[traitShapes.flame, flatExtrude]} /><TraitMaterial color={color} highlighted={highlighted} glow={0.7} /></mesh>;
    case "barcode-fin":
      // Bars of a barcode, standing side by side like the rays of a fin.
      return (
        <group position={[0, -0.04, -0.02]}>
          {[[-0.21, 0.07, 0.42], [-0.11, 0.035, 0.52], [-0.03, 0.08, 0.58], [0.07, 0.035, 0.52], [0.14, 0.06, 0.44], [0.22, 0.035, 0.34]].map(([x, width, height]) => (
            <mesh key={x} position={[x, height / 2, 0]}><boxGeometry args={[width, height, 0.05]} />{material}</mesh>
          ))}
        </group>
      );
    case "fortune-cards":
      // Three cards fanned out from one corner, like a tarot spread held in a hand.
      return (
        <group position={[0, -0.06, -0.02]}>
          {[-0.42, 0, 0.42].map((angle) => (
            <group key={angle} rotation={[0, 0, angle]}>
              <mesh position={[0, 0.27, angle * 0.06]}><boxGeometry args={[0.24, 0.4, 0.035]} />{material}</mesh>
              <mesh position={[0, 0.3, angle * 0.06 + 0.02]}><sphereGeometry args={[0.045, 12, 8]} /><TraitMaterial color={color} highlighted={highlighted} glow={0.9} /></mesh>
            </group>
          ))}
        </group>
      );
    case "crystal-spines":
      return <mesh geometry={traitGeometries.thorn}><TraitMaterial color={color} highlighted={highlighted} opacity={0.86} /></mesh>;
    case "helping-arms":
      return <SeepingBubbles color={color} highlighted={highlighted} />;
    case "surfer-feet":
      return <mesh position={[0, -0.06, -0.02]}><extrudeGeometry args={[traitShapes.surfFin, flatExtrude]} />{material}</mesh>;
    case "sand-hourglass":
      return <BarnacleCluster color={color} highlighted={highlighted} />;
    case "route-tail":
      return <StreamingLines color={color} highlighted={highlighted} />;
    case "cockatoo-beak":
      return <mesh geometry={traitGeometries.beak}>{material}</mesh>;
    case "inner-eye":
      return (
        <>
          {/* A whole squashed sphere: its lower half sinks into the body, so the eye has no open rim to show. */}
          <mesh scale={[1, 0.7, 1]}><sphereGeometry args={[0.24, 20, 16]} />{material}</mesh>
          <mesh position={[0, 0.15, 0]} scale={[1, 0.5, 1]}><sphereGeometry args={[0.1, 14, 10]} /><meshBasicMaterial color="#071015" /></mesh>
        </>
      );
    case "heart-plume":
      return <SeaAnemone color={color} highlighted={highlighted} />;
    case "memory-crown":
      return <mesh position={[0, -0.05, -0.02]} rotation={[0, 0, 0.3]}><extrudeGeometry args={[traitShapes.scale, flatExtrude]} /><TraitMaterial color={color} highlighted={highlighted} glow={0.45} /></mesh>;
    case "archive-ears":
      return <mesh position={[0, -0.04, -0.01]}><extrudeGeometry args={[traitShapes.fan, thinExtrude]} />{material}</mesh>;
    case "orbit-ring":
      return <mesh geometry={traitGeometries.curl}><TraitMaterial color={color} highlighted={highlighted} glow={0.6} /></mesh>;
    case "glass-wings":
      return <mesh position={[0, -0.05, -0.01]}><extrudeGeometry args={[traitShapes.glassFin, thinExtrude]} /><TraitMaterial color={color} highlighted={highlighted} opacity={0.55} /></mesh>;
    case "page-fins":
      // A fin folded along its spine like a half-open page.
      return (
        <group position={[0, -0.05, 0]}>
          {[0.55, Math.PI - 0.55].map((angle) => (
            <mesh key={angle} rotation={[0, angle, 0]}>
              <extrudeGeometry args={[traitShapes.page, thinExtrude]} />
              {material}
            </mesh>
          ))}
        </group>
      );
  }
}

/** An add-on with the adjustments saved for it in the creature editor, on every creature that carries it. */
export function AquaticAddon({ partId, color, highlighted = false }: { partId: CreaturePartId; color: string; highlighted?: boolean }) {
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const apply = () => applyAddonModelOverrides(root, partId);
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ partId?: CreaturePartId }>).detail;
      if (!detail?.partId || detail.partId === partId) apply();
    };
    apply();
    window.addEventListener("addon-model-overrides-updated", handleUpdate);
    return () => window.removeEventListener("addon-model-overrides-updated", handleUpdate);
  }, [partId]);

  return (
    <group ref={ref}>
      <AquaticTraitForm partId={partId} color={color} highlighted={highlighted} />
    </group>
  );
}

const skinInset = 0.02;
const mouthInset = 0.06;

function isInsideTraitMarks(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (node.userData[traitMarksTag]) return true;
  }
  return false;
}

// Flat fins, outlines and see-through veils are not skin a trait can grow from.
function isSkin(object: THREE.Object3D) {
  if (!object.visible || isInsideTraitMarks(object)) return false;
  const mesh = object as THREE.Mesh;
  if (mesh.geometry instanceof THREE.ShapeGeometry) return false;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.every((material) => material && material.side !== THREE.BackSide && (!material.transparent || material.opacity >= 0.6));
}

// Spines, tusks and other cones stick out past the mouth, so the beak looks past them.
function isMouthSkin(object: THREE.Object3D) {
  return isSkin(object) && !((object as THREE.Mesh).geometry instanceof THREE.ConeGeometry);
}

type TraitMouth = { y: number; x?: number; facing?: "forward" | "viewer" };
/** `radial` bodies are flat discs facing the viewer: traits grow out of the rim and from the front and back faces. */
type TraitLayout = { x: number; y: number; cx: number; cy: number; z: number; scale: number; vertical?: boolean; radial?: boolean; mouth: TraitMouth };

const flankTilt = { flat: 1.1, volumetric: 0.35 };

/**
 * Where a trait sits on a radial body, as an angle around the centre. Rim traits spread over the
 * upper and lower halves. Face traits each take an arm, since the dips between arms are too narrow
 * to hold them; on the front the top arm stays free for the eyes.
 */
function radialAngle(mount: TraitMount, along: number) {
  if (mount === "top") return Math.PI / 2 - along * Math.PI * 0.9;
  if (mount === "bottom") return -Math.PI / 2 + along * Math.PI * 0.9;
  return Math.PI / 2 + (radialArm(mount, along) / 5) * Math.PI * 2;
}

/** The arm a face trait sits on; the front skips the top arm, which holds the eyes. */
function radialArm(mount: TraitMount, along: number) {
  const arms = mount === "right" ? [1, 2, 3, 4] : [0, 1, 2, 3, 4];
  return arms[THREE.MathUtils.clamp(Math.floor((along + 0.5) * arms.length), 0, arms.length - 1)];
}

/** How far out along an arm face traits sit, as a share of the rim's reach. */
const radialFaceReach = 0.6;

function mountRotation(layout: TraitLayout, mount: TraitMount, along: number, volumetric: boolean) {
  const { vertical } = layout;
  if (layout.radial) {
    const angle = radialAngle(mount, along);
    // Rim traits point straight out of the rim; face traits lean outward from the centre.
    if (mount === "top" || mount === "bottom") return new THREE.Euler(0, 0, angle - Math.PI / 2);
    return new THREE.Euler(Math.PI / 2 - flankTilt[volumetric ? "volumetric" : "flat"], 0, angle - Math.PI / 2, "ZYX");
  }
  if (mount === "left" || mount === "right") {
    // The left flank is the right flank mirrored (see mountMirror), so both use the same rotation.
    return new THREE.Euler(Math.PI / 2 - flankTilt[volumetric ? "volumetric" : "flat"], 0, 0);
  }
  // Upright bodies grow their top traits from the back and their bottom traits from the belly.
  if (vertical) return mount === "top" ? new THREE.Euler(0, 0, Math.PI / 2) : new THREE.Euler(Math.PI, 0, Math.PI / 2, "ZYX");
  return mount === "top" ? new THREE.Euler(0, 0, 0) : new THREE.Euler(Math.PI, 0, 0);
}

function mountMirror(mount: TraitMount): [number, number, number] {
  return mount === "left" ? [1, 1, -1] : [1, 1, 1];
}

// The beak points out of the mouth with its hook curving down.
const mouthRotations = {
  forward: new THREE.Euler(0, 0, -Math.PI / 2),
  viewer: new THREE.Euler(0, -Math.PI / 2, -Math.PI / 2, "YZX"),
};

function mountGeometry(layout: TraitLayout, mount: TraitMount, along: number) {
  if (layout.radial) {
    const angle = radialAngle(mount, along);
    const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    if (mount === "top" || mount === "bottom") {
      // Just above the rim's seam, so the ray meets the top skin rather than grazing the edge.
      return { start: new THREE.Vector3(layout.cx, layout.cy, 0.02), outward: radial, reach: Math.max(layout.x, layout.y) };
    }
    const reach = Math.max(layout.x, layout.y) * radialFaceReach;
    return {
      start: new THREE.Vector3(layout.cx, layout.cy, 0).addScaledVector(radial, reach),
      outward: new THREE.Vector3(0, 0, mount === "right" ? 1 : -1),
      reach: layout.z,
    };
  }
  const axis = layout.vertical ? "y" : "x";
  const alongPosition = layout.vertical ? layout.cy + along * layout.y : layout.cx + along * layout.x;
  const start = new THREE.Vector3(layout.cx, layout.cy, 0);
  start[axis] = alongPosition;
  const outward = new THREE.Vector3();
  let reach: number;
  if (mount === "left" || mount === "right") {
    outward.z = mount === "right" ? 1 : -1;
    reach = layout.z;
  } else if (layout.vertical) {
    outward.x = mount === "top" ? -1 : 1;
    reach = layout.x;
  } else {
    outward.y = mount === "top" ? 1 : -1;
    reach = layout.y;
  }
  return { start, outward, reach };
}

function mouthGeometry(layout: TraitLayout, slide = 0) {
  const { mouth } = layout;
  const y = mouth.y + (layout.cy - mouth.y) * slide;
  if (mouth.facing === "viewer") {
    return { start: new THREE.Vector3(mouth.x ?? layout.cx, y, 0), outward: new THREE.Vector3(0, 0, 1), reach: layout.z * 2 };
  }
  return { start: new THREE.Vector3(layout.cx, y, 0), outward: new THREE.Vector3(1, 0, 0), reach: layout.x * 2 };
}

// Casts a ray from outside the body back toward its core and returns the first skin hit in body-local space.
function skinPoint(
  body: THREE.Object3D,
  { start, outward, reach }: { start: THREE.Vector3; outward: THREE.Vector3; reach: number },
  raycaster: THREE.Raycaster,
  accepts = isSkin,
) {
  const origin = body.localToWorld(start.clone().addScaledVector(outward, 20));
  const target = body.localToWorld(start.clone());
  raycaster.set(origin, target.sub(origin).normalize());
  for (const hit of raycaster.intersectObjects(body.children, true)) {
    if (!accepts(hit.object)) continue;
    const point = body.worldToLocal(hit.point.clone());
    const height = point.clone().sub(start).dot(outward);
    if (height > 0 && height <= reach * 1.3) return point.addScaledVector(outward, -skinInset);
  }
  return null;
}

const traitLayouts: Record<Exclude<AquaticForm, "fish">, TraitLayout> = {
  crab: { x: 0.92, y: 0.48, cx: 0, cy: 0.08, z: 0.34, scale: 0.46, mouth: { y: -0.08, facing: "viewer" } },
  jellyfish: { x: 0.78, y: 0.48, cx: 0, cy: 0.42, z: 0.5, scale: 0.44, mouth: { y: 0.2, facing: "viewer" } },
  octopus: { x: 0.66, y: 0.68, cx: 0, cy: 0.36, z: 0.46, scale: 0.44, mouth: { y: 0.28, facing: "viewer" } },
  turtle: { x: 1.08, y: 0.54, cx: 0.04, cy: 0, z: 0.36, scale: 0.48, mouth: { x: 1.25, y: -0.04, facing: "viewer" } },
  ray: { x: 1.14, y: 0.82, cx: 0.18, cy: 0, z: 0.24, scale: 0.46, mouth: { x: 0.9, y: 0, facing: "viewer" } },
  starfish: { x: 1.62, y: 1.62, cx: 0, cy: 0, z: 0.4, scale: 0.4, radial: true, mouth: { y: -0.19, facing: "viewer" } },
  seahorse: { x: 0.48, y: 1.06, cx: 0, cy: 0.02, z: 0.3, scale: 0.38, vertical: true, mouth: { y: 1.1 } },
  seal: { x: 1.16, y: 0.48, cx: 0, cy: 0.02, z: 0.35, scale: 0.48, mouth: { x: 1.12, y: 0.16, facing: "viewer" } },
  shrimp: { x: 1.08, y: 0.4, cx: 0, cy: 0.08, z: 0.28, scale: 0.4, mouth: { y: 0.1 } },
  narwhal: { x: 1.34, y: 0.46, cx: 0, cy: 0.02, z: 0.46, scale: 0.48, mouth: { y: -0.08 } },
  dolphin: { x: 1.18, y: 0.43, cx: 0, cy: 0.02, z: 0.26, scale: 0.5, mouth: { y: -0.035 } },
  whale: { x: 1.56, y: 0.56, cx: 0, cy: 0.02, z: 0.3, scale: 0.56, mouth: { y: -0.05 } },
  clam: { x: 0.86, y: 0.48, cx: 0, cy: 0.04, z: 0.3, scale: 0.42, mouth: { y: 0.04 } },
  pufferfish: { x: 0.94, y: 0.68, cx: 0, cy: 0, z: 0.6, scale: 0.46, mouth: { y: -0.08 } },
};

export function TraitMarks({
  pieces,
  form,
  highlightedPart,
  baseSeed,
  layout: layoutOverride,
}: {
  pieces: CreaturePiece[];
  form: AquaticForm;
  highlightedPart?: CreaturePartId;
  baseSeed?: string;
  layout?: TraitLayout;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [placements, setPlacements] = useState<Record<string, THREE.Vector3>>({});
  const preview = useContext(TraitPreviewContext);
  const growth = useContext(TraitGrowthContext);
  const signature = baseSeed ?? pieces[0]?.artifactId ?? "new";
  const traitSignature = preview.seed ? `${signature}:${preview.seed}` : signature;
  const palette = creatureColorPalette(signature);
  const layout = layoutOverride ?? (form === "fish" ? traitLayouts.seal : traitLayouts[form]);
  const pieceKey = pieces.map((piece) => `${piece.artifactId}/${piece.partId}`).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mounts = useMemo(() => assignMounts(pieces, traitSignature, preview.side, layout.radial), [pieceKey, traitSignature, preview.side, layout.radial]);
  const placementKey = `${form}:${traitSignature}:${preview.side ?? "mixed"}:${JSON.stringify(layout)}:${pieceKey}`;

  // Measure where the creature's skin actually is, so each trait grows out of it.
  useLayoutEffect(() => {
    const body = groupRef.current?.parent;
    if (!body) return;
    body.updateWorldMatrix(true, true);
    const raycaster = new THREE.Raycaster();
    const next: Record<string, THREE.Vector3> = {};
    for (const piece of pieces) {
      const atMouth = mouthPartIds.has(piece.partId);
      // If the ray misses the body there, slide toward the middle until it lands on skin.
      for (let step = 0; step <= 10; step += 1) {
        // Mouth parts sit a little deeper, so they stay rooted even on a thin snout's tip.
        const mouth = mouthGeometry(layout, step / 10);
        const point = atMouth
          ? skinPoint(body, mouth, raycaster, isMouthSkin)?.addScaledVector(mouth.outward, -mouthInset) ?? null
          : skinPoint(body, mountGeometry(layout, mounts[piece.artifactId].mount, mounts[piece.artifactId].along * (1 - step / 10)), raycaster);
        if (point) {
          next[piece.artifactId] = point;
          break;
        }
      }
    }
    setPlacements(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementKey]);

  return (
    <group ref={groupRef} userData={{ [traitMarksTag]: true }}>
      {pieces.map((piece, index) => {
        const atMouth = mouthPartIds.has(piece.partId);
        const mount = atMouth ? null : mounts[piece.artifactId];
        const fallback = atMouth ? mouthGeometry(layout) : mountGeometry(layout, mount!.mount, mount!.along);
        const position = placements[piece.artifactId] ?? fallback.start.addScaledVector(fallback.outward, fallback.reach);
        const rotation = mount
          ? mountRotation(layout, mount.mount, mount.along, volumetricPartIds.has(piece.partId))
          : mouthRotations[layout.mouth.facing ?? "forward"];
        const highlighted = piece.partId === highlightedPart;
        // During a reveal only the newly found trait grows, even if older traits share its part.
        const emerging = piece.artifactId === growth.artifactId;
        const grows = growth.artifactId ? emerging : highlighted;
        const color = piece.color || [palette.marking, palette.fin, palette.head, palette.belly][index % 4];

        return (
          <group key={piece.artifactId} name={piece.partId} position={position} scale={mount ? mountMirror(mount.mount) : [1, 1, 1]}>
            <group rotation={rotation}>
              <GrowingTrait active={grows} held={emerging && !growth.growing}>
                <group scale={layout.scale * (highlighted ? 1.18 : 1)}>
                  <AquaticAddon partId={piece.partId} color={color} highlighted={highlighted} />
                </group>
              </GrowingTrait>
            </group>
          </group>
        );
      })}
    </group>
  );
}
