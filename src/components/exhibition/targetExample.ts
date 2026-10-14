import { tutorialExampleArtifactId } from "@/components/poster/tutorialCopy";

/**
 * An artifact's dark constellation with a transparent background, from `npm run targets:radar`,
 * so it can float over the radar or the camera without a visible box.
 */
export function radarGlowSrc(artifactId: string) {
  return `/images/radar/${artifactId}.png`;
}

/**
 * The marker shown to teach visitors what to look for: the same Fishbowl Leaks constellation as on the
 * A4 tutorial sheet. "light" is the white card beside each artwork; "glow" floats over the camera.
 */
/** `light` and `glow` share the target's 3:4 shape; the sizes are for layout, not the files' pixels. */
export const exampleTarget = {
  artifactId: tutorialExampleArtifactId,
  light: "/targets/16-fishbowl-leaks-white.png",
  glow: radarGlowSrc(tutorialExampleArtifactId),
  width: 400,
  height: 533,
} as const;

export const targetExampleCopy =
  "Beside each artwork hangs a marker: a constellation of dots like this one, each in its own shape.";
