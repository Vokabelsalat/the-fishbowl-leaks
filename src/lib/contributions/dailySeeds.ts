import { artifacts } from "@/data/artifacts";
import { aquaticForms, isOpenSeaForm } from "@/lib/creature/aquaticForms";
import { generateJourneyNarrative } from "@/lib/narrative/generateJourneyNarrative";
import { creatureColorPalette } from "@/lib/creature/colorPalettes";
import { creaturePattern } from "@/lib/creature/patterns";
import { creatureProportions } from "@/lib/creature/proportions";
import { createSyntheticDataset, type SyntheticContribution } from "@/lib/development/syntheticDataset";

/** How many creatures already swim in the tank when it starts out empty, so it never stands empty. */
export const DAILY_SEED_COUNT = 10;

/**
 * The synthetic creatures a new, empty tank starts with: one each of ten different forms, with the
 * selection depending on the day it starts. Whales belong to the open sea, not the aquarium the tank
 * begins as, so there are none. The seeds are timed at the very start of that day, so they come
 * before every visitor, and their ids name them as seeds. `idKey` tells batches apart; it is the
 * day, or the opening moment when the tank starts at one. The tank used to start over every day with
 * a fresh set; it now keeps its creatures, so these are added only once.
 */
export function createDailySeeds(cycleStartIso: string, cycleDate: string, idKey = cycleDate.replaceAll("-", "")): SyntheticContribution[] {
  const cycleStart = new Date(cycleStartIso).getTime();
  const dayNumber = Math.floor(Date.parse(`${cycleDate}T00:00:00Z`) / 86_400_000);
  if (!Number.isFinite(cycleStart) || !Number.isFinite(dayNumber)) {
    throw new Error("A valid cycle start and date are required for the daily seed creatures.");
  }
  // The synthetic visitors cycle through every form in turn, so any run of consecutive ones differs in form.
  const offset = dayNumber % aquaticForms.length;

  return createSyntheticDataset(cycleStartIso, aquaticForms.length * 2)
    .slice(offset, offset + aquaticForms.length)
    .filter((creature) => !isOpenSeaForm(creature.creatureForm))
    .slice(0, DAILY_SEED_COUNT)
    .map((creature, index) => {
      const number = String(index + 1).padStart(2, "0");
      const sessionId = `daily-seed:${idKey}:${number}`;
      return {
        ...creature,
        publicId: `daily-seed-${idKey}-${number}`,
        sessionId,
        creaturePalette: creatureColorPalette(sessionId),
        creaturePattern: creaturePattern(sessionId),
        creatureProportions: creatureProportions(sessionId),
        // Told in the genre its own session draws, as the tank will tell it, with the walls still whole.
        narrative: generateJourneyNarrative(
          creature.parts.map((part) => ({ artifactId: part.artifactId, sequence: part.sequence, discoveredAt: part.sequence })),
          artifacts,
          { seed: sessionId },
        ),
        tankBreakdown: 0,
        createdAt: new Date(cycleStart + index * 1_000).toISOString(),
      };
    });
}
