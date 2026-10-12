import { describe, expect, it } from "vitest";
import { artifacts } from "@/data/artifacts";
import { artworkBanks, exhibitionNarrativeThemes, sentenceTemplates, themeBanks } from "@/data/narrativeGrammar";
import { generateJourneyNarrative } from "@/lib/narrative/generateJourneyNarrative";
import type { Discovery } from "@/store/journeySlice";

function discoveries(ids: string[]): Discovery[] {
  return ids.map((artifactId, index) => ({
    artifactId,
    sequence: index + 1,
    discoveredAt: 100 + index,
  }));
}

describe("generateJourneyNarrative", () => {
  it("gives every artwork an authored motif and grammatical replacements", () => {
    for (const artifact of artifacts) {
      const bank = artworkBanks[artifact.id];
      expect(bank, artifact.id).toBeDefined();
      expect(bank.NP.subject.length).toBeGreaterThanOrEqual(3);
      expect(bank.VBD.motion.length).toBeGreaterThanOrEqual(3);
      expect(exhibitionNarrativeThemes[artifact.id]).toBeDefined();
      const theme = themeBanks[exhibitionNarrativeThemes[artifact.id]];
      expect(theme.NN.place.length).toBeGreaterThanOrEqual(8);
      expect(theme.NN.boundary.length).toBeGreaterThanOrEqual(8);
      expect(theme.NN.trace.length).toBeGreaterThanOrEqual(8);
      expect(theme.JJ.quality.length).toBeGreaterThanOrEqual(8);
    }
    expect(sentenceTemplates.every((template) => /\{NP:subject\}/.test(template))).toBe(true);
  });

  it("keeps one concise sentence per scan, with no unresolved POS slots", () => {
    for (const artifact of artifacts) {
      const [line] = generateJourneyNarrative(discoveries([artifact.id]), artifacts);
      expect(line).toBeTruthy();
      expect(line.length, artifact.id).toBeLessThanOrEqual(105);
      expect(line.split(/\s+/).length, artifact.id).toBeLessThanOrEqual(16);
      expect(line.match(/[.!?]/g), artifact.id).toHaveLength(1);
      expect(line, artifact.id).not.toMatch(/\{[^}]+\}/);
      expect(artworkBanks[artifact.id].NP.subject.some((subject) =>
        line.toLowerCase().includes(subject.toLowerCase()),
      ), artifact.id).toBe(true);
    }
  });

  it("preserves encounter order and varies sentences with the route", () => {
    const first = discoveries(["finding-frida", "emperor", "earth-fortunes"]);
    const reverse = discoveries(["earth-fortunes", "emperor", "finding-frida"]);
    const lines = generateJourneyNarrative(first, artifacts);
    expect(lines).toHaveLength(3);
    expect(lines).toEqual(generateJourneyNarrative(first, artifacts));
    expect(lines).not.toEqual(generateJourneyNarrative(reverse, artifacts));
    expect(artworkBanks["finding-frida"].NP.subject.some((subject) =>
      lines[0].toLowerCase().includes(subject.toLowerCase()),
    )).toBe(true);
    expect(artworkBanks["earth-fortunes"].NP.subject.some((subject) =>
      lines[2].toLowerCase().includes(subject.toLowerCase()),
    )).toBe(true);
  });

  it("stays brief across many different route combinations", () => {
    for (const first of artifacts) {
      for (const second of artifacts) {
        if (first.id === second.id) continue;
        const lines = generateJourneyNarrative(discoveries([first.id, second.id]), artifacts);
        expect(lines).toHaveLength(2);
        for (const line of lines) {
          expect(line.length, `${first.id} → ${second.id}`).toBeLessThanOrEqual(105);
          expect(line.split(/\s+/).length, `${first.id} → ${second.id}`).toBeLessThanOrEqual(16);
          expect(line).not.toMatch(/\{[^}]+\}/);
        }
      }
    }
  });

  it("keeps every stop in a longer path", () => {
    const path = discoveries([
      "finding-frida", "historically-yours", "from-ingrid-to-bergen",
      "your-update-has-failed", "between-page-and-screen",
    ]);
    expect(generateJourneyNarrative(path, artifacts)).toHaveLength(path.length);
  });

  it("waits quietly before the first scan", () => {
    expect(generateJourneyNarrative([], artifacts)).toEqual(["The fishbowl waits."]);
  });
});
