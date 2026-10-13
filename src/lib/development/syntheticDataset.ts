import { artifacts } from "@/data/artifacts";
import { calculateDwellTimes } from "@/lib/contributions/dwellTime";
import { aquaticForms, isOpenSeaForm, type AquaticForm } from "@/lib/creature/aquaticForms";
import { generateJourneyNarrative } from "@/lib/narrative/generateJourneyNarrative";
import { isOpenSea, tankBreakdown } from "@/lib/collective/tankCompartments";
import type { SharedCreaturePart } from "@/types/contribution";
import { creatureColorPalette, type CreatureColorPalette } from "@/lib/creature/colorPalettes";
import { creaturePattern, type CreaturePattern } from "@/lib/creature/patterns";
import { creatureProportions, type CreatureProportions } from "@/lib/creature/proportions";

export const SYNTHETIC_VISITOR_COUNT = 150;

export const SYNTHETIC_FEATURED_FORMS = [
  "seal",
  "shrimp",
  "narwhal",
  "dolphin",
  "whale",
] as const satisfies readonly AquaticForm[];

const syntheticFormRotation: AquaticForm[] = [
  ...SYNTHETIC_FEATURED_FORMS,
  ...aquaticForms.filter((form) => !SYNTHETIC_FEATURED_FORMS.some((featured) => featured === form)),
];

/**
 * The form a synthetic visitor gets, in turn through every form. Like real visitors, the day's first
 * ones cannot get an open-sea form until the tank's walls are gone; they get the next form instead.
 */
function syntheticForm(visitorIndex: number) {
  let turn = visitorIndex;
  while (!isOpenSea(visitorIndex) && isOpenSeaForm(syntheticFormRotation[turn % syntheticFormRotation.length])) turn += 1;
  return syntheticFormRotation[turn % syntheticFormRotation.length];
}

export type SyntheticContribution = {
  publicId: string;
  sessionId: string;
  creatureForm: (typeof aquaticForms)[number];
  creaturePalette: CreatureColorPalette;
  creaturePattern: CreaturePattern;
  creatureProportions: CreatureProportions;
  parts: SharedCreaturePart[];
  narrative: string[];
  tankBreakdown: number;
  createdAt: string;
};

const pathSteps = [1, 2, 3, 5, 7] as const;
const shortestPath = 3;
const longestPath = 12;

/** Walks the artifact list in fixed steps, skipping artifacts the visitor has already seen. */
function syntheticPath(start: number, step: number, length: number) {
  const visited = new Set<number>();
  let index = start;
  while (visited.size < Math.min(length, artifacts.length)) {
    while (visited.has(index)) index = (index + 1) % artifacts.length;
    visited.add(index);
    index = (index + step) % artifacts.length;
  }
  return [...visited].map((artifactIndex) => artifacts[artifactIndex]);
}

/**
 * Produces a repeatable exhibition day with varied routes, pauses, choices,
 * creature forms and assembled artifact narratives. The records are deliberately shaped
 * exactly like live contributions so every collective view uses the same path.
 */
export function createSyntheticDataset(
  cycleStartIso: string,
  count = SYNTHETIC_VISITOR_COUNT,
): SyntheticContribution[] {
  const cycleStart = new Date(cycleStartIso).getTime();
  if (!Number.isFinite(cycleStart)) {
    throw new Error("A valid cycle start is required for synthetic visitors.");
  }

  const dayKey = cycleStartIso.slice(0, 10).replaceAll("-", "");
  const firstCompletionMinute = 8 * 60 + 45;
  const lastCompletionMinute = 21 * 60 + 15;

  return Array.from({ length: count }, (_, visitorIndex) => {
    const progress = count <= 1 ? 0 : visitorIndex / (count - 1);
    const completionMinute = Math.round(
      firstCompletionMinute + progress * (lastCompletionMinute - firstCompletionMinute),
    );
    const completedAt = cycleStart + completionMinute * 60_000;
    const pathLength = shortestPath + (visitorIndex % (longestPath - shortestPath + 1));
    const pathStart = (visitorIndex * 7 + Math.floor(visitorIndex / 10)) % artifacts.length;
    const pathStep = pathSteps[visitorIndex % pathSteps.length];
    const selectedArtifacts = syntheticPath(pathStart, pathStep, pathLength);
    const dwellTimes = selectedArtifacts.map((_, pathIndex) =>
      35_000 + ((visitorIndex * 83 + pathIndex * 47) % 330) * 1_000,
    );
    const journeyDuration = dwellTimes.reduce((sum, duration) => sum + duration, 0);
    let discoveredAt = completedAt - journeyDuration;
    const discoveries = selectedArtifacts.map((artifact, pathIndex) => {
      const discovery = {
        artifactId: artifact.id,
        sequence: pathIndex + 1,
        discoveredAt,
        choiceId: artifact.choice.options[(visitorIndex + pathIndex) % artifact.choice.options.length].id,
      };
      discoveredAt += dwellTimes[pathIndex];
      return discovery;
    });
    const calculatedDwellTimes = calculateDwellTimes(discoveries, completedAt);
    const parts: SharedCreaturePart[] = discoveries.map((discovery, pathIndex) => {
      const artifact = selectedArtifacts[pathIndex];
      return {
        artifactId: artifact.id,
        partId: artifact.creaturePart.id,
        label: artifact.creaturePart.label,
        sequence: discovery.sequence,
        theme: artifact.theme,
        color: artifact.color,
        dwellMs: calculatedDwellTimes[pathIndex],
      };
    });

    // Visitors finish in order through the day, so each one breaks the walls a little further.
    const breakdown = tankBreakdown(visitorIndex + 1);
    const publicId = `synthetic-${dayKey}-${String(visitorIndex + 1).padStart(3, "0")}`;
    const sessionId = `synthetic:${dayKey}:${String(visitorIndex + 1).padStart(3, "0")}`;
    return {
      publicId,
      sessionId,
      creatureForm: syntheticForm(visitorIndex),
      creaturePalette: creatureColorPalette(sessionId),
      creaturePattern: creaturePattern(sessionId),
      creatureProportions: creatureProportions(sessionId),
      parts,
      narrative: generateJourneyNarrative(discoveries, artifacts, { breakdown, seed: sessionId }),
      tankBreakdown: breakdown,
      createdAt: new Date(completedAt).toISOString(),
    };
  });
}
