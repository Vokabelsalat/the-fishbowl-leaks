import type { ExhibitionArtifact } from "@/types/exhibition";
import type { Discovery } from "@/store/journeySlice";
import {
  artworkBanks,
  connectorShare,
  exhibitionNarrativeThemes,
  leakBanks,
  leakReadiness,
  middleConnectorKinds,
  narrativeGenreIds,
  narrativeGenres,
  sentenceConnectors,
  themeBanks,
  type NarrativeGenre,
  type NarrativeGenreId,
  type PosTag,
  type Slot,
} from "@/data/narrativeGrammar";
import { replacementMarkup } from "@/lib/narrative/narrativeMarkup";

type ConnectorKind = (typeof middleConnectorKinds)[number];
type Connector = { kind: ConnectorKind | "closing"; words: string };

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  }
  return result >>> 0;
}

function pick<T>(values: readonly T[], seed: string): T {
  return values[hash(seed) % values.length];
}

/** A seeded share from 0 to 1. */
function unit(seed: string) {
  return hash(seed) / 4294967296;
}

/**
 * Replaces the word with a leaking one, kept as markup so the old word shows crossed out, when the
 * tank has broken down far enough for this kind of word to give way.
 */
function leak(word: string, slot: Slot, breakdown: number, seed: string) {
  if (slot === "subject" || breakdown <= 0) return word;
  if (unit(`${seed}:leak`) >= breakdown * leakReadiness[slot]) return word;
  const replacements = leakBanks[slot].filter((candidate) => candidate !== word);
  return replacementMarkup(word, pick(replacements, `${seed}:leak-word`));
}

/**
 * The words that link a sentence to the one before it. The first sentence has none, and of the others
 * only about `connectorShare` do. The last of three or more closes the story; the rest link in a
 * different way than the last connector did, so the story moves on in time, follows from what came
 * before, or goes against it, in turn.
 */
function connectorFor(route: string, position: number, count: number, previous: Connector | null): Connector | null {
  if (position === 0 || unit(`${route}:${position}:connected`) >= connectorShare) return null;
  if (position === count - 1 && count >= 3) {
    return { kind: "closing", words: pick(sentenceConnectors.closing, `${route}:${position}:closing`) };
  }
  const kind = pick(middleConnectorKinds.filter((candidate) => candidate !== previous?.kind), `${route}:${position}:kind`);
  return { kind, words: pick(sentenceConnectors[kind], `${route}:${position}:connector`) };
}

/**
 * The line with its first letter in the given case. A line can open with a replaced word, written as
 * markup, and then both the old word and the new one change.
 */
function withFirstLetter(line: string, toCase: (letter: string) => string) {
  const replaced = /^\[\[(.)([^>]*)>>(.)/.exec(line);
  if (replaced) {
    const [whole, oldFirst, oldRest, newFirst] = replaced;
    return `[[${toCase(oldFirst)}${oldRest}>>${toCase(newFirst)}${line.slice(whole.length)}`;
  }
  return toCase(line[0]) + line.slice(1);
}

const upper = (letter: string) => letter.toUpperCase();
const lower = (letter: string) => letter.toLowerCase();

/** The genre a visitor's story is told in, decided by their session; without one, the aquarium's own record. */
export function narrativeGenreFor(seed?: string | null): NarrativeGenreId {
  if (!seed) return "aquarium";
  return pick(narrativeGenreIds, `${seed}:genre`);
}

function renderSentence(
  artifact: ExhibitionArtifact,
  genre: NarrativeGenre,
  story: string,
  position: number,
  breakdown: number,
  connector: Connector | null,
) {
  const artwork = artworkBanks[artifact.id] ?? {
    NP: { subject: [artifact.title] },
    VBD: { motion: ["drifted"] },
  };
  // The aquarium genre draws its nouns from the work's exhibition theme; the others bring their own.
  const words = genre.bank ?? themeBanks[exhibitionNarrativeThemes[artifact.id] ?? artifact.theme];
  const seed = `${story}:${position}:${artifact.id}`;
  const template = genre.templates[(hash(seed) + position) % genre.templates.length];
  const line = template.replace(/\{(NP|NN|JJ|VBD):([a-z]+)\}/g, (_, tag: PosTag, slot: Slot) => {
    let choices: readonly string[] | undefined;
    if (tag === "NP" && slot === "subject") choices = artwork.NP.subject;
    else if (tag === "VBD" && slot === "motion") choices = artwork.VBD.motion;
    else if (tag === "NN" && slot === "place") choices = words.NN.place;
    else if (tag === "NN" && slot === "boundary") choices = words.NN.boundary;
    else if (tag === "NN" && slot === "trace") choices = words.NN.trace;
    else if (tag === "JJ" && slot === "quality") choices = words.JJ.quality;
    else if (tag === "NP" && slot === "figure") choices = genre.bank?.NP.figure;
    else if (tag === "VBD" && slot === "action") choices = genre.bank?.VBD.action;
    if (!choices) throw new Error(`Invalid narrative slot: ${tag}:${slot}`);
    return leak(pick(choices, `${seed}:${tag}:${slot}`), slot, breakdown, `${seed}:${tag}:${slot}`);
  });
  // A template that opens with a slot opens with a subject or a character, never replaced: a subject
  // keeps its own case after a connector, since some are names, and characters are written in lower
  // case. A template that opens with its own words, like "The" or "In the", turns them lower case.
  const opensWithOwnWords = !template.startsWith("{");
  if (connector) return `${connector.words} ${opensWithOwnWords ? withFirstLetter(line, lower) : line}`;
  return withFirstLetter(line, upper);
}

/**
 * Writes one line per discovery. `seed` is the visitor's session: it decides the story's genre and,
 * with the route, its words. `breakdown` is how far the tank's compartments had broken apart when
 * the story was released, from 0 to 1: the further, the more of its classifying words are replaced.
 * Stories released before anything broke, and every story from before this existed, keep their words.
 */
export function generateJourneyNarrative(
  discoveries: Array<Pick<Discovery, "artifactId" | "sequence" | "discoveredAt">>,
  exhibitionArtifacts: ExhibitionArtifact[],
  { breakdown = 0, seed }: { breakdown?: number; seed?: string | null } = {},
): string[] {
  const artifactMap = new Map(exhibitionArtifacts.map((artifact) => [artifact.id, artifact]));
  const orderedDiscoveries = discoveries
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .filter((discovery) => artifactMap.has(discovery.artifactId));

  if (orderedDiscoveries.length === 0) return ["The fishbowl waits."];

  const route = orderedDiscoveries.map((discovery) => discovery.artifactId).join("|");
  // Two visitors on the same route still get their own words.
  const story = seed ? `${seed}|${route}` : route;
  const genre = narrativeGenres[narrativeGenreFor(seed)];
  let previousConnector: Connector | null = null;
  return orderedDiscoveries.flatMap((discovery, position) => {
    const artifact = artifactMap.get(discovery.artifactId);
    if (!artifact) return [];
    const connector = connectorFor(story, position, orderedDiscoveries.length, previousConnector);
    // A sentence without a connector leaves the last one standing, so the next still links differently.
    if (connector) previousConnector = connector;
    return [renderSentence(artifact, genre, story, position, breakdown, connector)];
  });
}
