// Renders every artifact's dark constellation target with a transparent background, for the
// title-screen radar and the camera hint, where the marker floats over other content and a dark
// box around it would show. Same painter as the compiled and printed targets, so the shapes match.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "canvas";
// Installed with Next.js, which uses it to optimise images.
import sharp from "sharp";
import { artifacts, darkTargetBackground } from "../src/data/artifacts.ts";
import { TARGET_ASPECT, drawConstellationTarget } from "./constellation-target.mjs";

/** Small on purpose: the radar shows a marker at most about 130 px wide, so this covers 2× screens. */
const WIDTH = 240;
const HEIGHT = Math.round(WIDTH / TARGET_ASPECT);

const outputDirectory = join(dirname(fileURLToPath(import.meta.url)), "../public/images/radar");
const background = darkTargetBackground.match(/\w\w/g).map((hex) => parseInt(hex, 16));

mkdirSync(outputDirectory, { recursive: true });
for (const artifact of artifacts) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const context = canvas.getContext("2d");
  drawConstellationTarget(context, { artifact, surface: "dark" }, WIDTH, HEIGHT);

  // Un-blend each pixel from the dark background: the alpha is how far it rises above the background,
  // the colour is what, at that alpha, composites back to the painted pixel.
  const image = context.getImageData(0, 0, WIDTH, HEIGHT);
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    let alpha = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const rise = Math.max(0, pixels[index + channel] - background[channel]);
      alpha = Math.max(alpha, rise / (255 - background[channel]));
    }
    for (let channel = 0; channel < 3; channel += 1) {
      const rise = Math.max(0, pixels[index + channel] - background[channel]);
      pixels[index + channel] = alpha > 0 ? Math.min(255, background[channel] + rise / alpha) : 0;
    }
    pixels[index + 3] = Math.round(alpha * 255);
  }
  context.putImageData(image, 0, 0);

  // A 64-colour palette looks the same on the radar at about a quarter of the file size.
  const file = join(outputDirectory, `${artifact.id}.png`);
  writeFileSync(file, await sharp(canvas.toBuffer("image/png")).png({ palette: true, colors: 64, compressionLevel: 9 }).toBuffer());
  console.log(`${artifact.id.padEnd(28)} ${file} (${WIDTH}×${HEIGHT})`);
}
