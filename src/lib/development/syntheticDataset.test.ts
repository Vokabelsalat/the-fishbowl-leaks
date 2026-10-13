import { describe, expect, it } from "vitest";
import { artifacts } from "@/data/artifacts";
import { aquaticForms, isOpenSeaForm } from "@/lib/creature/aquaticForms";
import { isCreatureColorPalette } from "@/lib/creature/colorPalettes";
import { isCreaturePattern } from "@/lib/creature/patterns";
import { isCreatureProportions } from "@/lib/creature/proportions";
import {
  createSyntheticDataset,
  SYNTHETIC_FEATURED_FORMS,
  SYNTHETIC_VISITOR_COUNT,
} from "@/lib/development/syntheticDataset";

describe("createSyntheticDataset", () => {
  const cycleStart = "2026-10-02T22:00:00.000Z";

  it("builds a deterministic full exhibition day", () => {
    const first = createSyntheticDataset(cycleStart);
    const second = createSyntheticDataset(cycleStart);

    expect(first).toEqual(second);
    expect(first).toHaveLength(SYNTHETIC_VISITOR_COUNT);
    expect(new Set(first.map((visitor) => visitor.createdAt)).size).toBe(first.length);
    expect(first.map((visitor) => visitor.createdAt)).toEqual(
      first.map((visitor) => visitor.createdAt).slice().sort(),
    );
  });

  it("covers every creature form and creates varied path-based narratives", () => {
    const dataset = createSyntheticDataset(cycleStart);
    const knownArtifacts = new Set(artifacts.map((artifact) => artifact.id));
    const uniquePaths = new Set(
      dataset.map((visitor) => visitor.parts.map((part) => part.artifactId).join("|")),
    );
    const uniqueNarratives = new Set(
      dataset.map((visitor) => visitor.narrative.join("\n")),
    );

    expect(new Set(dataset.map((visitor) => visitor.creatureForm))).toEqual(
      new Set(aquaticForms),
    );
    expect(new Set(dataset.map((visitor) => visitor.parts.length)).size).toBeGreaterThan(3);
    expect(uniqueNarratives.size).toBe(uniquePaths.size);
    expect(dataset.every((visitor) => visitor.parts.every((part) => knownArtifacts.has(part.artifactId)))).toBe(true);
    expect(dataset.every((visitor) => new Set(visitor.parts.map((part) => part.artifactId)).size === visitor.parts.length)).toBe(true);
    expect(dataset.every((visitor) => visitor.parts.every((part) => (part.dwellMs ?? 0) >= 35_000))).toBe(true);
    expect(dataset.every((visitor) => visitor.narrative.length === visitor.parts.length)).toBe(true);
  });

  it("features the new marine species in the test aquarium", () => {
    const dataset = createSyntheticDataset(cycleStart);

    // Whales come only once the tank is the open sea, so the first visitors meet the other featured forms.
    const aquariumFeaturedForms = SYNTHETIC_FEATURED_FORMS.filter((form) => !isOpenSeaForm(form));
    expect(dataset.slice(0, aquariumFeaturedForms.length).map((visitor) => visitor.creatureForm)).toEqual(
      aquariumFeaturedForms,
    );
    const includedForms = new Set(dataset.map((visitor) => visitor.creatureForm));
    SYNTHETIC_FEATURED_FORMS.forEach((form) => expect(includedForms.has(form)).toBe(true));
  });

  it("encodes a valid color palette with every creature", () => {
    const dataset = createSyntheticDataset(cycleStart);

    expect(dataset.every((visitor) => isCreatureColorPalette(visitor.creaturePalette))).toBe(true);
    expect(dataset.every((visitor) => isCreaturePattern(visitor.creaturePattern))).toBe(true);
    expect(dataset.every((visitor) => isCreatureProportions(visitor.creatureProportions))).toBe(true);
  });
});
