"use client";

import { useFrame } from "@react-three/fiber";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { CreaturePiece } from "@/components/creature/CreatureModel";
import { applyAddonModelOverrides } from "@/lib/creature/addonOverrides";
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
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={highlighted ? 0.85 : glow}
      roughness={0.38}
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

// Each creature spreads its traits over the four sides, starting from a seeded preference
// and moving to the least crowded side, then spaces the traits on each side from tail to head.
function assignMounts(pieces: CreaturePiece[], signature: string, forcedSide?: TraitMount) {
  const bySide = new Map<TraitMount, CreaturePiece[]>(traitSides.map((side) => [side, []]));
  const ordered = pieces
    .filter((piece) => !mouthPartIds.has(piece.partId))
    .sort((a, b) => hashUnit(`${signature}:${a.artifactId}:order`) - hashUnit(`${signature}:${b.artifactId}:order`));
  for (const piece of ordered) {
    const preferred = Math.floor(hashUnit(`${signature}:${piece.artifactId}:side`) * traitSides.length);
    let side = forcedSide ?? traitSides[preferred];
    for (let offset = 1; !forcedSide && offset < traitSides.length; offset += 1) {
      const candidate = traitSides[(preferred + offset) % traitSides.length];
      if (bySide.get(candidate)!.length < bySide.get(side)!.length) side = candidate;
    }
    bySide.get(side)!.push(piece);
  }
  const mounts: Record<string, { mount: TraitMount; along: number }> = {};
  for (const [mount, sidePieces] of bySide) {
    sidePieces.forEach((piece, index) => {
      const spread = forcedSide ? 1.6 : 1;
      const along = sidePieces.length === 1
        ? (hashUnit(`${signature}:${piece.artifactId}:along`) - 0.5) * 0.6
        : spread * (-0.5 + ((index + 0.5) / sidePieces.length));
      mounts[piece.artifactId] = { mount, along };
    });
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
  return geometry;
}

function curve(points: Array<[number, number, number]>) {
  return new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
}

function smoothProfile(points: Array<[number, number]>) {
  return new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(28);
}

// Moves a geometry so it is centred on x and its lowest point sinks `sink` below the skin.
function seated(geometry: THREE.BufferGeometry, sink = 0.04) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y - sink, -(box.min.z + box.max.z) / 2);
  return geometry;
}

const flatExtrude = { depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 18 };
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
  lure: withDetailRecipe(48, (detail) => taperedTube(new THREE.LineCurve3(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, 0.72, 0)), 0.05, 0.5, detail)),
  thorn: (() => {
    // Few radial segments keep the spine faceted, like a crystal grown into a thorn.
    const path = curve([[0, -0.05, 0], [0.02, 0.3, 0], [-0.1, 0.6, 0], [-0.26, 0.78, 0]]);
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
    return geometry.toNonIndexed();
  })(),
  beak: withDetailRecipe(48, (detail) => taperedTube(curve([[0, -0.05, 0], [0.08, 0.2, 0], [0.26, 0.34, 0], [0.42, 0.26, 0]]), 0.17, 0.08, detail)),
  // A fiddlehead: a short stem that rolls into a spiral.
  curl: withDetailRecipe(48, (detail) => taperedTube(curve([
    [0, -0.05, 0],
    [0.01, 0.2, 0],
    ...Array.from({ length: 16 }, (_, index) => {
      const t = index / 15;
      const angle = Math.PI - t * Math.PI * 2.1;
      const radius = 0.15 * (1 - t * 0.75);
      return [0.15 + Math.cos(angle) * radius, 0.4 + Math.sin(angle) * radius, 0] as [number, number, number];
    }),
  ]), 0.065, 0.35, detail)),
  // A chambered shell that coils outward from its tiny first chamber.
  shell: withDetailRecipe(48, (detail) => seated(taperedTube(curve(Array.from({ length: 40 }, (_, index) => {
    const angle = (index / 39) * Math.PI * 2.4;
    const radius = 0.03 * Math.exp(angle * 0.28);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, 0] as [number, number, number];
  })), 0.02, 6.5, detail))),
  polyp: new THREE.LatheGeometry(smoothProfile([[0.001, 0], [0.16, 0.01], [0.08, 0.14], [0.07, 0.26], [0.17, 0.36], [0.18, 0.44], [0.08, 0.5], [0.001, 0.48]]), 22),
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
    case "crystal-spines":
      return <mesh geometry={traitGeometries.thorn}><TraitMaterial color={color} highlighted={highlighted} opacity={0.86} /></mesh>;
    case "helping-arms":
      return <SeepingBubbles color={color} highlighted={highlighted} />;
    case "surfer-feet":
      return <mesh position={[0, -0.06, -0.02]}><extrudeGeometry args={[traitShapes.surfFin, flatExtrude]} />{material}</mesh>;
    case "sand-hourglass":
      return <mesh geometry={traitGeometries.shell}>{material}</mesh>;
    case "route-tail":
      return <StreamingLines color={color} highlighted={highlighted} />;
    case "cockatoo-beak":
      return <mesh geometry={traitGeometries.beak}>{material}</mesh>;
    case "inner-eye":
      return (
        <>
          <mesh scale={[1, 0.7, 1]}><sphereGeometry args={[0.24, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />{material}</mesh>
          <mesh position={[0, 0.15, 0]} scale={[1, 0.5, 1]}><sphereGeometry args={[0.1, 14, 10]} /><meshBasicMaterial color="#071015" /></mesh>
        </>
      );
    case "heart-plume":
      return <mesh position={[0, -0.02, 0]} geometry={traitGeometries.polyp}><TraitMaterial color={color} highlighted={highlighted} glow={0.55} /></mesh>;
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

const traitMarksTag = "aquaticTraitMarks";
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
type TraitLayout = { x: number; y: number; cx: number; cy: number; z: number; scale: number; vertical?: boolean; mouth: TraitMouth };

const flankTilt = { flat: 1.1, volumetric: 0.35 };

function mountRotation(mount: TraitMount, vertical: boolean | undefined, volumetric: boolean) {
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
  starfish: { x: 0.84, y: 0.84, cx: 0, cy: 0, z: 0.24, scale: 0.4, mouth: { y: -0.19, facing: "viewer" } },
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
  const mounts = useMemo(() => assignMounts(pieces, traitSignature, preview.side), [pieceKey, traitSignature, preview.side]);
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
          ? mountRotation(mount.mount, layout.vertical, volumetricPartIds.has(piece.partId))
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
