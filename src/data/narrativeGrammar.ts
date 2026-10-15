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

/**
 * Words that open a sentence after the first, so the lines read as one passage through the
 * exhibition rather than separate notes. They are grouped by how they tie a sentence to the one
 * before: in time, as its consequence, or against it. Each carries its own punctuation, since short
 * ones like "So" run straight into the sentence. The last sentence of a longer story closes it.
 */
export const sentenceConnectors = {
  time: ["Then,", "Later,", "Meanwhile,", "Soon,", "Further on,", "Afterwards,", "Before long,", "Elsewhere,"],
  cause: ["So", "Because of this,", "As a result,", "And so", "In turn,", "Drawn by it,", "For that reason,", "Stirred by this,"],
  contrast: ["Yet", "Despite this,", "Even so,", "Nevertheless,", "Instead,", "Undeterred,", "In spite of that,", "Still,"],
  closing: ["Finally,", "At last,", "In the end,", "And in the end,"],
} as const;

/**
 * Conjunctions that run a sentence on from the one before, which then ends in a comma instead of a
 * full stop: "…through the kelp forest, until the shell followed…". Grouped like the connectors.
 */
export const clauseJoins = {
  time: ["and then", "until", "and soon", "just as"],
  cause: ["so", "and so", "and because of it"],
  contrast: ["but", "yet", "though"],
  closing: ["until at last", "and in the end"],
} as const;

/**
 * Openings that pick up a word from the sentence before, so the story keeps to one thread: the
 * place it was in, the trace it left, the boundary it passed or the character it met. Only
 * sentences that open with their subject or a character take one.
 */
export const echoConnectors = {
  place: ["There,", "Back in the {place},", "Deeper in the {place},", "Not far from the {place},"],
  trace: ["Drawn by the {trace},", "Following the {trace},", "In the wake of the {trace},", "Where the {trace} had been,"],
  boundary: ["Beyond the {boundary},", "Back at the {boundary},", "Just past the {boundary},"],
  figure: ["Unseen by {figure},", "Long after {figure} had gone,", "Watched by {figure},"],
} as const;

/** The share of sentences after the first that link to the one before; the rest stand on their own. */
export const linkShare = 0.85;
/**
 * How often a linked sentence runs on from the one before, where that reads well, and how often one
 * that does not picks up a word of it; the others open with a connector.
 */
export const joinShare = 0.5;
export const echoShare = 0.4;
/** The share of artworks that add a second sentence; never two artworks in a row. */
export const followUpShare = 0.2;
/** How often a genre's recurring character takes a character slot, rather than one met in passing. */
export const protagonistShare = 0.6;

/** The kinds of link a sentence in the middle of a story can have to the one before it. */
export const middleConnectorKinds = ["time", "cause", "contrast"] as const;

export type PosTag = "NP" | "NN" | "JJ" | "VBD";
/**
 * `subject` and `motion` come from the artwork, so every sentence names the work behind it. The
 * nouns and adjectives come from the story's genre, or for the aquarium genre from the work's
 * exhibition theme. `figure` (a character, NP) and `action` (a transitive verb, VBD) exist only in
 * the other genres. A follow-up sentence can take `REF` slots, which repeat a word its artwork's first
 * sentence used, like {REF:trace}.
 */
export type Slot = "subject" | "motion" | "place" | "boundary" | "trace" | "quality" | "figure" | "action";
export type RefSlot = "place" | "trace" | "boundary" | "figure";

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

/** The genres a visitor's story can be told in; the visitor's session decides which. */
export const narrativeGenreIds = ["aquarium", "myth", "abyss", "swimming", "surfing", "fishing", "pirate"] as const;
export type NarrativeGenreId = (typeof narrativeGenreIds)[number];

type GenreBank = {
  NN: { place: readonly string[]; boundary: readonly string[]; trace: readonly string[] };
  JJ: { quality: readonly string[] };
  NP: { figure: readonly string[] };
  VBD: { action: readonly string[] };
};

export type NarrativeGenre = {
  label: string;
  /** Each template names the artwork's subject; a `{VBD:action}` always takes an object after it. */
  templates: readonly string[];
  /**
   * Second sentences an artwork sometimes adds. They take up a word of its first sentence through a
   * `REF` slot, and at least one needs none, for first sentences without the word asked for.
   */
  followUps: readonly string[];
  /** The genre's own words; the aquarium genre has none and uses the works' exhibition themes. */
  bank: GenreBank | null;
};

/**
 * Every genre stays in the water: the tank's own record, sea myths, deep-sea horror, a swim, a
 * surf session, a fishing trip and a pirate yarn. Slots before a noun take "the", never "a", so leaking words that
 * start with a vowel still read.
 */
export const narrativeGenres: Record<NarrativeGenreId, NarrativeGenre> = {
  aquarium: {
    label: "Aquarium record",
    templates: sentenceTemplates,
    followUps: [
      "The {REF:trace} stayed behind in the {NN:place}.",
      "Nothing behind the {REF:boundary} was quite the same.",
      "The {REF:place} kept that shape a little longer.",
      "Even the {NN:boundary} began to give way.",
    ],
    bank: null,
  },
  myth: {
    label: "Sea myth",
    templates: [
      "{NP:subject} {VBD:motion} into the {JJ:quality} {NN:place}.",
      "{NP:figure} {VBD:action} {NP:subject} beneath the {NN:boundary}.",
      "{NP:subject} {VBD:motion}, and {NP:figure} kept the {NN:trace}.",
      "In the {NN:place}, {NP:figure} {VBD:action} {NP:subject}.",
      "The {NN:trace} of {NP:figure} {VBD:motion} with {NP:subject}.",
    ],
    followUps: [
      "{REF:figure} sang of it for a hundred tides.",
      "Ever since, the {REF:place} has been {JJ:quality}.",
      "The {REF:trace} was never found again.",
      "Some say the {NN:boundary} still remembers it.",
    ],
    bank: {
      NN: {
        place: ["sunken kingdom", "selkie cove", "coral throne room", "moonlit lagoon", "mermaid grotto", "pearl palace", "siren rocks", "kelp cathedral", "tide temple", "whale road"],
        boundary: ["veil of foam", "tide gate", "sea wall", "pearl gate", "moon tide", "coral arch", "edge of the map", "last wave"],
        trace: ["scale", "pearl", "conch song", "sealskin", "trident", "siren's note", "moonstone", "silver comb", "riddle", "wish"],
      },
      JJ: { quality: ["enchanted", "moonlit", "ancient", "shimmering", "pearl-white", "fabled", "spellbound", "hidden", "singing", "sacred"] },
      NP: { figure: ["a selkie", "the sea witch", "a mermaid", "the kraken", "a sea serpent", "the tide queen", "a kelpie", "the old leviathan"] },
      VBD: { action: ["sang to", "bargained with", "enchanted", "summoned", "blessed", "followed", "woke", "crowned"] },
    },
  },
  abyss: {
    label: "Deep-sea horror",
    templates: [
      "{NP:subject} {VBD:motion} toward the {JJ:quality} {NN:place}.",
      "Below the {NN:boundary}, {NP:figure} {VBD:action} {NP:subject}.",
      "{NP:subject} {VBD:motion}; {NP:figure} did not wake.",
      "No one saw {NP:subject} again; only the {NN:trace} remained.",
      "{NP:figure} {VBD:action} {NP:subject} in the {NN:place}.",
    ],
    followUps: [
      "The {REF:place} has been silent ever since.",
      "{REF:figure} is still waiting.",
      "Only the {REF:trace} came back up.",
      "Something stirred behind the {NN:boundary}.",
    ],
    bank: {
      NN: {
        place: ["drowned city", "trench", "sunken temple", "black abyss", "cyclopean ruin", "lightless deep", "flooded crypt", "nameless reef", "abyssal plain", "deep vault"],
        boundary: ["last light", "sealed door", "pressure line", "hull", "tide line", "edge of reason", "old seal", "black water"],
        trace: ["whisper", "sigil", "tentacle", "chant", "eye", "dream", "carving", "slime trail", "bell toll", "idol"],
      },
      JJ: { quality: ["nameless", "eldritch", "cyclopean", "drowned", "lightless", "ancient", "unspeakable", "writhing", "sunken", "dreaming"] },
      NP: { figure: ["something below", "the drowned priest", "an elder thing", "the sleeper", "a pale congregation", "the deep one", "a thousand eyes", "the old one"] },
      VBD: { action: ["dreamt of", "called to", "devoured", "watched", "whispered to", "dragged down", "waited for", "awoke"] },
    },
  },
  swimming: {
    label: "Swim session",
    templates: [
      "{NP:subject} {VBD:motion} down the {JJ:quality} {NN:place}.",
      "{NP:figure} {VBD:action} {NP:subject} to the {NN:boundary}.",
      "{NP:subject} {VBD:motion}, one {JJ:quality} {NN:trace} at a time.",
      "At the {NN:boundary}, {NP:subject} {VBD:motion} and turned.",
      "{NP:subject} {VBD:motion}; {NP:figure} counted every {NN:trace}.",
    ],
    followUps: [
      "{REF:figure} blew the whistle twice.",
      "The {REF:place} went still for a moment.",
      "Every {REF:trace} felt lighter after that.",
      "Somebody cheered from the {NN:boundary}.",
    ],
    bank: {
      NN: {
        place: ["fast lane", "open water", "harbor pool", "deep end", "fjord", "lido", "swim lane", "cold lake", "sea pool", "outdoor pool"],
        boundary: ["lane rope", "pool edge", "buoy line", "turn wall", "starting block", "surface", "shoreline", "floating dock"],
        trace: ["stroke", "breath", "bubble trail", "splash", "goggle mark", "lap", "kick", "ripple", "whistle", "length"],
      },
      JJ: { quality: ["steady", "breathless", "cold", "chlorine-bright", "rhythmic", "tired", "long", "smooth", "salty", "early"] },
      NP: { figure: ["the lifeguard", "a winter swimmer", "the coach", "a lone swimmer", "the relay team", "an old swimmer", "the lane mate", "a diver"] },
      VBD: { action: ["raced", "overtook", "dove after", "swam beside", "paced", "cheered on", "timed", "followed"] },
    },
  },
  surfing: {
    label: "Surf session",
    templates: [
      "{NP:subject} {VBD:motion} through the {JJ:quality} {NN:place}.",
      "{NP:figure} {VBD:action} {NP:subject} at the {NN:boundary}.",
      "{NP:subject} {VBD:motion} over the {NN:boundary}; the {NN:trace} followed.",
      "Out past the {NN:place}, {NP:subject} {VBD:motion}.",
      "{NP:subject} {VBD:motion} on the {JJ:quality} {NN:trace}.",
    ],
    followUps: [
      "The {REF:place} went flat for a while.",
      "{REF:figure} talked about it all evening.",
      "Nobody saw the {REF:trace} coming.",
      "The next set was already building at the {NN:boundary}.",
    ],
    bank: {
      NN: {
        place: ["lineup", "reef break", "point break", "shore break", "barrel", "outside set", "channel", "white water", "beach break", "green face"],
        boundary: ["lip", "impact zone", "shoulder", "wave face", "sandbar", "reef", "foam line", "close-out"],
        trace: ["wax", "spray", "leash", "set wave", "wipeout", "foam", "wake", "swell", "offshore wind", "board"],
      },
      JJ: { quality: ["glassy", "hollow", "heavy", "clean", "choppy", "overhead", "offshore", "peeling", "perfect", "wild"] },
      NP: { figure: ["a longboarder", "the local crew", "a grom", "the old soul surfer", "a bodyboarder", "the shaper", "a beginner", "the surf instructor"] },
      VBD: { action: ["dropped in on", "paddled past", "waited for", "caught", "rode beside", "cheered", "watched", "pushed"] },
    },
  },
  fishing: {
    label: "Fishing tale",
    templates: [
      "{NP:subject} {VBD:motion} past the {JJ:quality} {NN:place}.",
      "{NP:figure} {VBD:action} {NP:subject} by the {NN:boundary}.",
      "{NP:subject} {VBD:motion}; the {NN:trace} came up empty.",
      "At the {NN:place}, {NP:figure} {VBD:action} {NP:subject}.",
      "{NP:subject} {VBD:motion} like the {NN:trace} off the {NN:boundary}.",
    ],
    followUps: [
      "{REF:figure} swore it was the biggest yet.",
      "The {REF:place} smelled of it for days.",
      "That {REF:trace} still hangs in the {NN:place}.",
      "Nobody believed it back at the {NN:place}.",
    ],
    bank: {
      NN: {
        place: ["harbor", "fishing grounds", "trawler deck", "fjord", "jetty", "mooring", "net loft", "fish market", "pier", "herring bank"],
        boundary: ["net", "hook", "gunwale", "jetty edge", "line", "hold", "breakwater", "lobster pot"],
        trace: ["catch", "bait", "float", "reel", "tackle", "gull cry", "fish scale", "knot", "lantern", "tide table"],
      },
      JJ: { quality: ["salt-crusted", "early", "empty", "heavy", "patient", "tangled", "rusted", "foggy", "silver", "lucky"] },
      NP: { figure: ["the old fisherman", "a trawler crew", "the harbor master", "a gull", "the net mender", "a deckhand", "the skipper", "an angler"] },
      VBD: { action: ["hauled in", "baited", "netted", "lost", "landed", "waited for", "released", "reeled in"] },
    },
  },
  pirate: {
    label: "Pirate yarn",
    templates: [
      "{NP:subject} {VBD:motion} across the {JJ:quality} {NN:place}.",
      "{NP:figure} {VBD:action} {NP:subject} off the {NN:boundary}.",
      "{NP:subject} {VBD:motion}; {NP:figure} buried the {NN:trace}.",
      "Under the black flag, {NP:figure} {VBD:action} {NP:subject}.",
      "{NP:subject} {VBD:motion}, and the {NN:trace} led to the {NN:place}.",
    ],
    followUps: [
      "{REF:figure} swore revenge on the spot.",
      "The {REF:trace} was never seen again.",
      "To this day, the {REF:place} is said to be cursed.",
      "Somewhere off the {NN:boundary}, a cannon answered.",
    ],
    bank: {
      NN: {
        place: ["Spanish Main", "smugglers' cove", "skull island", "crow's nest", "captain's cabin", "shipwreck reef", "treasure isle", "galleon hold", "trade winds", "lagoon"],
        boundary: ["plank", "gangway", "ship's rail", "anchor chain", "rigging", "reef", "harbor boom", "port side"],
        trace: ["treasure map", "doubloon", "parrot's squawk", "spyglass", "compass", "cutlass", "message in a bottle", "jolly roger", "sea shanty", "gold chest"],
      },
      JJ: { quality: ["cursed", "rum-soaked", "stormy", "plundered", "barnacled", "golden", "mutinous", "smuggled", "salt-crusted", "forbidden"] },
      NP: { figure: ["the one-eyed captain", "a mutinous crew", "the quartermaster", "a cabin boy", "the ghost ship", "a parrot", "the navy frigate", "a stowaway"] },
      VBD: { action: ["plundered", "boarded", "marooned", "chased", "hid", "buried", "made off with", "fired upon"] },
    },
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

export type LeakingSlot = Exclude<Slot, "subject">;

/**
 * Words that take over from the tank's classifying vocabulary once its compartments break apart.
 * A replaced word stays visible, crossed out, in front of its replacement.
 */
export const leakBanks: Record<LeakingSlot, readonly string[]> = {
  boundary: ["crack", "breach", "open seam", "torn net", "gap", "spill", "burst wall", "missing pane"],
  quality: ["leaking", "unsorted", "unlabelled", "spilling", "porous", "unclassified", "loose", "overflowing"],
  place: ["open water", "spillway", "overflow", "unmapped current", "flood", "open sea", "runoff", "outflow"],
  trace: ["drift", "spill", "loose label", "stray signal", "runoff", "seep", "torn tag", "escaped sample"],
  motion: ["leaked", "spilled", "seeped", "escaped", "overflowed", "slipped", "dissolved", "drifted loose"],
  figure: ["a stray creature", "an escaped specimen", "something unlabelled", "a loose shape", "an unnamed thing", "a runaway sample"],
  action: ["spilled", "lost", "let slip", "leaked", "released", "dropped", "freed", "unsorted"],
};

/**
 * How readily each kind of word gives way as the tank breaks down: the walls go first, then the
 * labels describing things, the places and traces, and finally how things move. The artworks'
 * own subjects are never replaced.
 */
export const leakReadiness: Record<LeakingSlot, number> = {
  boundary: 1,
  quality: 0.85,
  place: 0.65,
  trace: 0.5,
  action: 0.4,
  motion: 0.35,
  figure: 0.3,
};
