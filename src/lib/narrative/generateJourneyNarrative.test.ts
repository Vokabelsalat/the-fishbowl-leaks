import { describe, expect, it } from "vitest";
import { artifacts } from "@/data/artifacts";
import { artworkBanks, clauseJoins, echoConnectors, exhibitionNarrativeThemes, middleConnectorKinds, narrativeGenreIds, narrativeGenres, sentenceConnectors, sentenceTemplates, themeBanks } from "@/data/narrativeGrammar";
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

/** A line's sentences as they read: a line can hold a second sentence, or end in a comma to run on. */
function sentencesOf(line: string) {
  return plainNarrativeLine(line).split(/(?<=[.!?])\s+/);
}

/** One session for each genre, found by trying sessions until every genre has one. */
function seedPerGenre() {
  const seeds = new Map<string, string>();
  for (let index = 0; seeds.size < narrativeGenreIds.length; index += 1) {
    const seed = `genre-probe-${index}`;
    if (!seeds.has(narrativeGenreFor(seed))) seeds.set(narrativeGenreFor(seed), seed);
  }
  return seeds;
}

/** Stories over many routes, lengths and sessions, every genre among them. */
function manyStories() {
  const stories: string[][] = [];
  for (const seed of seedPerGenre().values()) {
    for (let offset = 0; offset < artifacts.length; offset += 1) {
      for (const length of [3, 6]) {
        const route = discoveries(Array.from({ length }, (_, index) => artifacts[(offset + index * 5) % artifacts.length].id));
        stories.push(generateJourneyNarrative(route, artifacts, { seed, breakdown: offset % 2 ? 0.6 : 0 }));
      }
    }
  }
  return stories;
}

const escapeForPattern = (text: string) => text.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
/** Each echo opening as a pattern that captures the word it took up. */
const echoPatterns = Object.values(echoConnectors).flat().map((words) =>
  new RegExp(`^${escapeForPattern(words).replace(/\{[a-z]+\}/, "(.+?)")} `));
const opensWith = (line: string, words: readonly string[]) => words.some((opening) => plainNarrativeLine(line).startsWith(`${opening} `));
const runsOn = (line: string) => /^[a-z]/.test(plainNarrativeLine(line));

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

  it("tells each scan in one or two concise sentences, with no unresolved POS slots", () => {
    for (const artifact of artifacts) {
      const [line] = generateJourneyNarrative(discoveries([artifact.id]), artifacts);
      expect(line).toBeTruthy();
      expect(line, artifact.id).not.toMatch(/\{[^}]+\}/);
      const sentences = sentencesOf(line);
      expect(sentences.length, line).toBeGreaterThanOrEqual(1);
      expect(sentences.length, line).toBeLessThanOrEqual(2);
      for (const sentence of sentences) {
        expect(sentence.length, sentence).toBeLessThanOrEqual(120);
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(19);
      }
      expect(artworkBanks[artifact.id].NP.subject.some((subject) =>
        sentences[0].toLowerCase().includes(subject.toLowerCase()),
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
        for (const sentence of lines.flatMap(sentencesOf)) {
          expect(sentence.length, `${first.id} → ${second.id}: ${sentence}`).toBeLessThanOrEqual(130);
          expect(sentence.split(/\s+/).length, `${first.id} → ${second.id}: ${sentence}`).toBeLessThanOrEqual(22);
          expect(sentence).not.toMatch(/\{[^}]+\}/);
        }
      }
    }
  });

  it("links most sentences to the one before, in turns, and closes longer stories", () => {
    let linked = 0;
    let following = 0;
    let joined = 0;
    let echoed = 0;
    for (const lines of manyStories()) {
      expect(runsOn(lines[0]), lines[0]).toBe(false);
      const linkOf = (line: string) => {
        if (runsOn(line)) return "join";
        if (echoPatterns.some((pattern) => pattern.test(plainNarrativeLine(line)))) return "echo";
        const kind = middleConnectorKinds.find((candidate) => opensWith(line, sentenceConnectors[candidate]));
        if (kind) return kind;
        return opensWith(line, sentenceConnectors.closing) ? "closing" : null;
      };
      const links = lines.map(linkOf);
      links.slice(2).forEach((link, index) => {
        // Neither running on nor echoing follows itself.
        if (link === "join" || link === "echo") expect(link, lines.join(" ")).not.toBe(links[index + 1]);
      });
      // A story of three or more works ends on a closing link, run on or not.
      const last = plainNarrativeLine(lines.at(-1)!);
      expect(opensWith(last, sentenceConnectors.closing) || opensWith(last, clauseJoins.closing), last).toBe(true);
      linked += links.slice(1).filter(Boolean).length;
      joined += links.filter((link) => link === "join").length;
      echoed += links.filter((link) => link === "echo").length;
      following += lines.length - 1;
    }
    expect(linked / following).toBeGreaterThan(0.75);
    expect(joined / following).toBeGreaterThan(0.08);
    expect(echoed / following).toBeGreaterThan(0.08);
  });

  it("runs a sentence on only after a comma, never twice in a row, and keeps it readable", () => {
    for (const lines of manyStories()) {
      lines.forEach((line, index) => {
        const plain = plainNarrativeLine(line);
        if (index === lines.length - 1) expect(plain, plain).toMatch(/\.$/);
        if (!runsOn(line)) return;
        const before = plainNarrativeLine(lines[index - 1]);
        expect(before, `${before} ${plain}`).toMatch(/,$/);
        expect(runsOn(lines[index - 1]), `${before} ${plain}`).toBe(false);
        // The clause it runs on from has no comma or semicolon of its own.
        const clause = sentencesOf(lines[index - 1]).at(-1)!;
        expect(clause.slice(0, -1), before).not.toMatch(/[,;]/);
        expect(sentencesOf(line)[0].split(/\s+/).length + clause.split(/\s+/).length).toBeLessThanOrEqual(30);
      });
    }
  });

  it("picks up a word of the sentence before when it echoes it", () => {
    for (const lines of manyStories()) {
      lines.forEach((line, index) => {
        for (const pattern of echoPatterns) {
          const word = pattern.exec(plainNarrativeLine(line))?.[1];
          if (word) expect(plainNarrativeLine(lines[index - 1]).toLowerCase(), line).toContain(word.replace(/^the /, "").toLowerCase());
        }
      });
    }
  });

  it("lets about one work in five linger for a second sentence, never two in a row", () => {
    let lingering = 0;
    let works = 0;
    for (const lines of manyStories()) {
      const counts = lines.map((line) => sentencesOf(line).length);
      counts.forEach((count, index) => {
        expect(count).toBeLessThanOrEqual(2);
        if (count === 2 && index > 0) expect(counts[index - 1], lines.join(" ")).toBe(1);
      });
      lingering += counts.filter((count) => count === 2).length;
      works += lines.length;
    }
    expect(lingering / works).toBeGreaterThan(0.08);
    expect(lingering / works).toBeLessThan(0.3);
  });

  it("brings characters back as the ones already met", () => {
    let returning = 0;
    for (const lines of manyStories()) {
      const story = lines.map(plainNarrativeLine).join(" ").toLowerCase();
      for (const id of narrativeGenreIds) {
        for (const figure of narrativeGenres[id].bank?.NP.figure ?? []) {
          if (!/^an? /.test(figure)) continue;
          const first = story.indexOf(figure);
          if (first < 0) continue;
          if (story.indexOf(figure.replace(/^an? /, "the "), first) > first) returning += 1;
          // Once met, a character is never introduced a second time.
          expect(story.indexOf(figure, first + figure.length), story).toBe(-1);
        }
      }
    }
    expect(returning).toBeGreaterThan(0);
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
    for (const [genre, seed] of seedPerGenre()) {
      for (let offset = 0; offset < artifacts.length; offset += 1) {
        const route = discoveries(Array.from({ length: 5 }, (_, index) => artifacts[(offset + index * 7) % artifacts.length].id));
        for (const breakdown of [0, 1]) {
          for (const line of generateJourneyNarrative(route, artifacts, { seed, breakdown })) {
            for (const sentence of sentencesOf(line)) {
              expect(sentence, genre).not.toMatch(/\{[^}]+\}/);
              expect(sentence.length, `${genre}: ${sentence}`).toBeLessThanOrEqual(150);
              expect(sentence.split(/\s+/).length, `${genre}: ${sentence}`).toBeLessThanOrEqual(24);
            }
            // Only a line that runs on from the one before opens in lower case.
            const plain = plainNarrativeLine(line);
            if (!runsOn(line)) expect(plain[0], plain).toBe(plain[0].toUpperCase());
          }
        }
      }
    }
  });

  it("gives every genre follow-ups, one of them needing no word from the sentence before", () => {
    for (const id of narrativeGenreIds) {
      const { followUps } = narrativeGenres[id];
      expect(followUps.length, id).toBeGreaterThanOrEqual(4);
      expect(followUps.some((template) => !template.includes("{REF:")), id).toBe(true);
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
