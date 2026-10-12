import type { CreaturePartId, ThemeId } from "@/types/exhibition";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import type { CreatureColorPalette } from "@/lib/creature/colorPalettes";
import type { CreaturePattern } from "@/lib/creature/patterns";
import type { CreatureProportions } from "@/lib/creature/proportions";
import type { ArtworkFeedback } from "@/lib/evaluation/artworkFeedback";

export type SharedCreaturePart = {
  artifactId: string;
  partId: CreaturePartId;
  label: string;
  sequence: number;
  theme: ThemeId;
  color: string;
  /** Time from this scan until the next scan or journey completion. */
  dwellMs?: number;
  feedback?: ArtworkFeedback;
};

export type ExhibitionContribution = {
  id: number;
  publicId: string;
  creatureForm: AquaticForm;
  creaturePalette: CreatureColorPalette;
  creaturePattern: CreaturePattern;
  creatureProportions: CreatureProportions;
  parts: SharedCreaturePart[];
  narrative: string[];
  createdAt: string;
  /** A synthetic creature the day's tank opened with, not a visitor's; it stays out of the heatmap and the walls' breakdown. */
  dailySeed?: boolean;
};

export type CollectiveHeatDatum = {
  artifactId: string;
  totalDwellMs: number;
  visitCount: number;
  averageDwellMs: number;
};

export type ContributionSubmission = {
  sessionId: string;
  creatureForm: AquaticForm;
  creaturePalette: CreatureColorPalette;
  creaturePattern: CreaturePattern;
  creatureProportions: CreatureProportions;
  completedAt: number;
  discoveries: Array<{
    artifactId: string;
    sequence: number;
    discoveredAt: number;
    choiceId?: string;
    feedback?: ArtworkFeedback;
  }>;
};
