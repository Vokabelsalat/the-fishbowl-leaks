import { artifacts } from "@/data/artifacts";
import { aquaticForms, isOpenSeaForm } from "@/lib/creature/aquaticForms";
import { generateJourneyNarrative } from "@/lib/narrative/generateJourneyNarrative";
import { creatureColorPalette } from "@/lib/creature/colorPalettes";
import { creaturePattern } from "@/lib/creature/patterns";
import { creatureProportions } from "@/lib/creature/proportions";
import { createSyntheticDataset, type SyntheticContribution } from "@/lib/development/syntheticDataset";

/** How many creatures already swim in the tank when a day begins, so it never stands empty. */
export const DAILY_SEED_COUNT = 10;

/**
 * The synthetic creatures that open a day's tank: one each of ten different forms, with the
 * selection moving on by one form every day. Whales belong to the open sea, not the aquarium the
 * day begins with, so there are none. The seeds are timed at the very start of the day, so they
 * come before every visitor, and their ids name them as daily seeds.
 */
export function createDailySeeds(cycleStartIso: string, cycleDate: string): SyntheticContribution[] {
  const cycleStart = new Date(cycleStartIso).getTime();
  const dayNumber = Math.floor(Date.parse(`${cycleDate}T00:00:00Z`) / 86_400_000);
  if (!Number.isFinite(cycleStart) || !Number.isFinite(dayNumber)) {
    throw new Error("A valid cycle start and date are required for the daily seed creatures.");
  }
  const dayKey = cycleDate.replaceAll("-", "");
  // The synthetic visitors cycle through every form in turn, so any run of consecutive ones differs in form.
  const offset = dayNumber % aquaticForms.length;

  return createSyntheticDataset(cycleStartIso, aquaticForms.length * 2)
    .slice(offset, offset + aquaticForms.length)
    .filter((creature) => !isOpenSeaForm(creature.creatureForm))
    .slice(0, DAILY_SEED_COUNT)
    .map((creature, index) => {
      const number = String(index + 1).padStart(2, "0");
      const sessionId = `daily-seed:${dayKey}:${number}`;
      return {
        ...creature,
        publicId: `daily-seed-${dayKey}-${number}`,
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
