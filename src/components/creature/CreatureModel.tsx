"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { artifactById } from "@/data/artifacts";
import { TraitMarks } from "@/components/creature/AquaticModelShared";
import { creatureColorPalette, type CreatureColorPalette } from "@/lib/creature/colorPalettes";
import type { CreaturePartId, ThemeId } from "@/types/exhibition";
import { PatternedToonMaterial } from "@/components/creature/CreaturePatternMaterial";
import { BodyAttachment, BodyProportions } from "@/components/creature/CreatureLook";

export type CreaturePiece = {
  artifactId: string;
  partId: CreaturePartId;
  color: string;
};

type FishProfile = {
  length: number;
  height: number;
  depth: number;
  head: number;
};


type FishLook = {
  profile: FishProfile;
  body: string;
  head: string;
  belly: string;
  fin: string;
  marking: string;
};

const fishProfiles: Record<ThemeId, FishProfile> = {
  memory: { length: 1.35, height: 0.86, depth: 0.2, head: 0.74 },
  interface: { length: 1.65, height: 0.62, depth: 0.17, head: 0.6 },
  worldmaking: { length: 1.2, height: 0.98, depth: 0.22, head: 0.82 },
  embodiment: { length: 1.55, height: 0.7, depth: 0.18, head: 0.68 },
  agency: { length: 1.4, height: 0.82, depth: 0.21, head: 0.76 },
};

const fishLooks: Record<string, Omit<FishLook, "profile"> & { profile: keyof typeof fishProfiles }> = {
  "finding-frida": { profile: "memory", body: "#2D7786", head: "#3E9299", belly: "#D8C57E", fin: "#E2A53A", marking: "#173D55" },
  "historically-yours": { profile: "agency", body: "#9AA6A2", head: "#687675", belly: "#E7E1CA", fin: "#C47A45", marking: "#303B3C" },
  "from-ingrid-to-bergen": { profile: "interface", body: "#BC6B3D", head: "#D5894F", belly: "#F0D8AD", fin: "#712F2B", marking: "#F1B84A" },
  "your-update-has-failed": { profile: "embodiment", body: "#3D83A6", head: "#23526D", belly: "#D5E7DE", fin: "#E4C33B", marking: "#162C4B" },
  "grand-hotel-bald-cockatoo": { profile: "worldmaking", body: "#EE8A32", head: "#E35F2B", belly: "#F2E6C9", fin: "#202632", marking: "#F4EEE0" },
  "glass-like-fabric": { profile: "memory", body: "#5AC5C3", head: "#2A8CAA", belly: "#D9F0DF", fin: "#7257A8", marking: "#E3D262" },
  "between-page-and-screen": { profile: "agency", body: "#ADB9BA", head: "#62767C", belly: "#E9E7DD", fin: "#2B3E52", marking: "#151B25" },
  "bybanen-slop-surfer": { profile: "interface", body: "#B5C95B", head: "#829735", belly: "#E5E5A7", fin: "#D8A42B", marking: "#405326" },
  emperor: { profile: "memory", body: "#8E83A8", head: "#655C83", belly: "#DAD4DF", fin: "#C2A1D6", marking: "#35314B" },
  "grand-hotel-galactic-center": { profile: "embodiment", body: "#274E93", head: "#1E3570", belly: "#E5C945", fin: "#E0B72B", marking: "#101E4E" },
  "her-name-was-gisberta": { profile: "worldmaking", body: "#D34A79", head: "#A92E59", belly: "#F3B7A3", fin: "#ED7C3D", marking: "#682342" },
  goliath: { profile: "worldmaking", body: "#69884A", head: "#405E3B", belly: "#D6CF83", fin: "#D7A62C", marking: "#26372B" },
  "land-of-crystals": { profile: "memory", body: "#6E9EAE", head: "#456F82", belly: "#DCE9E8", fin: "#A8CED7", marking: "#345361" },
  "grand-hotel-sand-fountain": { profile: "worldmaking", body: "#A98254", head: "#795D40", belly: "#E8D3AA", fin: "#CDAA6D", marking: "#57412E" },
  "fiery-sparks-of-light": { profile: "interface", body: "#C84B35", head: "#913326", belly: "#F3C39F", fin: "#F07845", marking: "#67231F" },
};

const caudalTailShape = new THREE.Shape();
caudalTailShape.moveTo(0, 0.1);
caudalTailShape.bezierCurveTo(-0.2, 0.16, -0.46, 0.54, -0.7, 0.52);
caudalTailShape.quadraticCurveTo(-0.55, 0.2, -0.42, 0.05);
caudalTailShape.quadraticCurveTo(-0.5, 0, -0.42, -0.05);
caudalTailShape.quadraticCurveTo(-0.55, -0.2, -0.7, -0.52);
caudalTailShape.bezierCurveTo(-0.46, -0.54, -0.2, -0.16, 0, -0.1);
caudalTailShape.quadraticCurveTo(0.045, 0, 0, 0.1);

function createCaudalShape(draw: (shape: THREE.Shape) => void) {
  const shape = new THREE.Shape();
  draw(shape);
  return shape;
}

export const caudalTailShapes = [
  caudalTailShape,
  createCaudalShape((shape) => {
    shape.moveTo(0, 0.11);
    shape.bezierCurveTo(-0.24, 0.2, -0.62, 0.5, -0.78, 0.38);
    shape.bezierCurveTo(-0.9, 0.22, -0.9, -0.22, -0.78, -0.38);
    shape.bezierCurveTo(-0.62, -0.5, -0.24, -0.2, 0, -0.11);
    shape.quadraticCurveTo(0.045, 0, 0, 0.11);
  }),
  createCaudalShape((shape) => {
    shape.moveTo(0, 0.1);
    shape.bezierCurveTo(-0.22, 0.18, -0.54, 0.58, -0.82, 0.62);
    shape.quadraticCurveTo(-0.62, 0.24, -0.45, 0.08);
    shape.quadraticCurveTo(-0.58, 0, -0.45, -0.08);
    shape.quadraticCurveTo(-0.62, -0.24, -0.82, -0.62);
    shape.bezierCurveTo(-0.54, -0.58, -0.22, -0.18, 0, -0.1);
    shape.quadraticCurveTo(0.045, 0, 0, 0.1);
  }),
  createCaudalShape((shape) => {
    shape.moveTo(0, 0.1);
    shape.quadraticCurveTo(-0.28, 0.2, -0.66, 0.54);
    shape.quadraticCurveTo(-0.8, 0.18, -0.86, 0);
    shape.quadraticCurveTo(-0.8, -0.18, -0.66, -0.54);
    shape.quadraticCurveTo(-0.28, -0.2, 0, -0.1);
    shape.quadraticCurveTo(0.045, 0, 0, 0.1);
  }),
  createCaudalShape((shape) => {
    shape.moveTo(0, 0.1);
    shape.bezierCurveTo(-0.2, 0.16, -0.48, 0.44, -0.76, 0.46);
    shape.quadraticCurveTo(-0.68, 0.14, -0.82, 0);
    shape.quadraticCurveTo(-0.68, -0.14, -0.76, -0.46);
    shape.bezierCurveTo(-0.48, -0.44, -0.2, -0.16, 0, -0.1);
    shape.quadraticCurveTo(0.045, 0, 0, 0.1);
  }),
];

export type DorsalFinStyle = {
  shape: THREE.Shape;
  width: number;
  height: number;
  x: number;
  rays: Array<[number, number, number, number]>;
};

function createDorsalShape(
  draw: (shape: THREE.Shape) => void,
) {
  const shape = new THREE.Shape();
  draw(shape);
  return shape;
}

export const dorsalFinStyles: DorsalFinStyle[] = [
  {
    shape: createDorsalShape((shape) => {
      shape.moveTo(-0.7, 0);
      shape.lineTo(0.58, 0);
      shape.bezierCurveTo(0.42, 0.12, 0.24, 0.75, -0.04, 0.96);
      shape.bezierCurveTo(-0.19, 1.02, -0.2, 0.3, -0.7, 0);
    }),
    width: 0.9,
    height: 0.86,
    x: -0.18,
    rays: [[0.43, 0.03, -0.03, 0.86], [0.2, 0.03, -0.12, 0.64], [-0.04, 0.03, -0.25, 0.4]],
  },
  {
    shape: createDorsalShape((shape) => {
      shape.moveTo(-0.72, 0);
      shape.lineTo(0.6, 0);
      shape.bezierCurveTo(0.38, 0.08, 0.25, 0.52, -0.02, 0.7);
      shape.bezierCurveTo(-0.24, 0.81, -0.43, 0.2, -0.72, 0);
    }),
    width: 1,
    height: 0.74,
    x: -0.22,
    rays: [[0.42, 0.03, -0.03, 0.63], [0.14, 0.03, -0.2, 0.48], [-0.16, 0.03, -0.38, 0.28]],
  },
  {
    shape: createDorsalShape((shape) => {
      shape.moveTo(-0.68, 0);
      shape.lineTo(0.56, 0);
      shape.lineTo(0.02, 0.9);
      shape.quadraticCurveTo(-0.12, 0.94, -0.68, 0);
    }),
    width: 0.82,
    height: 0.9,
    x: -0.1,
    rays: [[0.43, 0.03, 0.03, 0.82], [0.18, 0.03, -0.07, 0.7], [-0.08, 0.03, -0.27, 0.44]],
  },
  {
    shape: createDorsalShape((shape) => {
      shape.moveTo(-0.74, 0);
      shape.lineTo(0.6, 0);
      shape.bezierCurveTo(0.38, 0.12, 0.2, 0.62, -0.02, 0.78);
      shape.bezierCurveTo(-0.16, 0.84, -0.08, 0.2, -0.74, 0);
    }),
    width: 1.02,
    height: 0.78,
    x: -0.26,
    rays: [[0.43, 0.03, -0.03, 0.69], [0.16, 0.03, -0.09, 0.52], [-0.13, 0.03, -0.28, 0.3]],
  },
  {
    shape: createDorsalShape((shape) => {
      shape.moveTo(-0.76, 0);
      shape.lineTo(0.58, 0);
      shape.bezierCurveTo(0.42, 0.16, 0.28, 0.64, 0.08, 0.82);
      shape.quadraticCurveTo(-0.02, 0.88, -0.08, 0.57);
      shape.quadraticCurveTo(-0.18, 0.69, -0.22, 0.4);
      shape.quadraticCurveTo(-0.36, 0.53, -0.38, 0.25);
      shape.quadraticCurveTo(-0.54, 0.32, -0.76, 0);
    }),
    width: 0.96,
    height: 0.82,
    x: -0.22,
    rays: [[0.43, 0.03, 0.08, 0.76], [0.17, 0.03, -0.1, 0.55], [-0.1, 0.03, -0.27, 0.4], [-0.38, 0.03, -0.48, 0.22]],
  },
  {
    shape: createDorsalShape((shape) => {
      shape.moveTo(-0.92, 0);
      shape.lineTo(0.68, 0);
      shape.bezierCurveTo(0.48, 0.14, 0.34, 0.62, 0.12, 0.72);
      shape.bezierCurveTo(-0.18, 0.82, -0.58, 0.58, -0.92, 0);
    }),
    width: 1.02,
    height: 0.72,
    x: -0.28,
    rays: [[0.52, 0.03, 0.11, 0.65], [0.22, 0.03, -0.13, 0.69], [-0.12, 0.03, -0.43, 0.51], [-0.47, 0.03, -0.67, 0.28]],
  },
  {
    shape: createDorsalShape((shape) => {
      shape.moveTo(-0.82, 0);
      shape.lineTo(0.62, 0);
      shape.lineTo(0.27, 0.82);
      shape.quadraticCurveTo(0.12, 0.69, -0.03, 0.47);
      shape.lineTo(-0.3, 0.7);
      shape.quadraticCurveTo(-0.47, 0.46, -0.82, 0);
    }),
    width: 0.94,
    height: 0.86,
    x: -0.2,
    rays: [[0.5, 0.03, 0.27, 0.72], [0.19, 0.03, -0.01, 0.42], [-0.12, 0.03, -0.3, 0.62], [-0.43, 0.03, -0.58, 0.3]],
  },
  {
    shape: createDorsalShape((shape) => {
      shape.moveTo(-0.7, 0);
      shape.lineTo(0.55, 0);
      shape.bezierCurveTo(0.39, 0.13, 0.12, 0.92, -0.14, 1.18);
      shape.bezierCurveTo(-0.32, 1.2, -0.28, 0.32, -0.7, 0);
    }),
    width: 0.82,
    height: 0.88,
    x: -0.12,
    rays: [[0.42, 0.03, -0.13, 1.08], [0.16, 0.03, -0.2, 0.78], [-0.08, 0.03, -0.32, 0.48]],
  },
];

export type PectoralFinStyle = {
  shape: THREE.Shape;
  width: number;
  height: number;
  rays: Array<[number, number, number, number]>;
};

function createPectoralShape(draw: (shape: THREE.Shape) => void) {
  const shape = new THREE.Shape();
  draw(shape);
  return shape;
}

export const pectoralFinStyles: PectoralFinStyle[] = [
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.12, 0.1);
      shape.bezierCurveTo(-0.18, 0.02, -0.66, -0.28, -0.82, -0.52);
      shape.bezierCurveTo(-0.9, -0.68, -0.7, -0.78, -0.4, -0.7);
      shape.bezierCurveTo(-0.12, -0.52, 0.04, -0.28, 0.11, -0.12);
      shape.quadraticCurveTo(0.19, -0.01, 0.12, 0.1);
    }),
    width: 0.92,
    height: 0.92,
    rays: [[0.07, 0, -0.25, -0.16], [0.06, -0.03, -0.5, -0.3], [0.04, -0.06, -0.69, -0.48], [0.02, -0.09, -0.52, -0.64], [0, -0.12, -0.27, -0.57]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.12, 0.1);
      shape.bezierCurveTo(-0.2, 0.01, -0.72, -0.17, -0.96, -0.45);
      shape.quadraticCurveTo(-0.85, -0.72, -0.46, -0.72);
      shape.quadraticCurveTo(-0.06, -0.48, 0.1, -0.12);
      shape.quadraticCurveTo(0.18, 0, 0.12, 0.1);
    }),
    width: 0.98,
    height: 0.86,
    rays: [[0.07, 0, -0.28, -0.12], [0.06, -0.03, -0.58, -0.23], [0.04, -0.06, -0.82, -0.39], [0.02, -0.09, -0.65, -0.6], [0, -0.12, -0.36, -0.59]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.12, 0.08);
      shape.bezierCurveTo(-0.22, -0.04, -0.76, -0.44, -1.02, -0.78);
      shape.quadraticCurveTo(-0.74, -0.8, -0.43, -0.67);
      shape.quadraticCurveTo(-0.08, -0.4, 0.1, -0.11);
      shape.quadraticCurveTo(0.17, -0.01, 0.12, 0.08);
    }),
    width: 0.94,
    height: 0.94,
    rays: [[0.07, 0, -0.34, -0.24], [0.05, -0.03, -0.58, -0.41], [0.03, -0.06, -0.83, -0.62], [0, -0.1, -0.58, -0.65], [-0.02, -0.12, -0.32, -0.52]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.12, 0.08);
      shape.bezierCurveTo(-0.16, -0.02, -0.6, -0.34, -0.88, -0.68);
      shape.quadraticCurveTo(-0.65, -0.67, -0.44, -0.55);
      shape.bezierCurveTo(-0.2, -0.42, -0.02, -0.23, 0.1, -0.1);
      shape.quadraticCurveTo(0.17, -0.01, 0.12, 0.08);
    }),
    width: 1.02,
    height: 0.88,
    rays: [[0.07, 0, -0.28, -0.2], [0.05, -0.03, -0.5, -0.35], [0.03, -0.06, -0.72, -0.54], [0, -0.1, -0.48, -0.5], [-0.02, -0.12, -0.24, -0.39]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.12, 0.1);
      shape.bezierCurveTo(-0.2, 0.03, -0.72, -0.08, -0.98, -0.34);
      shape.bezierCurveTo(-1.08, -0.5, -0.9, -0.62, -0.61, -0.56);
      shape.bezierCurveTo(-0.28, -0.45, -0.02, -0.22, 0.1, -0.11);
      shape.quadraticCurveTo(0.18, 0, 0.12, 0.1);
    }),
    width: 1.04,
    height: 0.8,
    rays: [[0.07, 0, -0.3, -0.09], [0.05, -0.03, -0.62, -0.18], [0.03, -0.06, -0.88, -0.31], [0, -0.09, -0.78, -0.47], [-0.02, -0.12, -0.42, -0.43]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.12, 0.1);
      shape.bezierCurveTo(-0.18, 0.03, -0.62, -0.22, -0.78, -0.5);
      shape.bezierCurveTo(-0.86, -0.72, -0.59, -0.86, -0.3, -0.7);
      shape.bezierCurveTo(-0.06, -0.49, 0.06, -0.25, 0.11, -0.11);
      shape.quadraticCurveTo(0.18, 0, 0.12, 0.1);
    }),
    width: 0.96,
    height: 0.98,
    rays: [[0.07, 0, -0.22, -0.16], [0.05, -0.03, -0.48, -0.3], [0.03, -0.06, -0.68, -0.48], [0, -0.09, -0.53, -0.68], [-0.02, -0.12, -0.27, -0.59]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.12, 0.07);
      shape.bezierCurveTo(-0.19, -0.04, -0.72, -0.5, -1.12, -0.88);
      shape.quadraticCurveTo(-0.78, -0.83, -0.47, -0.66);
      shape.quadraticCurveTo(-0.11, -0.38, 0.09, -0.1);
      shape.quadraticCurveTo(0.16, -0.01, 0.12, 0.07);
    }),
    width: 0.98,
    height: 0.98,
    rays: [[0.07, 0, -0.35, -0.27], [0.05, -0.03, -0.64, -0.49], [0.02, -0.07, -0.94, -0.73], [0, -0.1, -0.67, -0.68], [-0.02, -0.12, -0.36, -0.51]],
  },
];

export const pelvicFinStyles: PectoralFinStyle[] = [
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.1, 0.06);
      shape.bezierCurveTo(-0.12, 0, -0.43, -0.18, -0.58, -0.38);
      shape.quadraticCurveTo(-0.56, -0.55, -0.32, -0.55);
      shape.quadraticCurveTo(-0.04, -0.34, 0.09, -0.09);
      shape.quadraticCurveTo(0.15, -0.01, 0.1, 0.06);
    }),
    width: 0.68,
    height: 0.68,
    rays: [[0.05, 0, -0.2, -0.14], [0.03, -0.03, -0.4, -0.28], [0, -0.06, -0.35, -0.45]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.1, 0.05);
      shape.bezierCurveTo(-0.12, -0.02, -0.48, -0.34, -0.72, -0.64);
      shape.quadraticCurveTo(-0.48, -0.59, -0.28, -0.46);
      shape.quadraticCurveTo(-0.03, -0.25, 0.09, -0.08);
      shape.quadraticCurveTo(0.15, -0.01, 0.1, 0.05);
    }),
    width: 0.64,
    height: 0.68,
    rays: [[0.05, 0, -0.22, -0.2], [0.03, -0.03, -0.43, -0.38], [0, -0.06, -0.57, -0.54]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.1, 0.05);
      shape.bezierCurveTo(-0.15, -0.03, -0.54, -0.25, -0.78, -0.52);
      shape.quadraticCurveTo(-0.57, -0.58, -0.35, -0.5);
      shape.bezierCurveTo(-0.1, -0.36, 0.03, -0.18, 0.09, -0.08);
      shape.quadraticCurveTo(0.15, -0.01, 0.1, 0.05);
    }),
    width: 0.7,
    height: 0.62,
    rays: [[0.05, 0, -0.25, -0.16], [0.03, -0.03, -0.49, -0.31], [0, -0.06, -0.63, -0.46]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.1, 0.05);
      shape.bezierCurveTo(-0.12, -0.02, -0.43, -0.19, -0.65, -0.43);
      shape.quadraticCurveTo(-0.52, -0.42, -0.38, -0.35);
      shape.quadraticCurveTo(-0.43, -0.52, -0.27, -0.57);
      shape.quadraticCurveTo(-0.05, -0.31, 0.09, -0.08);
      shape.quadraticCurveTo(0.15, -0.01, 0.1, 0.05);
    }),
    width: 0.72,
    height: 0.66,
    rays: [[0.05, 0, -0.2, -0.15], [0.03, -0.03, -0.4, -0.29], [0, -0.06, -0.3, -0.48]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.1, 0.06);
      shape.bezierCurveTo(-0.12, -0.01, -0.46, -0.2, -0.62, -0.43);
      shape.bezierCurveTo(-0.69, -0.57, -0.5, -0.68, -0.29, -0.57);
      shape.quadraticCurveTo(-0.03, -0.34, 0.09, -0.09);
      shape.quadraticCurveTo(0.15, -0.01, 0.1, 0.06);
    }),
    width: 0.76,
    height: 0.7,
    rays: [[0.05, 0, -0.2, -0.14], [0.03, -0.03, -0.42, -0.28], [0, -0.06, -0.49, -0.48], [-0.02, -0.08, -0.25, -0.49]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.1, 0.05);
      shape.bezierCurveTo(-0.1, -0.02, -0.42, -0.35, -0.65, -0.78);
      shape.quadraticCurveTo(-0.44, -0.67, -0.27, -0.5);
      shape.quadraticCurveTo(-0.04, -0.26, 0.09, -0.08);
      shape.quadraticCurveTo(0.15, -0.01, 0.1, 0.05);
    }),
    width: 0.66,
    height: 0.76,
    rays: [[0.05, 0, -0.18, -0.22], [0.03, -0.03, -0.36, -0.43], [0, -0.06, -0.52, -0.66]],
  },
  {
    shape: createPectoralShape((shape) => {
      shape.moveTo(0.1, 0.05);
      shape.bezierCurveTo(-0.13, -0.02, -0.42, -0.2, -0.62, -0.42);
      shape.quadraticCurveTo(-0.5, -0.43, -0.34, -0.37);
      shape.lineTo(-0.45, -0.62);
      shape.quadraticCurveTo(-0.27, -0.55, -0.17, -0.42);
      shape.quadraticCurveTo(-0.02, -0.24, 0.09, -0.08);
      shape.quadraticCurveTo(0.15, -0.01, 0.1, 0.05);
    }),
    width: 0.78,
    height: 0.72,
    rays: [[0.05, 0, -0.2, -0.14], [0.03, -0.03, -0.42, -0.28], [0, -0.06, -0.36, -0.52]],
  },
];

export function creaturePiecesFromArtifactIds(artifactIds: string[]) {
  return artifactIds.flatMap((artifactId) => {
    const artifact = artifactById.get(artifactId);
    return artifact
      ? [{ artifactId, partId: artifact.creaturePart.id, color: artifact.color }]
      : [];
  });
}

function hashUnit(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function shiftedFinColor(
  source: string,
  mix: string,
  mixAmount: number,
  hue: number,
  saturation: number,
  lightness: number,
) {
  return new THREE.Color(source)
    .lerp(new THREE.Color(mix), mixAmount)
    .offsetHSL(hue, saturation, lightness)
    .getStyle();
}

function SoftMaterial({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <meshToonMaterial
      color={color}
      transparent={opacity < 1}
      opacity={opacity}
      side={opacity < 1 ? THREE.DoubleSide : THREE.FrontSide}
      forceSinglePass
    />
  );
}

function DorsalFin({
  style,
  color,
  rayColor,
}: {
  style: DorsalFinStyle;
  color: string;
  rayColor: string;
}) {
  return (
    <>
      {[1, -1].map((side) => (
        <mesh key={`dorsal-surface-${side}`} position={[0, 0, side * 0.006]}>
          <shapeGeometry args={[style.shape, 20]} />
          <SoftMaterial color={color} opacity={0.88} />
        </mesh>
      ))}
      {style.rays.map(([startX, startY, endX, endY], index) => {
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.hypot(dx, dy);
        return (
          <group key={`${startX}-${index}`}>
            {[1, -1].map((side) => (
              <mesh
                key={side}
                position={[(startX + endX) / 2, (startY + endY) / 2, side * 0.012]}
                rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]}
              >
                <capsuleGeometry args={[0.009, Math.max(0.02, length - 0.018), 3, 6]} />
                <meshBasicMaterial color={rayColor} transparent opacity={0.3} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

/** The pectoral fin style a creature grows, picked from its seed like the rest of its fins. */
export function pectoralFinStyleFor(signature: string) {
  return pectoralFinStyles[
    Math.min(pectoralFinStyles.length - 1, Math.floor(hashUnit(`${signature}:pectoral-fin`) * pectoralFinStyles.length))
  ];
}

function PectoralFin({
  style,
  color,
  rayColor,
  side,
}: {
  style: PectoralFinStyle;
  color: string;
  rayColor: string;
  side: number;
}) {
  return (
    <>
      <mesh>
        <shapeGeometry args={[style.shape, 20]} />
        <SoftMaterial color={color} opacity={0.82} />
      </mesh>
      {style.rays.map(([startX, startY, endX, endY], index) => {
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.hypot(dx, dy);
        return (
          <mesh
            key={`${endX}-${index}`}
            position={[(startX + endX) / 2, (startY + endY) / 2, 0.012 * side]}
            rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]}
          >
            <capsuleGeometry args={[0.008, Math.max(0.02, length - 0.016), 3, 6]} />
            <meshBasicMaterial color={rayColor} transparent opacity={0.28} />
          </mesh>
        );
      })}
    </>
  );
}

export function CreatureModel({
  pieces,
  baseSeed,
  animated = true,
  highlightedPart,
  scale = 1,
  colorPalette: encodedColorPalette,
}: {
  pieces: CreaturePiece[];
  baseSeed?: string;
  animated?: boolean;
  highlightedPart?: CreaturePartId;
  scale?: number;
  colorPalette?: CreatureColorPalette;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const dorsalRef = useRef<THREE.Group>(null);
  const finRef = useRef<THREE.Group>(null);
  const pelvicRef = useRef<THREE.Group>(null);
  const eyeRefs = useRef<Array<THREE.Group | null>>([]);
  const pupilRefs = useRef<Array<THREE.Mesh | null>>([]);
  const signature = baseSeed ?? pieces[0]?.artifactId ?? "new";
  const lookIds = Object.keys(fishLooks);
  const baseLookId = lookIds[Math.min(lookIds.length - 1, Math.floor(hashUnit(`${signature}:base-look`) * lookIds.length))];
  const configuredLook = fishLooks[baseLookId];
  const profile = fishProfiles[configuredLook.profile];
  const proportions = useMemo(() => ({
    length: profile.length * (0.96 + hashUnit(`${signature}:length`) * 0.08),
    height: profile.height * (0.96 + hashUnit(`${signature}:height`) * 0.08),
    depth: profile.depth,
    head: profile.head,
    winkEvery: 4.2 + hashUnit(`${signature}:wink-speed`) * 3.8,
    winkOffset: hashUnit(`${signature}:wink-offset`) * 7,
  }), [profile, signature]);
  const colorPalette = encodedColorPalette ?? creatureColorPalette(signature);
  const baseColor = colorPalette.body;
  const headColor = colorPalette.head;
  const bellyColor = colorPalette.belly;
  const finColor = colorPalette.fin;
  const markingColor = colorPalette.marking;
  const colorSignature = encodedColorPalette
    ? Object.values(encodedColorPalette).join(":")
    : signature;
  const finVariation = hashUnit(`${colorSignature}:fin-palette`) - 0.5;
  const finPalette = {
    tail: shiftedFinColor(finColor, bellyColor, 0.08, finVariation * 0.08, 0.04, 0.03),
    dorsal: shiftedFinColor(finColor, markingColor, 0.12, 0.035 + finVariation * 0.12, 0.08, 0.04),
    pectoral: shiftedFinColor(finColor, bellyColor, 0.24, -0.055 + finVariation * 0.1, 0.1, 0.055),
    pelvic: shiftedFinColor(finColor, markingColor, 0.2, 0.085 + finVariation * 0.12, 0.12, 0.025),
    rays: shiftedFinColor(markingColor, bellyColor, 0.24, finVariation * 0.06, 0.04, 0.08),
  };
  const caudalStyle = caudalTailShapes[
    Math.min(caudalTailShapes.length - 1, Math.floor(hashUnit(`${signature}:caudal-fin`) * caudalTailShapes.length))
  ];
  const dorsalStyle = dorsalFinStyles[
    Math.min(dorsalFinStyles.length - 1, Math.floor(hashUnit(`${signature}:dorsal-fin`) * dorsalFinStyles.length))
  ];
  const pectoralStyle = pectoralFinStyleFor(signature);
  const pelvicStyle = pelvicFinStyles[
    Math.min(pelvicFinStyles.length - 1, Math.floor(hashUnit(`${signature}:pelvic-fin`) * pelvicFinStyles.length))
  ];

  useFrame(({ clock }) => {
    if (!animated || !groupRef.current) return;
    const elapsed = clock.elapsedTime;
    const swim = elapsed * 3.3 + hashUnit(signature) * Math.PI * 2;
    groupRef.current.position.y = Math.sin(elapsed * 1.15 + hashUnit(signature) * 5) * 0.045;
    groupRef.current.rotation.z = Math.sin(elapsed * 1.1 + proportions.winkOffset) * 0.025;
    if (tailRef.current) tailRef.current.rotation.z = Math.sin(swim) * 0.16;
    if (dorsalRef.current) dorsalRef.current.rotation.z = Math.sin(swim * 0.48) * 0.025;
    if (finRef.current) {
      finRef.current.rotation.x = Math.sin(swim * 0.74) * 0.11;
      finRef.current.rotation.z = Math.sin(swim * 0.74) * 0.055;
    }
    if (pelvicRef.current) {
      pelvicRef.current.rotation.x = Math.sin(swim * 0.64 + 1.8) * 0.075;
      pelvicRef.current.rotation.z = Math.sin(swim * 0.64 + 1.8) * 0.035;
    }

    const winkTime = elapsed + proportions.winkOffset;
    const winkProgress = (winkTime % proportions.winkEvery) / 0.18;
    eyeRefs.current.forEach((eye) => {
      if (!eye) return;
      const closure = winkProgress < 1 ? Math.sin(winkProgress * Math.PI) : 0;
      eye.scale.y = Math.max(0.08, 1 - closure * 0.92);
    });
    pupilRefs.current.forEach((pupil, index) => {
      if (!pupil) return;
      pupil.position.x = 0.025 + Math.sin(elapsed * 0.67 + index * 0.35 + proportions.winkOffset) * 0.028;
      pupil.position.y = Math.cos(elapsed * 0.49 + index * 0.28 + proportions.winkOffset) * 0.022;
    });
  });

  const headX = proportions.length * 0.62;
  const tailX = -proportions.length * 1.02;

  return (
    <group ref={groupRef} scale={scale}>
      <BodyProportions>
        <mesh scale={[proportions.length, proportions.height, proportions.depth]}>
          <sphereGeometry args={[0.86, 20, 14]} />
          <PatternedToonMaterial color={baseColor} />
        </mesh>
      </BodyProportions>
      <mesh position={[headX, 0.02, 0.02]} scale={[proportions.head, proportions.height * 0.9, proportions.depth * 0.96]}>
        <sphereGeometry args={[0.7, 20, 14]} />
        <PatternedToonMaterial color={headColor} repeat={[2, 1]} />
      </mesh>
      <BodyProportions>
      {[1, -1].map((side) => (
        <mesh
          key={`belly-${side}`}
          position={[-0.12, -0.08, side * proportions.depth * 0.72]}
          scale={[proportions.length * 0.72, proportions.height * 0.62, 0.12]}
        >
          <sphereGeometry args={[0.76, 20, 14]} />
          <SoftMaterial color={bellyColor} opacity={0.42} />
        </mesh>
      ))}
      </BodyProportions>

      <BodyAttachment anchor={[-proportions.length * 0.86, 0, 0]}>
      <mesh position={[tailX + 0.22, 0, 0]} scale={[0.54, 0.2, proportions.depth * 0.78]}>
        <sphereGeometry args={[0.44, 18, 14]} />
        <PatternedToonMaterial color={baseColor} repeat={[2, 1]} />
      </mesh>

      <group ref={tailRef} position={[tailX, 0, 0]} scale={[1.12, 1.14, 1]}>
        {[1, -1].map((side) => (
          <mesh key={`tail-surface-${side}`} position={[0, 0, side * 0.006]}>
            <shapeGeometry args={[caudalStyle, 18]} />
            <SoftMaterial color={finPalette.tail} opacity={0.92} />
          </mesh>
        ))}
      </group>
      </BodyAttachment>

      <BodyAttachment anchor={[dorsalStyle.x, proportions.height * 0.78, 0]}>
      <group
        ref={dorsalRef}
        position={[dorsalStyle.x, proportions.height * 0.78, 0]}
        scale={[dorsalStyle.width * 1.14, proportions.height * dorsalStyle.height * 1.14, 1]}
      >
        <DorsalFin style={dorsalStyle} color={finPalette.dorsal} rayColor={finPalette.rays} />
      </group>
      </BodyAttachment>
      <BodyAttachment anchor={[-proportions.length * 0.18, -proportions.height * 0.62, 0]}>
      <group
        ref={pelvicRef}
        position={[-proportions.length * 0.18, -proportions.height * 0.62, 0]}
      >
        {[1, -1].map((side) => (
          <BodyAttachment key={side} anchor={[0, 0, side * proportions.depth * 0.66]}>
          <group
            position={[0, 0, side * (proportions.depth * 0.66 + 0.015)]}
            scale={[pelvicStyle.width * 1.24, proportions.height * pelvicStyle.height * 1.18, 1]}
          >
            <PectoralFin
              style={pelvicStyle}
              color={finPalette.pelvic}
              rayColor={finPalette.rays}
              side={side}
            />
          </group>
          </BodyAttachment>
        ))}
      </group>
      </BodyAttachment>

      <BodyAttachment anchor={[proportions.length * 0.24, -proportions.height * 0.08, 0]}>
      <group
        ref={finRef}
        position={[proportions.length * 0.24, -proportions.height * 0.08, 0]}
      >
        {[1, -1].map((side) => (
          <BodyAttachment key={side} anchor={[0, 0, side * proportions.depth * 0.9]}>
          <group
            position={[0, 0, side * (proportions.depth * 0.9 + 0.018)]}
            scale={[pectoralStyle.width * 1.2, proportions.height * pectoralStyle.height * 1.16, 1]}
          >
            <PectoralFin
              style={pectoralStyle}
              color={finPalette.pectoral}
              rayColor={finPalette.rays}
              side={side}
            />
          </group>
          </BodyAttachment>
        ))}
      </group>
      </BodyAttachment>

      {[1, -1].map((side, index) => (
        <group
          ref={(node) => { eyeRefs.current[index] = node; }}
          key={side}
          position={[headX + proportions.head * 0.24, proportions.height * 0.28, side * proportions.depth * 0.7]}
          rotation={[0, side > 0 ? 0 : Math.PI, 0]}
        >
          <mesh>
            <sphereGeometry args={[0.14, 18, 14]} />
            <meshToonMaterial color="#F3F0E8" />
          </mesh>
          <mesh ref={(node) => { pupilRefs.current[index] = node; }} position={[0.025, 0, 0.1]}>
            <sphereGeometry args={[0.062, 14, 14]} />
            <meshBasicMaterial color="#07080A" />
          </mesh>
        </group>
      ))}

      {[1, -1].map((side) => (
        <mesh
          key={`mouth-${side}`}
          position={[
            headX + proportions.head * 0.64,
            -proportions.height * 0.1,
            // On the head's skin where the snout narrows, rather than out at the body's full depth.
            0.02 + side * proportions.depth * 0.96 * 0.7 * Math.sqrt(Math.max(0, 1 - (0.64 / 0.7) ** 2 - ((proportions.height * 0.1 + 0.02) / (proportions.height * 0.9 * 0.7)) ** 2)),
          ]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[1, 1, 0.12]}
        >
          <capsuleGeometry args={[0.025, 0.15, 4, 8]} />
          <meshBasicMaterial color="#171218" />
        </mesh>
      ))}

      <TraitMarks
        pieces={pieces}
        baseSeed={baseSeed}
        form="fish"
        highlightedPart={highlightedPart}
        layout={{
          x: proportions.length * 0.7,
          y: proportions.height * 0.86,
          cx: 0,
          cy: 0,
          z: proportions.depth * 0.86,
          scale: 0.72,
          mouth: { y: -proportions.height * 0.1 },
        }}
      />
    </group>
  );
}
