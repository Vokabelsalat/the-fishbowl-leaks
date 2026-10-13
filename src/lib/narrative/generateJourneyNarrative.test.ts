import { describe, expect, it } from "vitest";
import { artifacts } from "@/data/artifacts";
import { artworkBanks, exhibitionNarrativeThemes, middleConnectorKinds, narrativeGenreIds, narrativeGenres, sentenceConnectors, sentenceTemplates, themeBanks } from "@/data/narrativeGrammar";
import { generateJourneyNarrative, narrativeGenreFor } from "@/lib/narrative/generateJourneyNarrative";
import { parseNarrativeLine, plainNarrativeLine } from "@/lib/narrative/narrativeMarkup";
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

  it("links about half the sentences to the one before, each time in a different way", () => {
    const kindOf = (line: string) => middleConnectorKinds.find((kind) =>
      sentenceConnectors[kind].some((words) => line.startsWith(`${words} `)));
    const closes = (line: string) => sentenceConnectors.closing.some((words) => line.startsWith(`${words} `));
    let linked = 0;
    let following = 0;
    for (let offset = 0; offset < artifacts.length; offset += 1) {
      const route = Array.from({ length: 6 }, (_, index) => artifacts[(offset + index * 5) % artifacts.length].id);
      const lines = generateJourneyNarrative(discoveries(route), artifacts);
      expect(kindOf(lines[0])).toBeUndefined();
      const kinds = lines.slice(1, -1).map(kindOf).filter((kind) => kind !== undefined);
      kinds.slice(1).forEach((kind, index) => expect(kind).not.toBe(kinds[index]));
      linked += kinds.length + (closes(lines.at(-1)!) ? 1 : 0);
      following += lines.length - 1;
    }
    expect(linked / following).toBeGreaterThan(0.3);
    expect(linked / following).toBeLessThan(0.7);
  });

  it("tells each visitor's story in a genre their session decides", () => {
    const route = discoveries(["finding-frida", "emperor", "earth-fortunes", "goliath"]);
    const seeds = Array.from({ length: 60 }, (_, index) => `session-${index}`);
    expect(new Set(seeds.map(narrativeGenreFor))).toEqual(new Set(narrativeGenreIds));
    for (const seed of seeds) {
      expect(narrativeGenreFor(seed)).toBe(narrativeGenreFor(seed));
      expect(generateJourneyNarrative(route, artifacts, { seed })).toEqual(generateJourneyNarrative(route, artifacts, { seed }));
    }
    expect(narrativeGenreFor(undefined)).toBe("aquarium");
  });

  it("gives every genre enough words, and templates that name the artwork", () => {
    for (const id of narrativeGenreIds) {
      const genre = narrativeGenres[id];
      expect(genre.templates.length, id).toBeGreaterThanOrEqual(5);
      expect(genre.templates.every((template) => /\{NP:subject\}/.test(template)), id).toBe(true);
      if (!genre.bank) continue;
      for (const words of [genre.bank.NN.place, genre.bank.NN.boundary, genre.bank.NN.trace, genre.bank.JJ.quality, genre.bank.NP.figure, genre.bank.VBD.action]) {
        expect(words.length, id).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("keeps every genre's sentences brief and complete", () => {
    // One seed per genre, found by trying sessions until each genre has one.
    const seedFor = new Map<string, string>();
    for (let index = 0; seedFor.size < narrativeGenreIds.length; index += 1) {
      const seed = `genre-probe-${index}`;
      if (!seedFor.has(narrativeGenreFor(seed))) seedFor.set(narrativeGenreFor(seed), seed);
    }
    for (const [genre, seed] of seedFor) {
      for (let offset = 0; offset < artifacts.length; offset += 1) {
        const route = discoveries(Array.from({ length: 5 }, (_, index) => artifacts[(offset + index * 7) % artifacts.length].id));
        for (const breakdown of [0, 1]) {
          for (const line of generateJourneyNarrative(route, artifacts, { seed, breakdown })) {
            const plain = plainNarrativeLine(line);
            expect(plain, genre).not.toMatch(/\{[^}]+\}/);
            expect(plain.length, `${genre}: ${plain}`).toBeLessThanOrEqual(120);
            expect(plain.split(/\s+/).length, `${genre}: ${plain}`).toBeLessThanOrEqual(19);
            expect(plain[0], plain).toBe(plain[0].toUpperCase());
          }
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

  it("leaves stories untouched while the tank is whole", () => {
    const route = discoveries(artifacts.slice(0, 8).map(({ id }) => id));
    expect(generateJourneyNarrative(route, artifacts, { breakdown: 0 })).toEqual(generateJourneyNarrative(route, artifacts));
    expect(generateJourneyNarrative(route, artifacts).join(" ")).not.toContain("[[");
  });

  it("replaces more classifying words the further the tank has broken, keeping the old ones", () => {
    const routes = artifacts.map((_, start) => discoveries([0, 3, 6, 9].map((step) => artifacts[(start + step) % artifacts.length].id)));
    const replacements = (breakdown: number) => routes
      .flatMap((route) => generateJourneyNarrative(route, artifacts, { breakdown }))
      .flatMap(parseNarrativeLine)
      .filter((segment) => "replaced" in segment);
    expect(replacements(0.3).length).toBeGreaterThan(0);
    expect(replacements(1).length).toBeGreaterThan(replacements(0.3).length);
    replacements(1).forEach((segment) => {
      if (!("replaced" in segment)) return;
      expect(segment.replaced).not.toBe(segment.by);
      expect(segment.replaced.length).toBeGreaterThan(0);
    });
  });

  it("never replaces an artwork's own subject", () => {
    for (const artifact of artifacts) {
      const subjects = artworkBanks[artifact.id].NP.subject;
      const [line] = generateJourneyNarrative(discoveries([artifact.id]), artifacts, { breakdown: 1 });
      const replaced = parseNarrativeLine(line).flatMap((segment) => ("replaced" in segment ? [segment.replaced.toLowerCase()] : []));
      expect(replaced.some((word) => subjects.map((subject) => subject.toLowerCase()).includes(word)), line).toBe(false);
    }
  });

  it("reads as a plain sentence with only the new words", () => {
    expect(plainNarrativeLine("Frida's villa [[resurfaced>>leaked]] past the [[glass wall>>crack]].")).toBe("Frida's villa leaked past the crack.");
    expect(parseNarrativeLine("A [[net>>gap]] opened.")).toEqual([{ text: "A " }, { replaced: "net", by: "gap" }, { text: " opened." }]);
  });
});
