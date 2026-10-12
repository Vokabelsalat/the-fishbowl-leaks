"use client";

import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import { CollectiveCreatureField, type CreatureArrival } from "@/components/collective/CollectiveCreatureField";
import { AbstractCreatureModel } from "@/components/visualization/AbstractCreatureCanvas";
import { NetworkGlyph } from "@/components/visualization/NetworkGlyph";
import { RenderStats, type RenderStatsReport } from "@/components/development/RenderStats";
import { collectiveCapacity, visualizationDesign } from "@/config/visualization";
import { compartmentBounds, compartmentLabels } from "@/lib/collective/tankCompartments";
import type { ExhibitionContribution } from "@/types/contribution";

function seededUnit(seed: number) {
  const value = Math.sin(seed * 999.13) * 43758.5453;
  return value - Math.floor(value);
}

/** Each creature's home compartment while the walls still hold, as its centre from -1 (left) to 1 (right). */
function compartmentCenter(contribution: ExhibitionContribution) {
  const [left, right] = compartmentBounds(Math.abs(contribution.id) % compartmentLabels.length, 1);
  return (left + right) / 2;
}

/** How strongly creatures keep to their compartments: fully while the walls hold, not at all once they are mostly gone. */
function containmentFor(breakdown: number) {
  return Math.max(0, 1 - breakdown * 1.35);
}

function FloatingAbstractCreature({ contribution, progress, breakdown }: { contribution: ExhibitionContribution; progress: number; breakdown: number }) {
  const ref = useRef<THREE.Group>(null);
  const placement = useMemo(() => ({
    x: -6.5 + seededUnit(contribution.id * 3) * 13,
    y: -3.15 + seededUnit(contribution.id * 5) * 6.25,
    z: -1 + seededUnit(contribution.id * 7) * 2,
    scale: 0.31 + seededUnit(contribution.id * 11) * 0.22,
    speed: 0.16 + seededUnit(contribution.id * 13) * 0.2,
    phase: seededUnit(contribution.id * 17) * Math.PI * 2,
  }), [contribution.id]);
  const homeX = compartmentCenter(contribution) * 5.8;
  const containment = containmentFor(breakdown);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = clock.elapsedTime * placement.speed + placement.phase;
    ref.current.position.x = placement.x * (1 - containment) + homeX * containment + Math.sin(time * 0.72) * (0.24 + progress * 0.3);
    ref.current.position.y = placement.y * (1 - containment) + Math.cos(time) * (0.18 + progress * 0.25);
    ref.current.rotation.z = Math.sin(time * 0.58) * 0.11;
  });

  return (
    <group ref={ref} position={[placement.x, placement.y, placement.z]}>
      <AbstractCreatureModel pieces={contribution.parts} scale={placement.scale} />
    </group>
  );
}

function CollectiveAbstractField({
  contributions,
  progress,
  breakdown,
  onRenderStats,
}: {
  contributions: ExhibitionContribution[];
  progress: number;
  breakdown: number;
  onRenderStats?: (report: RenderStatsReport) => void;
}) {
  return (
    <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 82, near: 0.1, far: 30 }} dpr={[1, 1.35]} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}>
      {onRenderStats && <RenderStats onReport={onRenderStats} />}
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 5, 8]} intensity={2.4} color="#FFF4DF" />
      <pointLight position={[-5, 1, 5]} intensity={2.2} color="#58D6FF" />
      <pointLight position={[5, -2, 5]} intensity={1.8} color="#FF7557" />
      {contributions.slice(-collectiveCapacity).map((contribution) => (
        <FloatingAbstractCreature key={contribution.id} contribution={contribution} progress={progress} breakdown={breakdown} />
      ))}
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}

function CollectiveNetworkField({ contributions, breakdown }: { contributions: ExhibitionContribution[]; breakdown: number }) {
  const containment = containmentFor(breakdown);
  return (
    <div className="relative size-full">
      {contributions.slice(-collectiveCapacity).map((contribution) => {
        const size = 110 + seededUnit(contribution.id * 7) * 150;
        const openLeft = 7 + seededUnit(contribution.id * 3) * 86;
        const openTop = 12 + seededUnit(contribution.id * 5) * 76;
        const containedLeft = 50 + compartmentCenter(contribution) * 43;
        const style = {
          left: `${openLeft * (1 - containment) + containedLeft * containment}%`,
          top: `${openTop * (1 - containment) + 50 * containment}%`,
          width: `${size}px`,
          height: `${size}px`,
          "--float-delay": `${seededUnit(contribution.id * 11) * -18}s`,
          "--float-duration": `${17 + seededUnit(contribution.id * 13) * 14}s`,
        } as CSSProperties;
        return (
          <div
            key={contribution.id}
            className="collective-fragment absolute -translate-x-1/2 -translate-y-1/2 opacity-55"
            style={style}
            aria-hidden="true"
          >
            <NetworkGlyph contribution={contribution} />
          </div>
        );
      })}
    </div>
  );
}

function VisualizationField({
  contributions,
  progress = 1,
  breakdown = 1,
  arrival,
  onSelectContribution,
  onRenderStats,
  mergeStaticMeshes = false,
  batchMeshes = false,
  reduceGeometryDetail = false,
  meshQuality = 1,
  orbitRequest,
}: {
  contributions: ExhibitionContribution[];
  progress?: number;
  /** How far the tank's compartment walls have broken down, from 0 (sealed) to 1 (gone). */
  breakdown?: number;
  arrival?: CreatureArrival | null;
  /** Each change circles the view once around the 3D aquarium. */
  orbitRequest?: number;
  onSelectContribution?: (contribution: ExhibitionContribution) => void;
  /** Merges each creature's still parts into a few meshes in the 3D aquarium. */
  mergeStaticMeshes?: boolean;
  /** Draws the merged meshes of all creatures in the 3D aquarium together, in a few batched draws. */
  batchMeshes?: boolean;
  /** Builds rounded shapes in the 3D aquarium with only as many segments as their size needs. */
  reduceGeometryDetail?: boolean;
  meshQuality?: number;
  /** When set, the 3D aquarium reports its frame rate and mesh counts twice a second. */
  onRenderStats?: (report: RenderStatsReport) => void;
}) {
  if (visualizationDesign === "constellation") {
    return <CollectiveNetworkField contributions={contributions} breakdown={breakdown} />;
  }
  if (visualizationDesign === "creature") {
    return <CollectiveAbstractField contributions={contributions} progress={progress} breakdown={breakdown} onRenderStats={onRenderStats} />;
  }
  return (
    <CollectiveCreatureField
      contributions={contributions}
      progress={progress}
      breakdown={breakdown}
      arrival={arrival}
      onSelectContribution={onSelectContribution}
      onRenderStats={onRenderStats}
      mergeStaticMeshes={mergeStaticMeshes}
      batchMeshes={batchMeshes}
      reduceGeometryDetail={reduceGeometryDetail}
      meshQuality={meshQuality}
      orbitRequest={orbitRequest}
    />
  );
}

// The wall re-renders for its clock, heatmap and recent stories; the aquarium only needs to when its own props change.
export const CollectiveVisualizationField = memo(VisualizationField);
