import type { ExhibitionArtifact } from "@/types/exhibition";
import type { Discovery } from "@/store/journeySlice";
import { artworkBanks, connectorShare, exhibitionNarrativeThemes, leakBanks, leakReadiness, middleConnectorKinds, sentenceConnectors, sentenceTemplates, themeBanks, type PosTag, type Slot } from "@/data/narrativeGrammar";

type ConnectorKind = (typeof middleConnectorKinds)[number];
type Connector = { kind: ConnectorKind | "closing"; words: string };
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

function renderSentence(artifact: ExhibitionArtifact, route: string, position: number, breakdown: number, connector: Connector | null) {
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
  // Every template opens with a subject or "The", neither of which is ever replaced. After a
  // connector, "The" turns lower case; subjects keep their own case, since some are names.
  if (connector) return `${connector.words} ${line.startsWith("The ") ? `the${line.slice(3)}` : line}`;
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
  let previousConnector: Connector | null = null;
  return orderedDiscoveries.flatMap((discovery, position) => {
    const artifact = artifactMap.get(discovery.artifactId);
    if (!artifact) return [];
    const connector = connectorFor(route, position, orderedDiscoveries.length, previousConnector);
    // A sentence without a connector leaves the last one standing, so the next still links differently.
    if (connector) previousConnector = connector;
    return [renderSentence(artifact, route, position, breakdown, connector)];
  });
}
