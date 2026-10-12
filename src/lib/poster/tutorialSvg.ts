import {
  constellationParticleCount,
  frameConstellation,
  initialOrientation,
  paintConstellation,
  prepareConstellation,
  type ConstellationSurface,
} from "@/components/particles/constellationPainter";
import { createArtifactFormationPositions } from "@/components/particles/particleGeometry";
import { posterTagline, tutorialHeading, tutorialSteps } from "@/components/poster/tutorialCopy";
import { darkTargetBackground } from "@/data/artifacts";
import { constellationOrientations } from "@/data/constellationOrientations";
import type { ExhibitionArtifact } from "@/types/exhibition";

const abyss = "#031015";
const foam = "#e8f5ef";
const phosphor = "#b9ffdc";
const displayFont = "'Iowan Old Style', Baskerville, 'Times New Roman', serif";
const bodyFont = "'Avenir Next', Avenir, 'Helvetica Neue', Arial, sans-serif";
/** Typographic points in millimetres. */
const pt = 25.4 / 72;

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Paints a constellation target as SVG circles in a width × height box, with the same painter as the
 * printed targets. The dark targets' glow, added up on a canvas, becomes a screen blend, which
 * browsers and Inkscape both show.
 */
export function constellationSvg(artifact: ExhibitionArtifact, surface: ConstellationSurface, width: number, height: number) {
  const constellation = prepareConstellation(
    createArtifactFormationPositions(artifact, constellationParticleCount),
    surface === "dark" ? artifact.color : artifact.alternativeColor,
    surface,
  );
  const orientation = constellationOrientations[artifact.id] ?? initialOrientation;
  const circles: string[] = [];
  let fill = "";
  let center: [number, number, number] = [0, 0, 0];
  const recorder = {
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    set fillStyle(value: string) {
      fill = value;
    },
    get fillStyle() {
      return fill;
    },
    beginPath() {},
    arc(x: number, y: number, radius: number) {
      center = [x, y, radius];
    },
    fill() {
      const [, red, green, blue, alpha] = fill.match(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/) ?? [];
      const [x, y, radius] = center;
      circles.push(`<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${radius.toFixed(3)}" fill="rgb(${red},${green},${blue})" fill-opacity="${Number(alpha).toFixed(2)}"/>`);
    },
  };
  paintConstellation(recorder, width, height, constellation, orientation, frameConstellation(constellation, orientation));
  const blend = surface === "dark" ? ` style="mix-blend-mode:screen"` : "";
  return [
    `<rect width="${width}" height="${height}" fill="${surface === "dark" ? darkTargetBackground : "#FFFFFF"}"/>`,
    `<g style="isolation:isolate"><g${blend}>${circles.join("")}</g></g>`,
  ].join("");
}

/** Splits text into lines of at most `limit` characters, at spaces. */
function wrap(text: string, limit: number) {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= limit) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

function multilineText(lines: string[], x: number, y: number, lineHeight: number, attributes: string) {
  const spans = lines.map((line, index) => `<tspan x="${x}" ${index === 0 ? `y="${y}"` : `dy="${lineHeight}"`}>${escapeXml(line)}</tspan>`);
  return `<text ${attributes}>${spans.join("")}</text>`;
}

/**
 * The A4 tutorial sheet as an editable SVG in millimetres: the poster's rendered sea as one image,
 * and its title, the steps, the QR code and the example target as separate, named elements that a
 * vector editor can move, scale and rewrite. It follows the layout of the /poster/tutorial page.
 */
export function tutorialSheetSvg({
  posterPng,
  qrSvg,
  exampleArtifact,
}: {
  /** The bare landscape poster, without its words, as PNG bytes. */
  posterPng: Buffer;
  /** The contents of public/images/exhibition-qr.svg. */
  qrSvg: string;
  exampleArtifact: ExhibitionArtifact;
}) {
  const width = 210;
  const height = 297;
  const posterHeight = (width * 2) / 3;
  const titleSize = posterHeight * 0.074;
  const margin = 14;
  const columnGap = 10;
  const column = (width - margin * 2 - columnGap) / 2;
  const headingSize = 30 * pt;
  const headingBaseline = posterHeight + 8 + headingSize * 0.8;
  const visualTop = posterHeight + 8 + headingSize + 9;
  const visualHeight = 70;
  const stepTop = visualTop + visualHeight + 5;
  const stepSize = 11.5 * pt;
  const stepLineHeight = stepSize * 1.35;
  const numberSize = 20 * pt;
  const textIndent = numberSize * 0.5 + 3;
  // About as many characters as fit a column at the step's type size.
  const columnCharacters = Math.floor(column / (stepSize * 0.5));
  const qrSize = 61;
  const qrQuietZone = (qrSize * 4) / 33;
  const qrContent = qrSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const targetWidth = 52.5;

  const step = (index: number, x: number, top: number, characters: number) => {
    const lines = wrap(tutorialSteps[index], characters);
    const baseline = top + stepSize * 0.95;
    return [
      `<g id="step-${index + 1}">`,
      `<text x="${x}" y="${baseline + 0.4}" font-family="${displayFont}" font-size="${numberSize.toFixed(2)}" fill="${phosphor}">${index + 1}</text>`,
      multilineText(lines, x + textIndent, baseline, stepLineHeight, `font-family="${bodyFont}" font-size="${stepSize.toFixed(2)}" fill="${foam}"`),
      "</g>",
    ].join("");
  };
  const firstRowLines = Math.max(wrap(tutorialSteps[0], columnCharacters).length, wrap(tutorialSteps[1], columnCharacters).length);
  const thirdStepTop = stepTop + firstRowLines * stepLineHeight + 8;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">
  <title>The Fishbowl Leaks: tutorial sheet</title>
  <rect id="background" width="${width}" height="${height}" fill="${abyss}"/>
  <image id="poster" x="0" y="0" width="${width}" height="${posterHeight}" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/png;base64,${posterPng.toString("base64")}"/>
  <g id="poster-title" text-anchor="middle">
    <text x="${width / 2}" y="${(posterHeight - titleSize * 2.65).toFixed(2)}" font-family="${bodyFont}" font-size="${(titleSize * 0.17).toFixed(2)}" letter-spacing="0.04" fill="${foam}" fill-opacity="0.8">${escapeXml(posterTagline)}</text>
    <text x="${width / 2}" y="${(posterHeight - titleSize * 1.75).toFixed(2)}" font-family="${displayFont}" font-size="${titleSize.toFixed(2)}" letter-spacing="${(-titleSize * 0.075).toFixed(2)}" fill="${foam}">The Fishbowl</text>
    <text x="${width / 2}" y="${(posterHeight - titleSize * 0.97).toFixed(2)}" font-family="${displayFont}" font-size="${titleSize.toFixed(2)}" font-style="italic" letter-spacing="${(-titleSize * 0.075).toFixed(2)}" fill="${phosphor}">Leaks</text>
  </g>
  <text id="heading" x="${margin}" y="${headingBaseline.toFixed(2)}" font-family="${displayFont}" font-size="${headingSize.toFixed(2)}" letter-spacing="${(-headingSize * 0.04).toFixed(2)}" fill="${foam}">${escapeXml(tutorialHeading)}</text>
  <g id="qr-code" transform="translate(${(margin - qrQuietZone).toFixed(3)} ${(visualTop + visualHeight + qrQuietZone - qrSize).toFixed(3)}) scale(${(qrSize / 33).toFixed(5)})" shape-rendering="crispEdges">${qrContent}</g>
  <g id="example-target" transform="translate(${margin + column + columnGap} ${visualTop.toFixed(3)}) scale(${(targetWidth / 300).toFixed(5)})">${constellationSvg(exampleArtifact, "dark", 300, 400)}</g>
  ${step(0, margin, stepTop, columnCharacters)}
  ${step(1, margin + column + columnGap, stepTop, columnCharacters)}
  ${step(2, margin, thirdStepTop, columnCharacters * 2 + 4)}
</svg>
`;
}
