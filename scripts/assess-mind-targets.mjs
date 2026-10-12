// Estimates how reliably MindAR detects each compiled target, using MindAR's
// own crop detector and matcher on synthetic camera frames. Every frame shows
// one printed -white target on a textured wall under a random viewing angle,
// distance, lighting, ink contrast, blur and sensor noise. Like the browser
// controller, the detector cycles through its nine crop positions and the
// first target index whose matcher finds a homography wins.
//
// The "hard" preset dims the light, washes out the ink, adds motion blur and
// steeper angles. A negative control renders prints of random dot patterns
// that are not in the bundle; any match there is a false positive.
//
//   node scripts/assess-mind-targets.mjs [typical|hard] [framesPerTarget=12] [width=640] [height=480]
import { readFileSync } from "node:fs";
import { decode } from "@msgpack/msgpack";
import * as tf from "@tensorflow/tfjs";
import { createCanvas } from "canvas";
import "mind-ar/src/image-target/detector/kernels/cpu/index.js";
import { CropDetector } from "mind-ar/src/image-target/detector/crop-detector.js";
import { Matcher } from "mind-ar/src/image-target/matching/matcher.js";
import { targetImages } from "../src/data/artifacts.ts";
import { TARGET_ASPECT, drawConstellationTarget } from "./constellation-target.mjs";

const preset = process.argv[2] ?? "typical";
const framesPerTarget = Number(process.argv[3] ?? 12);
const frameWidth = Number(process.argv[4] ?? 640);
const frameHeight = Number(process.argv[5] ?? 480);
const conditions = {
  typical: {
    size: { near: [0.85, 1.1], mid: [0.55, 0.8], far: [0.35, 0.5] },
    yaw: 0.6, pitch: 0.45, paper: [150, 235], ink: [25, 70], blur: [0.4, 1.6], noise: [2, 6],
  },
  hard: {
    size: { near: [0.8, 1.2], mid: [0.45, 0.65], far: [0.24, 0.34] },
    yaw: 0.9, pitch: 0.6, paper: [105, 170], ink: [50, 85], blur: [1.2, 2.6], noise: [5, 9],
  },
}[preset];
if (!conditions) throw new Error(`Unknown preset ${preset}; use typical or hard.`);
const CROP_POSITIONS = 9;

await tf.setBackend("cpu");

let seed = 20261006;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const between = (min, max) => min + random() * (max - min);

const bundle = decode(readFileSync(process.env.MIND_FILE ?? "public/targets/exhibition.mind"));
const matchingDataList = bundle.dataList.map(({ matchingData }) => matchingData);

// The print as the camera sees it: rendered large, like the print files,
// instead of the small images the bundle is compiled from.
function printedTarget(target) {
  const width = 1200;
  const height = Math.round(width / TARGET_ASPECT);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  drawConstellationTarget(context, target, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const data = new Float32Array(width * height);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (pixels[index * 4] + pixels[index * 4 + 1] + pixels[index * 4 + 2]) / 3;
  }
  return { data, width, height };
}

// Homography taking the four unit-square corners to the given quad.
function squareToQuad([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / det;
  const h = (dx1 * sy - sx * dy1) / det;
  return [
    x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
    y1 - y0 + g * y1, y3 - y0 + h * y3, y0,
    g, h, 1,
  ];
}

function invert3([a, b, c, d, e, f, g, h, i]) {
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

function blur(data, width, height, sigma) {
  if (sigma < 0.3) return data;
  const radius = Math.ceil(sigma * 2.5);
  const kernel = Array.from({ length: radius * 2 + 1 }, (_, index) =>
    Math.exp(-((index - radius) ** 2) / (2 * sigma * sigma)),
  );
  const total = kernel.reduce((sum, value) => sum + value, 0);
  const pass = (source, horizontal) => {
    const target = new Float32Array(source.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const sampleX = horizontal ? Math.min(width - 1, Math.max(0, x + k)) : x;
          const sampleY = horizontal ? y : Math.min(height - 1, Math.max(0, y + k));
          sum += source[sampleY * width + sampleX] * kernel[k + radius];
        }
        target[y * width + x] = sum / total;
      }
    }
    return target;
  };
  return pass(pass(data, true), false);
}

// One camera frame of a print on a wall. Returns the grayscale frame.
function renderFrame(target, distance) {
  const minSide = Math.min(frameWidth, frameHeight);
  // Printed width of the image on screen, as a share of the shorter side.
  const size = minSide * between(...conditions.size[distance]);
  const aspect = target.height / target.width;
  const centerX = frameWidth / 2 + between(-0.12, 0.12) * minSide;
  const centerY = frameHeight / 2 + between(-0.12, 0.12) * minSide;
  const roll = between(-0.3, 0.3);
  const yaw = between(-conditions.yaw, conditions.yaw);
  const pitch = between(-conditions.pitch, conditions.pitch);
  const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => {
    let x = u * size;
    let y = v * size * aspect;
    let z = 0;
    [x, z] = [x * Math.cos(yaw), x * Math.sin(yaw)];
    [y, z] = [y * Math.cos(pitch) - z * Math.sin(pitch), y * Math.sin(pitch) + z * Math.cos(pitch)];
    [x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)];
    const perspective = 1.6 * minSide / (1.6 * minSide + z);
    return [centerX + x * perspective, centerY + y * perspective];
  });
  const toImage = invert3(squareToQuad(corners));

  // Paper white and ink black as the camera sees them under exhibition light.
  const paper = between(...conditions.paper);
  const ink = between(...conditions.ink);
  const wallBase = between(60, 140);
  const gradient = between(-0.25, 0.25);
  const frame = new Float32Array(frameWidth * frameHeight);
  const margin = 0.06;

  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const light = 1 + gradient * ((x / frameWidth) - 0.5);
      const w = toImage[6] * x + toImage[7] * y + toImage[8];
      const u = (toImage[0] * x + toImage[1] * y + toImage[2]) / w;
      const v = (toImage[3] * x + toImage[4] * y + toImage[5]) / w;
      let value;
      if (u >= -margin && u <= 1 + margin && v >= -margin && v <= 1 + margin) {
        let source = 255;
        if (u >= 0 && u < 1 && v >= 0 && v < 1) {
          const sx = u * (target.width - 1);
          const sy = v * (target.height - 1);
          const x0 = Math.floor(sx);
          const y0 = Math.floor(sy);
          const fx = sx - x0;
          const fy = sy - y0;
          const at = (px, py) => target.data[Math.min(target.height - 1, py) * target.width + Math.min(target.width - 1, px)];
          source =
            at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) +
            at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
        }
        value = ink + (source / 255) * (paper - ink);
      } else {
        value = wallBase + 18 * Math.sin(x * 0.045 + y * 0.013) * Math.cos(y * 0.031);
      }
      frame[y * frameWidth + x] = value * light;
    }
  }

  const blurred = blur(frame, frameWidth, frameHeight, between(...conditions.blur));
  const noise = between(...conditions.noise);
  for (let index = 0; index < blurred.length; index += 1) {
    const gaussian = (random() + random() + random() - 1.5) * 2;
    blurred[index] = Math.min(255, Math.max(0, Math.round(blurred[index] + gaussian * noise)));
  }
  return blurred;
}

function detect(frame) {
  const detector = new CropDetector(frameWidth, frameHeight);
  const matcher = new Matcher(frameWidth, frameHeight);
  const input = tf.tensor(frame, [frameHeight, frameWidth], "float32");
  const results = [];
  for (let attempt = 0; attempt < CROP_POSITIONS; attempt += 1) {
    const { featurePoints } = detector.detectMoving(input);
    let matched = { targetIndex: -1, inliers: 0, features: featurePoints.length };
    for (let targetIndex = 0; targetIndex < matchingDataList.length; targetIndex += 1) {
      const { keyframeIndex, screenCoords } = matcher.matchDetection(matchingDataList[targetIndex], featurePoints);
      if (keyframeIndex !== -1) {
        matched = { targetIndex, inliers: screenCoords.length, features: featurePoints.length };
        break;
      }
    }
    results.push(matched);
  }
  input.dispose();
  return results;
}

const distances = ["near", "mid", "far"];
const rows = [];
for (const targetImage of targetImages) {
  const { artifact, surface, anchorIndex } = targetImage;
  const target = printedTarget(targetImage);
  const stats = { correct: 0, wrong: 0, missed: 0, inliers: [], cropHits: 0, crops: 0, features: [], confusedWith: new Map() };
  const byDistance = Object.fromEntries(distances.map((distance) => [distance, { correct: 0, total: 0 }]));

  for (let frameIndex = 0; frameIndex < framesPerTarget; frameIndex += 1) {
    const distance = distances[frameIndex % distances.length];
    const crops = detect(renderFrame(target, distance));
    // The browser tries one crop per video frame; the first match ends detection.
    const first = crops.find(({ targetIndex }) => targetIndex !== -1);
    byDistance[distance].total += 1;
    stats.crops += crops.length;
    stats.cropHits += crops.filter(({ targetIndex }) => targetIndex === anchorIndex).length;
    crops.forEach(({ features }) => stats.features.push(features));
    if (!first) {
      stats.missed += 1;
    } else if (first.targetIndex === anchorIndex) {
      stats.correct += 1;
      byDistance[distance].correct += 1;
      stats.inliers.push(first.inliers);
    } else {
      stats.wrong += 1;
      stats.confusedWith.set(first.targetIndex, (stats.confusedWith.get(first.targetIndex) ?? 0) + 1);
    }
  }

  const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
  const keyframes = matchingDataList[anchorIndex];
  const row = {
    index: anchorIndex,
    title: surface === "dark" ? `${artifact.title} on dark` : artifact.title,
    detected: stats.correct / framesPerTarget,
    wrong: stats.wrong,
    missed: stats.missed,
    cropRate: stats.cropHits / stats.crops,
    inliers: average(stats.inliers),
    features: average(stats.features),
    keypoints: keyframes[0].maximaPoints.length + keyframes[0].minimaPoints.length,
    byDistance: distances.map((distance) => `${byDistance[distance].correct}/${byDistance[distance].total}`).join(" "),
    confusedWith: [...stats.confusedWith].map(([index, count]) => `${index}×${count}`).join(" "),
  };
  rows.push(row);
  console.log(
    `${String(row.index).padStart(2)} ${row.title.slice(0, 30).padEnd(30)} detected ${(row.detected * 100).toFixed(0).padStart(3)}%` +
      `  near/mid/far ${row.byDistance}  crop hit ${(row.cropRate * 100).toFixed(0).padStart(3)}%` +
      `  inliers ${row.inliers.toFixed(1).padStart(5)}  frame features ${row.features.toFixed(0).padStart(3)}` +
      `  target keypoints ${String(row.keypoints).padStart(3)}` +
      (row.wrong ? `  WRONG ${row.wrong} (→ ${row.confusedWith})` : ""),
  );
}

// Negative control: prints of random soft dots, like a constellation that is
// not in the bundle. None of these frames may match a target.
function randomDotTarget() {
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, width, height);
  for (let index = 0; index < 1500; index += 1) {
    const x = width / 2 + (random() + random() - 1) * width * 0.45;
    const y = height / 2 + (random() + random() - 1) * height * 0.45;
    const radius = 4 * (0.55 + 1.7 * random() ** 3);
    context.fillStyle = `rgba(60, 60, 90, ${between(0.3, 0.8)})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  const pixels = context.getImageData(0, 0, width, height).data;
  const data = new Float32Array(width * height);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (pixels[index * 4] + pixels[index * 4 + 1] + pixels[index * 4 + 2]) / 3;
  }
  return { data, width, height };
}

let falsePositives = 0;
const negativeFrames = Math.max(6, framesPerTarget);
for (let frameIndex = 0; frameIndex < negativeFrames; frameIndex += 1) {
  const crops = detect(renderFrame(randomDotTarget(), distances[frameIndex % distances.length]));
  const first = crops.find(({ targetIndex }) => targetIndex !== -1);
  if (first) {
    falsePositives += 1;
    console.log(`FALSE POSITIVE: unrelated print matched target ${first.targetIndex} with ${first.inliers} inliers`);
  }
}

const overall = rows.reduce((sum, row) => sum + row.detected, 0) / rows.length;
const wrong = rows.reduce((sum, row) => sum + row.wrong, 0);
console.log(`\n${preset}: overall detection ${(overall * 100).toFixed(1)}%, wrong-target detections ${wrong}, false positives ${falsePositives}/${negativeFrames}, frames per target ${framesPerTarget}, frame ${frameWidth}×${frameHeight}`);
