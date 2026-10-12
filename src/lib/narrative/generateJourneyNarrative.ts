import type { ExhibitionArtifact } from "@/types/exhibition";
import type { Discovery } from "@/store/journeySlice";
import { artworkBanks, exhibitionNarrativeThemes, leakBanks, leakReadiness, sentenceTemplates, themeBanks, type PosTag, type Slot } from "@/data/narrativeGrammar";
import { replacementMarkup } from "@/lib/narrative/narrativeMarkup";

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

function renderSentence(artifact: ExhibitionArtifact, route: string, position: number, breakdown: number) {
  const artwork = artworkBanks[artifact.id] ?? {
    NP: { subject: [artifact.title] },
    VBD: { motion: ["drifted"] },
  };
  const theme = themeBanks[exhibitionNarrativeThemes[artifact.id] ?? artifact.theme];
  const seed = `${route}:${position}:${artifact.id}`;
  const template = sentenceTemplates[(hash(seed) + position) % sentenceTemplates.length];
  const line = template.replace(/\{(NP|NN|JJ|VBD):([a-z]+)\}/g, (_, tag: PosTag, slot: Slot) => {
    let words: readonly string[];
    if (tag === "NP" && slot === "subject") words = artwork.NP.subject;
    else if (tag === "VBD" && slot === "motion") words = artwork.VBD.motion;
    else if (tag === "NN" && slot === "place") words = theme.NN.place;
    else if (tag === "NN" && slot === "boundary") words = theme.NN.boundary;
    else if (tag === "NN" && slot === "trace") words = theme.NN.trace;
    else if (tag === "JJ" && slot === "quality") words = theme.JJ.quality;
    else throw new Error(`Invalid narrative slot: ${tag}:${slot}`);
    return leak(pick(words, `${seed}:${tag}:${slot}`), slot, breakdown, `${seed}:${tag}:${slot}`);
  });
  // Every template opens with a subject or "The", neither of which is ever replaced.
  return line[0].toUpperCase() + line.slice(1);
}

/**
 * Writes one line per discovery. `breakdown` is how far the tank's compartments had broken apart
 * when the story was released, from 0 to 1: the further, the more of its classifying words are
 * replaced. Stories released before anything broke, and every story from before this existed, keep
 * their words.
 */
export function generateJourneyNarrative(
  discoveries: Array<Pick<Discovery, "artifactId" | "sequence" | "discoveredAt">>,
  exhibitionArtifacts: ExhibitionArtifact[],
  { breakdown = 0 }: { breakdown?: number } = {},
): string[] {
  const artifactMap = new Map(exhibitionArtifacts.map((artifact) => [artifact.id, artifact]));
  const orderedDiscoveries = discoveries
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .filter((discovery) => artifactMap.has(discovery.artifactId));

  if (orderedDiscoveries.length === 0) return ["The fishbowl waits."];

  const route = orderedDiscoveries.map((discovery) => discovery.artifactId).join("|");
  return orderedDiscoveries.flatMap((discovery, position) => {
    const artifact = artifactMap.get(discovery.artifactId);
    return artifact ? [renderSentence(artifact, route, position, breakdown)] : [];
  });
}
