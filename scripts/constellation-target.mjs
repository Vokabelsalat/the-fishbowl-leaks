// Draws one constellation target, white or on the poster's dark background. The painter
// scales with the canvas, so the compiled MindAR image, the A4 test sheet and
// the large print files all show exactly the same picture at different sizes.
import {
  constellationParticleCount,
  frameConstellation,
  initialOrientation,
  paintConstellation,
  prepareConstellation,
} from "../src/components/particles/constellationPainter.ts";
import { createArtifactFormationPositions } from "../src/components/particles/particleGeometry.ts";
import { constellationOrientations } from "../src/data/constellationOrientations.ts";
import { darkTargetBackground } from "../src/data/artifacts.ts";

/** Width to height of every target. */
export const TARGET_ASPECT = 3 / 4;

export function targetFileName({ artifact, surface }, extension) {
  return `${artifact.exhibitionId}-${artifact.id}-${surface === "dark" ? "black" : "white"}.${extension}`;
}

/** Paints a target ({ artifact, surface } from `targetImages`) into the rectangle at (x, y) of the given size. */
export function drawConstellationTarget(context, { artifact, surface }, width, height, x = 0, y = 0) {
  const dark = surface === "dark";
  const constellation = prepareConstellation(
    createArtifactFormationPositions(artifact, constellationParticleCount),
    dark ? artifact.color : artifact.alternativeColor,
    surface,
  );
  // Turned as saved in the constellation gallery (/particles).
  const orientation = constellationOrientations[artifact.id] ?? initialOrientation;
  context.save();
  context.translate(x, y);
  context.fillStyle = dark ? darkTargetBackground : "#FFFFFF";
  context.fillRect(0, 0, width, height);
  paintConstellation(
    context,
    width,
    height,
    constellation,
    orientation,
    frameConstellation(constellation, orientation),
  );
  context.restore();
}
