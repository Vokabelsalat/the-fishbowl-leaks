/**
 * The collective tank starts out divided into five classified compartments. Each creature released
 * into the tank cracks the walls between them a little further, until, with `openSeaCreatures`
 * creatures released since the exhibition opened, every wall has burst open and they all swim
 * together in the open sea. The breakdown itself, which also unsettles the creatures' stories, keeps
 * growing until `fullBreakdownCreatures`. The tank keeps its creatures from day to day, so it stays open.
 */

/** How many visitors' creatures it takes for the breakdown to reach its top. */
export const fullBreakdownCreatures = 100;

/** How many visitors' creatures it takes for the tank to become the open sea, with every wall gone. */
export const openSeaCreatures = 75;

export type CompartmentWall = {
  /** Where the wall stands, as a share of the tank's width from the left. */
  position: number;
  /** The breakdown at which the wall starts to crack. */
  crackAt: number;
  /** The breakdown at which the wall has burst fully open. */
  openAt: number;
  /** Height of the hole's centre, as a share of the tank's height from the top. */
  hole: number;
};

export const compartmentLabels = [
  "memory shelf",
  "synthetic voice",
  "stable specimens",
  "correspondence",
  "irregular organisms",
] as const;

/** The breakdown this many creatures bring the tank to. */
const afterCreatures = (count: number) => count / fullBreakdownCreatures;

// The walls crack out of order, and every one has started to crack by 30 creatures. Each then
// opens slowly, and the last of them bursts just before the open sea at 75.
export const compartmentWalls: readonly CompartmentWall[] = [
  { position: 0.18, crackAt: afterCreatures(12), openAt: afterCreatures(55), hole: 0.34 },
  { position: 0.46, crackAt: afterCreatures(28), openAt: afterCreatures(72), hole: 0.66 },
  { position: 0.6, crackAt: afterCreatures(5), openAt: afterCreatures(45), hole: 0.43 },
  { position: 0.84, crackAt: afterCreatures(20), openAt: afterCreatures(65), hole: 0.72 },
];

/** Whether a tank with this many visitors' creatures has become the open sea, with every wall gone. */
export function isOpenSea(creatureCount: number) {
  return creatureCount >= openSeaCreatures;
}

/** How far the walls have broken down for this many creatures, from 0 (sealed) to 1 (gone). */
export function tankBreakdown(creatureCount: number) {
  return Math.min(1, Math.max(0, creatureCount / fullBreakdownCreatures));
}

/** By this many creatures the tank's green-tinted water has turned into a blue aquarium's. */
export const blueAquariumCreatures = 50;

/**
 * Where the tank's look stands for a breakdown: `blue` runs from the green-tinted aquarium (0) to
 * the blue one (1) over the first `blueAquariumCreatures`, then `sea` from the blue aquarium (0) to
 * the open sea (1) as the last walls break, by `openSeaCreatures`.
 */
export function tankLook(breakdown: number) {
  const blueAt = tankBreakdown(blueAquariumCreatures);
  const seaAt = tankBreakdown(openSeaCreatures);
  return {
    blue: Math.min(1, Math.max(0, breakdown / blueAt)),
    sea: Math.min(1, Math.max(0, (breakdown - blueAt) / (seaAt - blueAt))),
  };
}

/** How far one wall's hole has opened, from 0 (sealed) to 1 (burst). */
export function wallOpening(breakdown: number, wallIndex: number) {
  const { crackAt, openAt } = compartmentWalls[wallIndex];
  return Math.min(1, Math.max(0, (breakdown - crackAt) / (openAt - crackAt)));
}

/** Half the hole's height as a share of the tank's height; a burst wall leaves a gap of 62% of the height around its centre. */
export function holeHalfHeight(opening: number) {
  return 0.31 * opening;
}

/** The wall's x in the tank, where the tank spans -halfWidth to halfWidth. */
export function wallX(wallIndex: number, halfWidth: number) {
  return (compartmentWalls[wallIndex].position * 2 - 1) * halfWidth;
}

/** The hole's centre y in the tank, where the tank spans -halfHeight to halfHeight. */
export function holeCenterY(wallIndex: number, halfHeight: number) {
  return (1 - compartmentWalls[wallIndex].hole * 2) * halfHeight;
}

/** Which compartment (0 to 4) holds the tank position x. */
export function compartmentAt(x: number, halfWidth: number) {
  const index = compartmentWalls.findIndex((_, wallIndex) => x < wallX(wallIndex, halfWidth));
  return index === -1 ? compartmentWalls.length : index;
}

/** The left and right edge of a compartment in the tank. */
export function compartmentBounds(compartment: number, halfWidth: number): [number, number] {
  return [
    compartment === 0 ? -halfWidth : wallX(compartment - 1, halfWidth),
    compartment === compartmentWalls.length ? halfWidth : wallX(compartment, halfWidth),
  ];
}

/**
 * Whether a creature at height y can pass the wall: it has to be inside the wall's hole, with
 * `bodyReach` to spare above and below for its body.
 */
export function canPassWall(wallIndex: number, y: number, breakdown: number, halfHeight: number, bodyReach = 0) {
  const opening = wallOpening(breakdown, wallIndex);
  if (opening <= 0) return false;
  return Math.abs(y - holeCenterY(wallIndex, halfHeight)) <= holeHalfHeight(opening) * 2 * halfHeight - bodyReach;
}

/** Whether any wall between two positions still holds, so creatures on either side cannot meet. */
export function separatedByWall(firstX: number, secondX: number, breakdown: number, halfWidth: number) {
  const from = compartmentAt(Math.min(firstX, secondX), halfWidth);
  const to = compartmentAt(Math.max(firstX, secondX), halfWidth);
  for (let wallIndex = from; wallIndex < to; wallIndex += 1) {
    if (wallOpening(breakdown, wallIndex) < 0.5) return true;
  }
  return false;
}
