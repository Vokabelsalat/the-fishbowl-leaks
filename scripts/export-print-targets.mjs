// Exports the white-background constellation targets for printing, drawn
// directly with the constellation painter instead of scaling up the small
// compile images:
//
// - print/<target>.pdf: one vector page per target at the given print width,
//   sharp at any size.
// - print/<target>.png: the same target as a raster image at the given dpi,
//   for print shops that ask for pixels. Skipped with --dpi=0.
// - public/targets/print-white.pdf: an A4 test sheet with all targets, six
//   per page, labelled with their MindAR target index.
//
//   node scripts/export-print-targets.mjs [--width-mm=400] [--dpi=300]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas } from "canvas";
import { targetImages } from "../src/data/artifacts.ts";
import { TARGET_ASPECT, drawConstellationTarget, targetFileName } from "./constellation-target.mjs";

const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [key, value] = argument.replace(/^--/, "").split("=");
    return [key, Number(value)];
  }),
);
const widthMm = options["width-mm"] ?? 400;
const dpi = options.dpi ?? 300;
const pointsPerMm = 72 / 25.4;
const outputDirectory = "print";

mkdirSync(outputDirectory, { recursive: true });

const pageWidth = widthMm * pointsPerMm;
const pageHeight = pageWidth / TARGET_ASPECT;
const pixelWidth = Math.round((widthMm / 25.4) * dpi);
const pixelHeight = Math.round(pixelWidth / TARGET_ASPECT);

for (const target of targetImages) {
  const pdf = createCanvas(pageWidth, pageHeight, "pdf");
  drawConstellationTarget(pdf.getContext("2d"), target, pageWidth, pageHeight);
  const pdfFile = join(outputDirectory, targetFileName(target, "pdf"));
  writeFileSync(pdfFile, pdf.toBuffer());

  let pngNote = "";
  if (dpi > 0) {
    const png = createCanvas(pixelWidth, pixelHeight);
    drawConstellationTarget(png.getContext("2d"), target, pixelWidth, pixelHeight);
    writeFileSync(join(outputDirectory, targetFileName(target, "png")), png.toBuffer("image/png"));
    pngNote = `, png ${pixelWidth}×${pixelHeight} px`;
  }
  console.log(`${pdfFile} (${widthMm} × ${Math.round(widthMm / TARGET_ASPECT)} mm${pngNote})`);
}

// A4 portrait test sheet in PDF points.
const sheetWidth = 595.28;
const sheetHeight = 841.89;
const margin = 36;
const columns = 3;
const rows = 3;
const gutter = 24;
const labelHeight = 18;
const imageWidth = (sheetWidth - margin * 2 - gutter * (columns - 1)) / columns;
const imageHeight = imageWidth / TARGET_ASPECT;
const sheet = createCanvas(sheetWidth, sheetHeight, "pdf");
const context = sheet.getContext("2d");

for (const [index, target] of targetImages.entries()) {
  const { artifact, surface, anchorIndex } = target;
  if (index > 0 && index % (columns * rows) === 0) context.addPage();
  const slot = index % (columns * rows);
  const x = margin + (slot % columns) * (imageWidth + gutter);
  const y = margin + Math.floor(slot / columns) * (imageHeight + labelHeight + gutter);
  drawConstellationTarget(context, target, imageWidth, imageHeight, x, y);
  context.strokeStyle = "#999999";
  context.lineWidth = 0.5;
  context.strokeRect(x, y, imageWidth, imageHeight);
  context.fillStyle = "#333333";
  context.font = "9px sans-serif";
  context.fillText(
    `${artifact.exhibitionId}  ${artifact.title}${surface === "dark" ? " on dark" : ""}  (target ${anchorIndex})`,
    x,
    y + imageHeight + 12,
  );
}

writeFileSync("public/targets/print-white.pdf", sheet.toBuffer());
console.log("wrote public/targets/print-white.pdf");
