export type CreatureColorPalette = {
  body: string;
  head: string;
  belly: string;
  fin: string;
  marking: string;
};

const paletteKeys = ["body", "head", "belly", "fin", "marking"] as const;
const hexColor = /^#[0-9a-f]{6}$/i;

export function isCreatureColorPalette(value: unknown): value is CreatureColorPalette {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return paletteKeys.every(
    (key) => typeof candidate[key] === "string" && hexColor.test(candidate[key]),
  );
}

/** Every palette a creature can be drawn in; the palettes page shows them side by side. */
export const marinePalettes: readonly CreatureColorPalette[] = [
  { body: "#34789a", head: "#285a7a", belly: "#c8d9d3", fin: "#d5b43d", marking: "#183b55" },
  { body: "#d56d32", head: "#ad4d28", belly: "#f0dfbf", fin: "#d88a38", marking: "#44322c" },
  { body: "#527e87", head: "#365f69", belly: "#d8ded3", fin: "#718879", marking: "#203e49" },
  { body: "#d8b64b", head: "#bd8732", belly: "#eee1b9", fin: "#ddc65e", marking: "#443c2e" },
  { body: "#3d9184", head: "#2c7378", belly: "#c7d9c9", fin: "#5da89a", marking: "#28565b" },
  { body: "#9f8865", head: "#766650", belly: "#dfd2af", fin: "#a27c45", marking: "#4d4639" },
  { body: "#625b91", head: "#414978", belly: "#e5dca9", fin: "#d3a943", marking: "#30354f" },
  { body: "#a65e40", head: "#7d4635", belly: "#e6d3b8", fin: "#bd815c", marking: "#4b312b" },
  { body: "#c4473d", head: "#963232", belly: "#f0d8c6", fin: "#e0a04c", marking: "#4a2427" },
];

function hashUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function creatureColorPalette(seed: string) {
  const index = Math.min(
    marinePalettes.length - 1,
    Math.floor(hashUnit(`${seed}:marine-palette`) * marinePalettes.length),
  );
  return marinePalettes[index];
}
