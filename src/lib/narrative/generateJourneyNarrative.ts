import type { ExhibitionArtifact } from "@/types/exhibition";
import type { Discovery } from "@/store/journeySlice";
import {
  artworkBanks,
  clauseJoins,
  echoConnectors,
  echoShare,
  exhibitionNarrativeThemes,
  followUpShare,
  joinShare,
  leakBanks,
  leakReadiness,
  linkShare,
  middleConnectorKinds,
  narrativeGenreIds,
  narrativeGenres,
  protagonistShare,
  sentenceConnectors,
  themeBanks,
  type NarrativeGenre,
  type NarrativeGenreId,
  type PosTag,
  type RefSlot,
  type Slot,
} from "@/data/narrativeGrammar";
import { plainNarrativeLine, replacementMarkup } from "@/lib/narrative/narrativeMarkup";

type LinkKind = (typeof middleConnectorKinds)[number];
/** How a sentence ties to the one before: its kind, the words that do it, and whether it runs on. */
type Link = { kind: LinkKind | "echo" | "closing"; words: string; joins: boolean };
/** Words a sentence used, as they now read, for the next sentences to take up again. */
type Refs = Partial<Record<RefSlot, string>>;

/** Two sentences run together stay readable up to about this many words. */
const JOINED_WORD_LIMIT = 26;

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

/** The values in a seeded order, so a story can walk through them without repeating one too soon. */
function shuffled<T>(values: readonly T[], seed: string): T[] {
  return values
    .map((value, index) => ({ value, order: hash(`${seed}:${index}`) }))
    .sort((a, b) => a.order - b.order)
    .map(({ value }) => value);
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

/** A character met before is "the" one: "a selkie" becomes "the selkie" when it returns. */
function definite(figure: string) {
  return figure.replace(/^an? /, "the ");
}

const wordCount = (line: string) => plainNarrativeLine(line).split(/\s+/).length;
/** A sentence of one clause, with no comma or semicolon of its own, which can run on into another. */
const singleClause = (line: string) => !/[,;]/.test(plainNarrativeLine(line));

/** The story so far, as the sentences still to come need it. */
type StoryState = {
  genre: NarrativeGenre;
  story: string;
  breakdown: number;
  /** The genre's recurring character, if it has characters at all. */
  protagonist: string | null;
  /** Characters already met, so they return with "the". */
  met: Set<string>;
};

/**
 * Fills a template's slots. `refs` are the words a follow-up can take up again; the words the
 * sentence uses itself are collected into `used`, as they read after any leaking.
 */
function fillTemplate(template: string, artifact: ExhibitionArtifact, state: StoryState, seed: string, refs: Refs, used: Refs) {
  const artwork = artworkBanks[artifact.id] ?? {
    NP: { subject: [artifact.title] },
    VBD: { motion: ["drifted"] },
  };
  const { genre, breakdown } = state;
  // The aquarium genre draws its nouns from the work's exhibition theme; the others bring their own.
  const words = genre.bank ?? themeBanks[exhibitionNarrativeThemes[artifact.id] ?? artifact.theme];
  return template.replace(/\{(NP|NN|JJ|VBD|REF):([a-z]+)\}/g, (_, tag: PosTag | "REF", slot: Slot) => {
    const slotSeed = `${seed}:${tag}:${slot}`;
    if (tag === "REF") {
      const word = refs[slot as RefSlot];
      if (!word) throw new Error(`Missing narrative reference: ${slot}`);
      return word;
    }
    if (tag === "NP" && slot === "figure") {
      const figures = genre.bank?.NP.figure;
      if (!figures) throw new Error(`Invalid narrative slot: ${tag}:${slot}`);
      const figure = state.protagonist && unit(`${slotSeed}:protagonist`) < protagonistShare
        ? state.protagonist
        : pick(figures, slotSeed);
      const named = state.met.has(figure) ? definite(figure) : figure;
      state.met.add(figure);
      const written = leak(named, slot, breakdown, slotSeed);
      used.figure = definite(plainNarrativeLine(written));
      return written;
    }
    let choices: readonly string[] | undefined;
    if (tag === "NP" && slot === "subject") choices = artwork.NP.subject;
    else if (tag === "VBD" && slot === "motion") choices = artwork.VBD.motion;
    else if (tag === "NN" && slot === "place") choices = words.NN.place;
    else if (tag === "NN" && slot === "boundary") choices = words.NN.boundary;
    else if (tag === "NN" && slot === "trace") choices = words.NN.trace;
    else if (tag === "JJ" && slot === "quality") choices = words.JJ.quality;
    else if (tag === "VBD" && slot === "action") choices = genre.bank?.VBD.action;
    if (!choices) throw new Error(`Invalid narrative slot: ${tag}:${slot}`);
    const written = leak(pick(choices, slotSeed), slot, breakdown, slotSeed);
    if (tag === "NN") used[slot as RefSlot] = plainNarrativeLine(written);
    return written;
  });
}

/** The `REF` slots a follow-up asks for, which its artwork's first sentence must have used. */
function refsNeeded(template: string) {
  return Array.from(template.matchAll(/\{REF:([a-z]+)\}/g), (match) => match[1] as RefSlot);
}

/**
 * How a sentence ties to the one before. The first stands alone, and so do a few later ones. The
 * last of three or more closes the story. The rest run on from the sentence before, pick up one of
 * its words, or open with a connector, and never link the same way twice in a row.
 */
function linkFor(
  state: StoryState,
  position: number,
  count: number,
  previous: { link: Link | null; refs: Refs; lastSentence: string } | null,
  sentence: { opensWithSlot: boolean; text: string },
): Link | null {
  if (!previous) return null;
  const seed = `${state.story}:${position}:link`;
  // Running on is only for short sentences, after one of a single clause and before one without a
  // semicolon, and never twice in a row, so no sentence sprawls into a tangle of clauses.
  const canJoin = !previous.link?.joins
    && singleClause(previous.lastSentence)
    && !plainNarrativeLine(sentence.text).includes(";")
    && wordCount(previous.lastSentence) + wordCount(sentence.text) <= JOINED_WORD_LIMIT;

  if (position === count - 1 && count >= 3) {
    const joins = canJoin && unit(`${seed}:closing-join`) < joinShare;
    return { kind: "closing", joins, words: pick(joins ? clauseJoins.closing : sentenceConnectors.closing, `${seed}:closing`) };
  }
  if (unit(`${seed}:linked`) >= linkShare) return null;

  // Where a sentence can run on from the one before, it often does; that ties them closest.
  if (canJoin && unit(`${seed}:join`) < joinShare) {
    const kind = pick(middleConnectorKinds.filter((candidate) => candidate !== previous.link?.kind), `${seed}:join-kind`);
    return { kind, joins: true, words: pick(clauseJoins[kind], `${seed}:join-words`) };
  }
  if (sentence.opensWithSlot && previous.link?.kind !== "echo" && unit(`${seed}:echo`) < echoShare) {
    const echoes = (Object.keys(echoConnectors) as RefSlot[]).filter((slot) => previous.refs[slot]);
    if (echoes.length > 0) {
      const slot = pick(echoes, `${seed}:echo-slot`);
      const words = pick(echoConnectors[slot], `${seed}:echo-words`).replace(`{${slot}}`, previous.refs[slot]!);
      return { kind: "echo", joins: false, words };
    }
  }
  const kind = pick(middleConnectorKinds.filter((candidate) => candidate !== previous.link?.kind), `${seed}:kind`);
  return { kind, joins: false, words: pick(sentenceConnectors[kind], `${seed}:words`) };
}

/**
 * Writes one line per discovery: a sentence, now and then followed by a second one, which together
 * read as one passage. `seed` is the visitor's session: it decides the story's genre and, with the
 * route, its words. `breakdown` is how far the tank's compartments had broken apart when the story
 * was released, from 0 to 1: the further, the more of its classifying words are replaced. Stories
 * released before anything broke, and every story from before this existed, keep their words.
 *
 * A line can run on into the next: it then ends in a comma, and the next opens with a conjunction
 * in lower case, so the lines are meant to be shown together as one paragraph.
 */
export function generateJourneyNarrative(
  discoveries: Array<Pick<Discovery, "artifactId" | "sequence" | "discoveredAt">>,
  exhibitionArtifacts: ExhibitionArtifact[],
  { breakdown = 0, seed }: { breakdown?: number; seed?: string | null } = {},
): string[] {
  const artifactMap = new Map(exhibitionArtifacts.map((artifact) => [artifact.id, artifact]));
  const orderedArtifacts = discoveries
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .flatMap((discovery) => artifactMap.get(discovery.artifactId) ?? []);

  if (orderedArtifacts.length === 0) return ["The fishbowl waits."];

  const route = orderedArtifacts.map((artifact) => artifact.id).join("|");
  // Two visitors on the same route still get their own words.
  const story = seed ? `${seed}|${route}` : route;
  const genre = narrativeGenres[narrativeGenreFor(seed)];
  const state: StoryState = {
    genre,
    story,
    breakdown,
    protagonist: genre.bank ? pick(genre.bank.NP.figure, `${story}:protagonist`) : null,
    met: new Set(),
  };

  // Each story walks through the genre's templates in its own order, so none returns before all
  // have been used, and no follow-up is told twice.
  const templates = shuffled(genre.templates, `${story}:templates`);
  const toldFollowUps = new Set<string>();
  const lines: string[] = [];
  let previous: { link: Link | null; refs: Refs; lastSentence: string; followedUp: boolean } | null = null;
  orderedArtifacts.forEach((artifact, position) => {
    const sentenceSeed = `${story}:${position}:${artifact.id}`;
    const template = templates[position % templates.length];
    const used: Refs = {};
    const sentence = fillTemplate(template, artifact, state, sentenceSeed, {}, used);
    // A template that opens with a slot opens with a subject or a character, never replaced: a
    // subject keeps its own case after a connector, since some are names, and characters are written
    // in lower case. A template that opens with its own words, like "The" or "In the", turns them
    // lower case.
    const opensWithSlot = template.startsWith("{");
    const link = linkFor(state, position, orderedArtifacts.length, previous, { opensWithSlot, text: sentence });

    let line = withFirstLetter(sentence, upper);
    if (link) {
      line = `${link.words} ${opensWithSlot ? sentence : withFirstLetter(sentence, lower)}`;
      if (link.joins) {
        line = withFirstLetter(line, lower);
        lines[lines.length - 1] = lines[lines.length - 1].replace(/\.$/, ",");
      }
    }

    // Now and then the work lingers for a second sentence, taking up a word of the first.
    const followUps = genre.followUps.filter((candidate) =>
      !toldFollowUps.has(candidate) && refsNeeded(candidate).every((slot) => used[slot]));
    const followsUp = !previous?.followedUp && followUps.length > 0 && unit(`${sentenceSeed}:follow-up`) < followUpShare;
    let lastSentence = line;
    const refs: Refs = { ...used };
    if (followsUp) {
      const followUpTemplate = pick(followUps, `${sentenceSeed}:follow-up-template`);
      toldFollowUps.add(followUpTemplate);
      const followUp = withFirstLetter(fillTemplate(followUpTemplate, artifact, state, `${sentenceSeed}:follow-up`, used, refs), upper);
      line = `${line} ${followUp}`;
      lastSentence = followUp;
    }

    lines.push(line);
    previous = { link, refs, lastSentence, followedUp: followsUp };
  });
  return lines;
}
