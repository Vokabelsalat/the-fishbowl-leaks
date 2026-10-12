"use client";

import { useEffect, useRef } from "react";
import {
  constellationParticleCount,
  frameConstellation,
  initialOrientation,
  paintConstellation,
  prepareConstellation,
  type ConstellationSurface,
} from "@/components/particles/constellationPainter";
import { createArtifactFormationPositions } from "@/components/particles/particleGeometry";
import { darkTargetBackground } from "@/data/artifacts";
import { constellationOrientations } from "@/data/constellationOrientations";
import type { ExhibitionArtifact } from "@/types/exhibition";

/** Pixel size of the painted target; enough for a sharp print a few centimetres wide. */
const paintWidth = 1200;
const paintHeight = 1600;

/** An artifact's target, white or on the poster's dark background, painted exactly like the printed and compiled ones. */
export function ConstellationTargetImage({ artifact, surface = "light", className }: { artifact: ExhibitionArtifact; surface?: ConstellationSurface; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const constellation = prepareConstellation(
      createArtifactFormationPositions(artifact, constellationParticleCount),
      surface === "dark" ? artifact.color : artifact.alternativeColor,
      surface,
    );
    const orientation = constellationOrientations[artifact.id] ?? initialOrientation;
    context.fillStyle = surface === "dark" ? darkTargetBackground : "#FFFFFF";
    context.fillRect(0, 0, paintWidth, paintHeight);
    paintConstellation(context, paintWidth, paintHeight, constellation, orientation, frameConstellation(constellation, orientation));
  }, [artifact, surface]);

  return (
    <canvas
      ref={canvasRef}
      width={paintWidth}
      height={paintHeight}
      className={className}
      role="img"
      aria-label={`The constellation target of ${artifact.title}`}
    />
  );
}
