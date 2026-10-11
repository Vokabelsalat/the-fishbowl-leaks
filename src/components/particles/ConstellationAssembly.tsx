"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  constellationParticleCount,
  initialOrientation,
  prepareConstellation,
  projectConstellationPoint,
} from "@/components/particles/constellationPainter";
import { constellationOrientations } from "@/data/constellationOrientations";
import { createArtifactFormationPositions, seededRandom } from "@/components/particles/particleGeometry";
import { revealTiming } from "@/lib/animation/revealMachine";
import type { ExhibitionArtifact } from "@/types/exhibition";

/** Share of the assembling phase the flight takes; the rest is a settled hold. */
const FLIGHT_SHARE = 0.82;
const COLLAPSE_MS = 600;
/** Longest per-particle start delay, as a share of the flight. */
const MAX_DELAY = 0.38;
/**
 * Share of the printed constellation's particles that fly in, so older phones do not stutter
 * while the camera and the creature render too. The fewer particles are drawn a little larger.
 */
const PARTICLE_SHARE = 0.4;
const POINT_SIZE_BOOST = 1.2;

const vertexShader = /* glsl */ `
  attribute vec3 aEdge;
  attribute float aSeed;
  attribute float aDelay;
  attribute float aSize;

  uniform float uProgress;
  uniform float uCollapse;
  uniform float uTime;
  uniform vec2 uHalf;
  uniform vec2 uCenter;
  uniform float uScale;
  uniform float uPointSize;
  uniform float uMotion;

  varying float vAlpha;

  void main() {
    float t = clamp((uProgress - aDelay) / (1.0 - ${MAX_DELAY.toFixed(2)}), 0.0, 1.0);
    float landed = 1.0 - pow(1.0 - t, 3.0);

    vec2 target = uCenter + position.xy * uScale;
    vec2 start = aEdge.xy * uHalf * aEdge.z;
    vec2 travel = target - start;
    vec2 across = normalize(vec2(-travel.y, travel.x) + 1e-5);
    vec2 point = mix(start, target, landed);
    // Bow each path sideways so the particles swirl in instead of flying straight.
    point += across * sin(landed * 3.14159) * (aSeed - 0.5) * length(travel) * 0.35;
    point += vec2(
      sin(uTime * 1.1 + aSeed * 29.0),
      cos(uTime * 0.9 + aSeed * 17.0)
    ) * uScale * 0.012 * landed * uMotion;

    float collapse = smoothstep(0.0, 1.0, uCollapse);
    point = mix(point, uCenter, collapse * 0.9);

    vAlpha = smoothstep(0.0, 0.1, t) * (0.62 + aSeed * 0.38) * (1.0 - collapse);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 0.0, 1.0);
    gl_PointSize = uPointSize * aSize * (1.0 + (1.0 - landed) * 0.7);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uHalo;
  uniform vec3 uCore;
  varying float vAlpha;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float halo = 1.0 - smoothstep(0.32, 0.5, distanceToCenter);
    float core = 1.0 - smoothstep(0.12, 0.24, distanceToCenter);
    vec3 color = mix(uHalo, uCore, core);
    gl_FragColor = vec4(color, max(halo * 0.62, core) * vAlpha);
  }
`;

function toColor([red, green, blue]: [number, number, number]) {
  return new THREE.Color(red / 255, green / 255, blue / 255);
}

/** Evenly spread indices into the printed constellation, `share` of them in all. */
function sampledIndices(total: number, share: number) {
  const count = Math.max(1, Math.round(total * share));
  return Array.from({ length: count }, (_, index) => Math.floor((index * total) / count));
}

// An even subset of the formation positions, projected like the printed target and
// normalised so the larger projected half extent is 1. Sizes come from the full
// constellation, so each particle keeps the size it has on the print.
function targetPositions(artifact: ExhibitionArtifact) {
  const full = createArtifactFormationPositions(artifact, constellationParticleCount);
  const fullSizes = prepareConstellation(full, artifact.color, "dark").sizes;
  const indices = sampledIndices(constellationParticleCount, PARTICLE_SHARE);
  const count = indices.length;
  const formation = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  indices.forEach((source, index) => {
    formation.set(full.subarray(source * 3, source * 3 + 3), index * 3);
    sizes[index] = fullSizes[source];
  });
  const orientation = constellationOrientations[artifact.id] ?? initialOrientation;
  const projected = new Float32Array(count * 3);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let offset = 0; offset < formation.length; offset += 3) {
    const { x: rotatedX, y: rotatedY } = projectConstellationPoint(formation, offset, orientation);
    projected[offset] = rotatedX;
    projected[offset + 1] = rotatedY;
    minX = Math.min(minX, rotatedX);
    maxX = Math.max(maxX, rotatedX);
    minY = Math.min(minY, rotatedY);
    maxY = Math.max(maxY, rotatedY);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const extent = Math.max(maxX - minX, maxY - minY, 0.01) / 2;
  for (let offset = 0; offset < projected.length; offset += 3) {
    projected[offset] = (projected[offset] - centerX) / extent;
    projected[offset + 1] = (projected[offset + 1] - centerY) / extent;
  }
  return { count, sizes, projected };
}

function AssemblyPoints({
  artifact,
  collapsing,
  centerY,
  fit,
}: {
  artifact: ExhibitionArtifact;
  collapsing: boolean;
  centerY: number;
  fit: number;
}) {
  const size = useThree((state) => state.size);
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const startedAt = useRef<number | null>(null);
  const collapseStartedAt = useRef<number | null>(null);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const { geometry, material } = useMemo(() => {
    const { count, sizes, projected } = targetPositions(artifact);
    const constellation = prepareConstellation(projected, artifact.color, "dark");
    const random = seededRandom(`${artifact.id}:assembly`);
    const edges = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const delays = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      // A point on the screen rectangle, pushed a little past the edge.
      const along = random() * 2 - 1;
      const side = Math.floor(random() * 4);
      edges[index * 3] = side < 2 ? along : side === 2 ? -1 : 1;
      edges[index * 3 + 1] = side < 2 ? (side === 0 ? -1 : 1) : along;
      edges[index * 3 + 2] = 1.04 + random() * 0.2;
      seeds[index] = random();
      delays[index] = random() * MAX_DELAY;
    }

    const assembled = new THREE.BufferGeometry();
    assembled.setAttribute("position", new THREE.BufferAttribute(projected, 3));
    assembled.setAttribute("aEdge", new THREE.BufferAttribute(edges, 3));
    assembled.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    assembled.setAttribute("aDelay", new THREE.BufferAttribute(delays, 1));
    assembled.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    return {
      geometry: assembled,
      material: new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader,
        fragmentShader,
        uniforms: {
          uProgress: { value: 0 },
          uCollapse: { value: 0 },
          uTime: { value: 0 },
          uHalf: { value: new THREE.Vector2(1, 1) },
          uCenter: { value: new THREE.Vector2(0, 0) },
          uScale: { value: 1 },
          uPointSize: { value: 4 },
          uMotion: { value: reducedMotion ? 0 : 1 },
          uHalo: { value: toColor(constellation.halo) },
          uCore: { value: toColor(constellation.core) },
        },
      }),
    };
  }, [artifact, reducedMotion]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }) => {
    const shader = materialRef.current;
    if (!shader) return;
    const now = performance.now();
    startedAt.current ??= now;
    if (collapsing) collapseStartedAt.current ??= now;
    const timeScale = reducedMotion ? 0.08 : 1;
    const { uniforms } = shader;
    const scale = Math.min(size.height * fit, size.width) * 0.42;

    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uHalf.value.set(size.width / 2, size.height / 2);
    uniforms.uCenter.value.set(0, centerY * size.height);
    uniforms.uScale.value = scale;
    uniforms.uPointSize.value = scale * 0.032 * POINT_SIZE_BOOST * pixelRatio;
    uniforms.uProgress.value = Math.min(
      1,
      (now - startedAt.current) / (revealTiming.assembling * FLIGHT_SHARE * timeScale),
    );
    uniforms.uCollapse.value = collapseStartedAt.current === null
      ? 0
      : Math.min(1, (now - collapseStartedAt.current) / (COLLAPSE_MS * timeScale));
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive ref={materialRef} object={material} attach="material" />
    </points>
  );
}

/**
 * Full-screen particles that fly in from every screen edge and assemble the
 * artifact's constellation, then collapse into its centre once `collapsing`
 * turns on so the creature can take over from there.
 */
export function ConstellationAssembly({
  artifact,
  collapsing,
  centerY,
  fit,
}: {
  artifact: ExhibitionArtifact;
  collapsing: boolean;
  /** Constellation centre above the screen centre, as a share of the screen height. */
  centerY: number;
  /** Height share of the screen the constellation may fill. */
  fit: number;
}) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1, near: 0.1, far: 100 }}
        dpr={[1, 1.25]}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
      >
        <AssemblyPoints artifact={artifact} collapsing={collapsing} centerY={centerY} fit={fit} />
      </Canvas>
    </div>
  );
}
