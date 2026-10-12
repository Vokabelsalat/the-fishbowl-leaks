import type { ThemeId } from "@/types/exhibition";

type NarrativeTheme = ThemeId | "language";

// Exhibition.csv themes are deliberately kept separate from the app's visual
// theme assignments, which group some works differently for the creature art.
export const exhibitionNarrativeThemes: Record<string, NarrativeTheme> = {
  "finding-frida": "memory",
  "historically-yours": "interface",
  "from-ingrid-to-bergen": "memory",
  "your-update-has-failed": "interface",
  "grand-hotel-bald-cockatoo": "worldmaking",
  "glass-like-fabric": "language",
  "between-page-and-screen": "language",
  "bybanen-slop-surfer": "interface",
  emperor: "embodiment",
  "grand-hotel-galactic-center": "worldmaking",
  "her-name-was-gisberta": "embodiment",
  goliath: "embodiment",
  "land-of-crystals": "memory",
  "grand-hotel-sand-fountain": "memory",
  "fiery-sparks-of-light": "language",
  "fishbowl-leaks": "agency",
  "realidad-mitigada": "language",
  "earth-fortunes": "worldmaking",
};

/**
 * Sentence slots use POS tags: NP (noun phrase), NN (singular noun),
 * JJ (adjective), and VBD (past-tense verb). A slot like {NN:place}
 * draws only from its tagged bank. These curated words are adapted from
 * marine-associations.md and the descriptions in public/exhibition.csv.
 */
export const sentenceTemplates = [
  "{NP:subject} {VBD:motion} through the {NN:place}.",
  "The {NN:trace} followed {NP:subject} past the {NN:boundary}.",
  "{NP:subject} {VBD:motion}; the {NN:trace} remained.",
  "{NP:subject} {VBD:motion} beside the {JJ:quality} {NN:trace}.",
  "{NP:subject} {VBD:motion} beneath the {JJ:quality} {NN:place}.",
] as const;

export type PosTag = "NP" | "NN" | "JJ" | "VBD";
export type Slot = "subject" | "motion" | "place" | "boundary" | "trace" | "quality";

type ThemeBank = {
  NN: { place: readonly string[]; boundary: readonly string[]; trace: readonly string[] };
  JJ: { quality: readonly string[] };
};

// Marine places, containers, signals, memory traces, and textures. The themes
// limit substitutions so a line stays close to the work that prompted it.
export const themeBanks: Record<NarrativeTheme, ThemeBank> = {
  memory: {
    NN: {
      place: ["kelp forest", "tidal archive", "seabed", "estuary", "coral reef", "tide pool", "shipwreck", "silt", "fjord", "shoreline"],
      boundary: ["waterline", "glass wall", "reef edge", "harbor wall", "tide gate", "tank seam", "shoreline", "net"],
      trace: ["shell", "growth ring", "photograph", "echo", "sediment", "current", "fossil", "tidemark", "whisper", "salt stain"],
    },
    JJ: { quality: ["salt-worn", "distant", "buried", "patient", "silver", "fading", "tangled", "quiet", "weathered", "submerged"] },
  },
  interface: {
    NN: {
      place: ["aquarium", "brine pool", "shipping lane", "seabed", "tidal gate", "current", "harbor", "reef", "twilight zone", "channel"],
      boundary: ["glass wall", "tank seam", "net", "waterline", "filter", "membrane", "harbor wall", "cage"],
      trace: ["signal", "glitch", "sample", "label", "pulse", "beacon", "pixel", "echo", "bubble", "wake"],
    },
    JJ: { quality: ["synthetic", "restless", "broken", "bright", "coded", "salt-stung", "false", "flickering", "blurred", "sealed"] },
  },
  language: {
    NN: {
      place: ["glass page", "tidal archive", "seabed", "reef", "water", "current", "harbor", "tide pool", "shoreline", "lagoon"],
      boundary: ["page edge", "glass wall", "waterline", "membrane", "tank seam", "net", "screen", "shoreline"],
      trace: ["letter", "verse", "contour", "syllable", "echo", "mark", "signal", "subtitle", "whisper", "ink cloud"],
    },
    JJ: { quality: ["printed", "salt-worn", "folded", "quiet", "flickering", "coded", "shifting", "bright", "loose", "submerged"] },
  },
  worldmaking: {
    NN: {
      place: ["lagoon", "open ocean", "coral reef", "abyss", "kelp forest", "atoll", "tide pool", "seamount", "deep", "current"],
      boundary: ["glass wall", "reef edge", "horizon", "waterline", "tank seam", "shoreline", "shell", "net"],
      trace: ["dream", "spark", "star", "bubble", "shell", "shadow", "ripple", "fortune", "glimmer", "wake"],
    },
    JJ: { quality: ["dreaming", "luminous", "strange", "bright", "silver", "hollow", "wandering", "glittering", "deep", "restless"] },
  },
  embodiment: {
    NN: {
      place: ["reef", "deep", "current", "shoreline", "seabed", "kelp forest", "tide pool", "open ocean", "water", "lagoon"],
      boundary: ["glass wall", "net", "cage", "waterline", "reef edge", "shell", "tank seam", "shoreline"],
      trace: ["voice", "heartbeat", "whisper", "breath", "signal", "scar", "echo", "pulse", "glimmer", "current"],
    },
    JJ: { quality: ["living", "tender", "resistant", "quiet", "warm", "whole", "restless", "stubborn", "silver", "shared"] },
  },
  agency: {
    NN: {
      place: ["open ocean", "estuary", "current", "reef", "harbor", "lagoon", "seabed", "tidal gate", "water", "shoreline"],
      boundary: ["glass wall", "net", "cage", "tank seam", "waterline", "harbor wall", "filter", "shoreline"],
      trace: ["route", "wake", "signal", "footprint", "bubble", "spark", "current", "ripple", "mark", "whisper"],
    },
    JJ: { quality: ["restless", "wide", "salt-worn", "bright", "shifting", "wild", "shared", "stubborn", "tidal", "new"] },
  },
};

type ArtworkBank = { NP: { subject: readonly string[] }; VBD: { motion: readonly string[] } };

// Distinctive motifs and actions for every exhibition.csv work. Each subject
// remains an authored phrase; only grammatical equivalents replace it.
export const artworkBanks: Record<string, ArtworkBank> = {
  "finding-frida": { NP: { subject: ["Frida's villa", "a woven photograph", "the garden portrait", "Frida's tapestry"] }, VBD: { motion: ["resurfaced", "took root", "unfurled", "returned"] } },
  "historically-yours": { NP: { subject: ["an underworld broadcast", "Cleo's voice", "the live transcript", "a synthetic host"] }, VBD: { motion: ["answered", "echoed", "drifted", "resurfaced"] } },
  "from-ingrid-to-bergen": { NP: { subject: ["Ingrid's archive", "a nineteen-year memory", "a photograph of Ingrid", "a grieving letter"] }, VBD: { motion: ["returned", "drifted", "resurfaced", "endured"] } },
  "your-update-has-failed": { NP: { subject: ["the failed update", "a coercive program", "a false correction", "the stubborn glitch"] }, VBD: { motion: ["failed", "cracked", "dissolved", "stalled"] } },
  "grand-hotel-bald-cockatoo": { NP: { subject: ["the fortune-telling cockatoo", "a printed fortune", "the dream hotel", "a nest of stories"] }, VBD: { motion: ["fluttered", "drifted", "unfurled", "escaped"] } },
  "glass-like-fabric": { NP: { subject: ["a scanned surface", "the glass diagram", "a red contour", "a folded wall"] }, VBD: { motion: ["fractured", "folded", "shimmered", "shifted"] } },
  "between-page-and-screen": { NP: { subject: ["P's letter", "S's reply", "the wordless book", "a printed pattern"] }, VBD: { motion: ["answered", "surfaced", "fluttered", "shifted"] } },
  "bybanen-slop-surfer": { NP: { subject: ["the copied Bergen", "a slop surfer", "the flattened city", "an algorithmic wave"] }, VBD: { motion: ["looped", "slipped", "fractured", "surged"] } },
  emperor: { NP: { subject: ["the father's lost word", "his daughter's drawing", "a hand-drawn thought", "the quiet syllable"] }, VBD: { motion: ["drifted", "returned", "surfaced", "flickered"] } },
  "grand-hotel-galactic-center": { NP: { subject: ["the looping stars", "a cheap hotel room", "the galactic hotel", "a flickering cloud"] }, VBD: { motion: ["flickered", "looped", "drifted", "dimmed"] } },
  "her-name-was-gisberta": { NP: { subject: ["Gisberta's name", "a memorial light", "the act of witness", "her remembered voice"] }, VBD: { motion: ["endured", "resurfaced", "shone", "remained"] } },
  goliath: { NP: { subject: ["Goliath's signal", "a multiplayer world", "a shared game", "the isolated player"] }, VBD: { motion: ["connected", "opened", "resurfaced", "gathered"] } },
  "land-of-crystals": { NP: { subject: ["Munch's vanished house", "an Ekely photograph", "the crystal panorama", "an archival image"] }, VBD: { motion: ["reappeared", "glimmered", "resurfaced", "shifted"] } },
  "grand-hotel-sand-fountain": { NP: { subject: ["the sand hotel", "a haunted object", "a borrowed memory", "the collage fountain"] }, VBD: { motion: ["shifted", "drifted", "returned", "dissolved"] } },
  "fiery-sparks-of-light": { NP: { subject: ["a poet's hologram", "a printed poem", "a volumetric voice", "the book's QR spark"] }, VBD: { motion: ["flared", "shimmered", "surfaced", "glowed"] } },
  "fishbowl-leaks": { NP: { subject: ["the porous fishbowl", "a visitor's creature", "the shared aquarium", "a loose species"] }, VBD: { motion: ["leaked", "escaped", "overflowed", "reassembled"] } },
  "realidad-mitigada": { NP: { subject: ["a resistant poem", "the marked barcode", "a hybrid book", "an augmented verse"] }, VBD: { motion: ["resisted", "shifted", "surfaced", "glitched"] } },
  "earth-fortunes": { NP: { subject: ["a climate tarot card", "the future forecast", "an energy reading", "the fortune teller's card"] }, VBD: { motion: ["turned", "surfaced", "shifted", "flickered"] } },
};
