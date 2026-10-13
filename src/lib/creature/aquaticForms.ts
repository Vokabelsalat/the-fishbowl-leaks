export const aquaticForms = [
  "fish",
  "crab",
  "jellyfish",
  "octopus",
  "turtle",
  "ray",
  "starfish",
  "seahorse",
  "seal",
  "shrimp",
  "narwhal",
  "dolphin",
  "whale",
  "clam",
  "pufferfish",
] as const;

export type AquaticForm = (typeof aquaticForms)[number];

export const aquaticFormLabels: Record<AquaticForm, string> = {
  fish: "fish",
  crab: "crab",
  jellyfish: "jellyfish",
  octopus: "octopus",
  turtle: "turtle",
  ray: "ray",
  starfish: "starfish",
  seahorse: "seahorse",
  seal: "seal",
  shrimp: "shrimp",
  narwhal: "narwhal",
  dolphin: "dolphin",
  whale: "whale",
  clam: "clam",
  pufferfish: "pufferfish",
};

export function isAquaticForm(value: unknown): value is AquaticForm {
  return typeof value === "string" && aquaticForms.some((form) => form === value);
}

/**
 * Forms that belong to the open sea rather than the aquarium a day's tank starts as: they can only be
 * drawn once every wall of the tank has broken.
 */
export const openSeaForms = ["whale"] as const satisfies readonly AquaticForm[];

export function isOpenSeaForm(form: AquaticForm) {
  return openSeaForms.some((openSeaForm) => openSeaForm === form);
}

/** Draws a form for the seed; without `openSea`, from the aquarium's forms only. */
export function pickAquaticForm(seed: string, { openSea = true }: { openSea?: boolean } = {}): AquaticForm {
  const forms = openSea ? aquaticForms : aquaticForms.filter((form) => !isOpenSeaForm(form));
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return forms[(hash >>> 0) % forms.length];
}

const creatureSizeTiers = [0.72, 0.86, 1, 1.16, 1.32] as const;

export function creatureSizeScale(seed: string | number) {
  const value = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return creatureSizeTiers[(hash >>> 0) % creatureSizeTiers.length];
}

/** How fast a visitor's creature swims compared with others of its kind. */
export const creatureSpeedLevels = [
  { name: "drifting", factor: 0.4, weight: 0.24 },
  { name: "cruising", factor: 0.75, weight: 0.22 },
  { name: "steady", factor: 1.1, weight: 0.22 },
  { name: "darting", factor: 1.8, weight: 0.18 },
  { name: "sprinting", factor: 3.4, weight: 0.14 },
] as const;

function mixedUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  // A final mix keeps this independent of the size tier, which hashes the same id.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

/**
 * The speed level a creature swims at after its `change`-th change of pace (0 is where it starts),
 * plus a little jitter so creatures on the same level do not move in lockstep. The result
 * multiplies the creature's swimming speed.
 */
export function creatureSpeedFactor(seed: string | number, change = 0) {
  const level = creatureSpeedLevel(seed, change);
  return level.factor * (0.9 + mixedUnit(`${seed}:speed-jitter:${change}`) * 0.2);
}

/** Picks a weighted level; nobody starts out sprinting, sprints only come as a later change of pace. */
export function creatureSpeedLevel(seed: string | number, change = 0) {
  const levels = change === 0 ? creatureSpeedLevels.filter((level) => level.name !== "sprinting") : creatureSpeedLevels;
  const total = levels.reduce((sum, level) => sum + level.weight, 0);
  let pick = mixedUnit(`${seed}:speed-level:${change}`) * total;
  for (const level of levels) {
    pick -= level.weight;
    if (pick < 0) return level;
  }
  return levels[levels.length - 1];
}

/** Seconds a creature keeps its pace after its `change`-th change: 6 to 18, but sprints last only 2 to 4.5. */
export function creatureSpeedHoldSeconds(seed: string | number, change: number) {
  const hold = mixedUnit(`${seed}:speed-hold:${change}`);
  return creatureSpeedLevel(seed, change).name === "sprinting" ? 2 + hold * 2.5 : 6 + hold * 12;
}
