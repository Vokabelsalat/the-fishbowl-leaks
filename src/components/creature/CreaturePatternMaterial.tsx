"use client";

import { useContext, useMemo, type ComponentProps } from "react";
import * as THREE from "three";
import { CreatureLookContext } from "@/components/creature/CreatureLook";
import type { CreaturePattern } from "@/lib/creature/patterns";

/** Pattern tiles are square, with this many pixels on each side. */
export const patternTileSize = 128;
const tileSize = patternTileSize;

/** A small seeded random generator, so a pattern seed always draws the same marks. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws a circle and its copies across the tile edges, so it continues seamlessly in the next tile. */
function wrappedCircle(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  for (const offsetX of [-tileSize, 0, tileSize]) {
    for (const offsetY of [-tileSize, 0, tileSize]) {
      context.beginPath();
      context.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

/**
 * Draws one seamless tile of the pattern. Marks are flat and hard-edged, to suit toon shading.
 * Tiles are drawn with stripes running along +x; "around" turns them a quarter turn. `readBack`
 * keeps the canvas in main memory, so its pixels can be read without stalling the GPU.
 */
function drawPatternTile(pattern: CreaturePattern, baseColor: string, markingColor: string, readBack = false) {
  const canvas = document.createElement("canvas");
  canvas.width = tileSize;
  canvas.height = tileSize;
  const context = canvas.getContext("2d", { willReadFrequently: readBack })!;
  context.fillStyle = baseColor;
  context.fillRect(0, 0, tileSize, tileSize);
  const marking = new THREE.Color(baseColor).lerp(new THREE.Color(markingColor), pattern.contrast).getStyle();
  context.fillStyle = marking;
  context.strokeStyle = marking;
  const random = seededRandom(pattern.seed);

  if (pattern.orientation === "around") {
    context.translate(tileSize / 2, tileSize / 2);
    context.rotate(Math.PI / 2);
    context.translate(-tileSize / 2, -tileSize / 2);
  }

  switch (pattern.kind) {
    case "stripes": {
      const count = 4;
      const period = tileSize / count;
      for (let index = 0; index < count; index += 1) context.fillRect(-tileSize, index * period, tileSize * 3, period * 0.3);
      break;
    }
    case "bands": {
      const period = tileSize / 2;
      for (let index = 0; index < 2; index += 1) context.fillRect(-tileSize, index * period, tileSize * 3, period * 0.42);
      break;
    }
    case "spots": {
      for (let index = 0; index < 5; index += 1) {
        wrappedCircle(context, random() * tileSize, random() * tileSize, tileSize * (0.07 + random() * 0.07));
      }
      break;
    }
    case "speckles": {
      for (let index = 0; index < 28; index += 1) {
        wrappedCircle(context, random() * tileSize, random() * tileSize, tileSize * (0.015 + random() * 0.02));
      }
      break;
    }
    case "scales": {
      // Rows of overlapping arcs, every other row shifted by half a scale.
      const columns = 4;
      const cell = tileSize / columns;
      context.lineWidth = tileSize * 0.03;
      for (let row = 0; row <= columns; row += 1) {
        for (let column = -1; column <= columns; column += 1) {
          const x = column * cell + (row % 2 ? cell / 2 : 0);
          context.beginPath();
          context.arc(x, row * cell, cell / 2, 0, Math.PI);
          context.stroke();
        }
      }
      break;
    }
    case "net": {
      // Base-coloured cells inside a marking-coloured net; cells stay off the tile edges, so the net joins up.
      context.fillRect(0, 0, tileSize, tileSize);
      context.fillStyle = baseColor;
      const columns = 3;
      const cell = tileSize / columns;
      const gap = cell * 0.14;
      for (let row = 0; row < columns; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const inset = gap / 2 + random() * gap * 0.6;
          context.beginPath();
          context.roundRect(column * cell + inset, row * cell + inset, cell - inset * 2, cell - inset * 2, cell * 0.28);
          context.fill();
        }
      }
      break;
    }
    case "plain":
      break;
  }
  return canvas;
}

/** The pattern's marks in white on black, the same for every colouring of the pattern, ready to be read back. */
export function drawPatternMask(pattern: CreaturePattern) {
  return drawPatternTile({ ...pattern, contrast: 1 }, "#000000", "#FFFFFF", true);
}

/** What a pattern texture shows, kept on it so the tank's batched drawing can rebuild it from a shared mask. */
export type PatternTextureSource = { pattern: CreaturePattern; baseColor: string; markingColor: string };
export const patternSourceKey = "patternSource";

const tileCache = new Map<string, THREE.Texture>();
const repeatedCache = new Map<string, THREE.Texture>();

/** A shared texture for the pattern in these colours, repeated `repeat` times across a body part. */
function patternTexture(pattern: CreaturePattern, baseColor: string, markingColor: string, repeat: [number, number]) {
  const tileKey = `${pattern.kind}|${pattern.orientation}|${pattern.contrast}|${pattern.seed}|${baseColor}|${markingColor}`;
  let tile = tileCache.get(tileKey);
  if (!tile) {
    tile = new THREE.CanvasTexture(drawPatternTile(pattern, baseColor, markingColor));
    tile.colorSpace = THREE.SRGBColorSpace;
    tile.wrapS = THREE.RepeatWrapping;
    tile.wrapT = THREE.RepeatWrapping;
    tileCache.set(tileKey, tile);
  }
  const repeatedKey = `${tileKey}|${repeat.join("x")}`;
  let repeated = repeatedCache.get(repeatedKey);
  if (!repeated) {
    // Clones share the drawn image, so each repeat costs no extra texture memory.
    repeated = tile.clone();
    repeated.repeat.set(repeat[0], repeat[1]);
    repeated.userData[patternSourceKey] = { pattern, baseColor, markingColor } satisfies PatternTextureSource;
    repeated.needsUpdate = true;
    repeatedCache.set(repeatedKey, repeated);
  }
  return repeated;
}

type ToonProps = Omit<ComponentProps<"meshToonMaterial">, "color" | "map">;

/**
 * A toon material in `color`, patterned with the creature's skin pattern when it has one.
 * `repeat` is how often the pattern tile repeats across the part's texture coordinates at the
 * lowest density. Spheres and cylinders wrap their first coordinate once around and tubes their
 * second, so `wraps` keeps that count whole to avoid a seam; extruded shapes use their outline
 * coordinates and pass `wraps={false}`.
 */
export function PatternedToonMaterial({
  color,
  repeat = [3, 1.5],
  wraps = "u",
  ...material
}: ToonProps & { color: string; repeat?: [number, number]; wraps?: "u" | "v" | false }) {
  const { pattern, markingColor } = useContext(CreatureLookContext);
  const patterned = pattern && pattern.kind !== "plain" && markingColor;
  const repeatX = repeat[0] * (pattern?.density ?? 1);
  const repeatY = repeat[1] * (pattern?.density ?? 1);
  const texture = useMemo(
    () => (patterned
      ? patternTexture(pattern, color, markingColor, [
        wraps === "u" ? Math.max(1, Math.round(repeatX)) : repeatX,
        wraps === "v" ? Math.max(1, Math.round(repeatY)) : repeatY,
      ])
      : null),
    [color, markingColor, pattern, patterned, repeatX, repeatY, wraps],
  );
  // Separate keys give a fresh material when a pattern appears, so its shader includes the texture.
  if (!texture) return <meshToonMaterial key="plain" color={color} {...material} />;
  return <meshToonMaterial key="patterned" color="#FFFFFF" map={texture} {...material} />;
}
