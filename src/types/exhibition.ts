export type ThemeId =
  | "memory"
  | "interface"
  | "worldmaking"
  | "embodiment"
  | "agency";

export const particleFormIds = [
  "torus",
  "triad",
  "tree",
  "cuboid",
  "crest",
  "prism",
  "book",
  "skateboard",
  "brain",
  "galaxy",
  "pillar",
  "butterfly",
  "dodecahedron",
  "crystal",
  "hourglass",
  "spiral",
  "fish",
  "crescent",
] as const;

export type ParticleFormId = (typeof particleFormIds)[number];

export type CreaturePartId =
  | "memory-crown"
  | "archive-ears"
  | "route-tail"
  | "signal-antenna"
  | "cockatoo-beak"
  | "glass-wings"
  | "page-fins"
  | "surfer-feet"
  | "inner-eye"
  | "orbit-ring"
  | "heart-plume"
  | "helping-arms"
  | "goliath-horns"
  | "crystal-spines"
  | "sand-hourglass"
  | "spark-plume"
  | "barcode-fin"
  | "fortune-cards";

export type CreaturePart = {
  id: CreaturePartId;
  label: string;
  description: string;
};

export type NarrativeAxis =
  | "openness"
  | "memory"
  | "agency"
  | "coherence"
  | "voice";

export type NarrativeState = Record<NarrativeAxis, number>;

export type ArtifactChoice = {
  prompt: string;
  options: [
    { id: string; label: string; effects: Partial<NarrativeState> },
    { id: string; label: string; effects: Partial<NarrativeState> },
  ];
};

export type ExhibitionArtifact = {
  id: string;
  /** The `ID` column of public/exhibition.csv. */
  exhibitionId: number;
  targetIndex: number;
  posterImageSrc: `/images/${string}`;
  title: string;
  artist: string;
  theme: ThemeId;
  particleForm: ParticleFormId;
  color: string;
  /** Foreground color used when the constellation is shown on white. */
  alternativeColor: string;
  /** The full exhibition text; paragraphs are separated by a blank line. */
  description: string;
  /** Kinds of work, e.g. "Augmented Reality" or "Work in progress". */
  workType: string[];
  year: number;
  /** Software, services and materials the artists name. */
  platforms: string[];
  technicalDetails?: string;
  links: string[];
  narrativeWords: string[];
  creaturePart: CreaturePart;
  marineType: string;
  classification: string;
  visualTraits: string[];
  stateEffects: Partial<NarrativeState>;
  storylet: string;
  choice: ArtifactChoice;
};

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  color: string;
  description: string;
};
