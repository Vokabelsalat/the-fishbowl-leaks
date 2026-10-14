import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { artifactById } from "@/data/artifacts";
import { pickAquaticForm, type AquaticForm } from "@/lib/creature/aquaticForms";
import { creatureColorPalette, type CreatureColorPalette } from "@/lib/creature/colorPalettes";
import { creaturePattern, type CreaturePattern } from "@/lib/creature/patterns";
import { creatureProportions, type CreatureProportions } from "@/lib/creature/proportions";
import type { NarrativeState } from "@/types/exhibition";
import {
  isFeedbackRating,
  isFeelingWord,
  MAX_FEELINGS,
  type ArtworkFeedback,
  type FeedbackDimension,
  type FeedbackRating,
  type FeelingWord,
} from "@/lib/evaluation/artworkFeedback";

export type ExperiencePhase =
  | "intro"
  | "scanning"
  | "revealing"
  | "content"
  | "ending";

export type Discovery = {
  artifactId: string;
  sequence: number;
  discoveredAt: number;
  choiceId?: string;
  feedback?: ArtworkFeedback;
};

export type JourneyState = {
  sessionId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  discoveries: Discovery[];
  activeArtifactId: string | null;
  experiencePhase: ExperiencePhase;
  narrativeState: NarrativeState;
  creatureForm: AquaticForm | null;
  creaturePalette: CreatureColorPalette | null;
  creaturePattern: CreaturePattern | null;
  creatureProportions: CreatureProportions | null;
  /** The creature has been released into the shared tank, which closes the journey; `completedAt` is when. */
  released: boolean;
  /**
   * Whether the shared tank has become the open sea, so the visitor's specimen may be an open-sea
   * form like a whale. Asked of the server on every visit, so it is never saved with the journey.
   */
  openSea: boolean;
};

export type PersistedJourney = Pick<
  JourneyState,
  "sessionId" | "startedAt" | "completedAt" | "discoveries"
> & {
  released?: boolean;
  narrativeState?: NarrativeState;
  creatureForm?: AquaticForm | null;
  creaturePalette?: CreatureColorPalette | null;
  creaturePattern?: CreaturePattern | null;
  creatureProportions?: CreatureProportions | null;
};

export const neutralNarrativeState: NarrativeState = {
  openness: 0,
  memory: 0,
  agency: 0,
  coherence: 0,
  voice: 0,
};

export const initialJourneyState: JourneyState = {
  sessionId: null,
  startedAt: null,
  completedAt: null,
  discoveries: [],
  activeArtifactId: null,
  experiencePhase: "intro",
  narrativeState: { ...neutralNarrativeState },
  creatureForm: null,
  creaturePalette: null,
  creaturePattern: null,
  creatureProportions: null,
  released: false,
  openSea: false,
};

/** Draws the visitor's specimen: its form, colours, skin pattern and body proportions. */
function giveSpecimen(state: JourneyState, seed: string) {
  state.creatureForm = pickAquaticForm(seed, { openSea: state.openSea });
  state.creaturePalette = creatureColorPalette(seed);
  state.creaturePattern = creaturePattern(seed);
  state.creatureProportions = creatureProportions(seed);
}

function makeSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `say-hi-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const journeySlice = createSlice({
  name: "journey",
  initialState: initialJourneyState,
  reducers: {
    startJourney: {
      reducer(
        state,
        action: PayloadAction<{ sessionId: string; startedAt: number }>,
      ) {
        if (!state.sessionId) {
          state.sessionId = action.payload.sessionId;
          state.startedAt = action.payload.startedAt;
        }
        // Visitors start without a specimen; the first scan gives them one.
        state.activeArtifactId = null;
        state.completedAt = null;
        state.experiencePhase = "scanning";
      },
      prepare(payload?: { sessionId: string; startedAt: number }) {
        return {
          payload: payload ?? {
            sessionId: makeSessionId(),
            startedAt: Date.now(),
          },
        };
      },
    },
    artifactDetected: {
      reducer(
        state,
        action: PayloadAction<{ artifactId: string; discoveredAt: number }>,
      ) {
        const { artifactId, discoveredAt } = action.payload;
        const alreadyDiscovered = state.discoveries.some(
          (discovery) => discovery.artifactId === artifactId,
        );

        // A released creature is final, so nothing more is collected.
        if (alreadyDiscovered || state.released) return;

        if (!state.creatureForm) giveSpecimen(state, state.sessionId ?? "anonymous");

        state.discoveries.push({
          artifactId,
          discoveredAt,
          sequence: state.discoveries.length + 1,
        });
        const artifact = artifactById.get(artifactId);
        if (artifact) {
          (Object.keys(artifact.stateEffects) as Array<keyof NarrativeState>).forEach(
            (axis) => {
              state.narrativeState[axis] = Math.max(
                -8,
                Math.min(
                  8,
                  state.narrativeState[axis] + (artifact.stateEffects[axis] ?? 0),
                ),
              );
            },
          );
        }
        state.completedAt = null;
        state.activeArtifactId = artifactId;
        state.experiencePhase = "revealing";
      },
      prepare(artifactId: string, discoveredAt = Date.now()) {
        return { payload: { artifactId, discoveredAt } };
      },
    },
    artifactCollected(state, action: PayloadAction<string>) {
      if (state.activeArtifactId === action.payload) {
        state.experiencePhase = "content";
      }
    },
    artifactRevisited(state, action: PayloadAction<string>) {
      const wasDiscovered = state.discoveries.some(
        (discovery) => discovery.artifactId === action.payload,
      );
      if (!wasDiscovered) return;
      state.activeArtifactId = action.payload;
      state.experiencePhase = "revealing";
    },
    choiceMade(
      state,
      action: PayloadAction<{
        artifactId: string;
        choiceId: string;
        effects: Partial<NarrativeState>;
      }>,
    ) {
      const discovery = state.discoveries.find(
        (item) => item.artifactId === action.payload.artifactId,
      );
      if (!discovery || discovery.choiceId) return;
      discovery.choiceId = action.payload.choiceId;
      (Object.keys(action.payload.effects) as Array<keyof NarrativeState>).forEach(
        (axis) => {
          state.narrativeState[axis] = Math.max(
            -8,
            Math.min(8, state.narrativeState[axis] + (action.payload.effects[axis] ?? 0)),
          );
        },
      );
    },
    feedbackRated(
      state,
      action: PayloadAction<{ artifactId: string; dimension: FeedbackDimension; rating: FeedbackRating }>,
    ) {
      const { artifactId, dimension, rating } = action.payload;
      const discovery = state.discoveries.find((item) => item.artifactId === artifactId);
      if (!discovery || !isFeedbackRating(rating)) return;
      discovery.feedback = { ...discovery.feedback, [dimension]: rating };
    },
    feelingToggled(state, action: PayloadAction<{ artifactId: string; feeling: FeelingWord }>) {
      const { artifactId, feeling } = action.payload;
      const discovery = state.discoveries.find((item) => item.artifactId === artifactId);
      if (!discovery || !isFeelingWord(feeling)) return;
      const feelings = discovery.feedback?.feelings ?? [];
      if (feelings.includes(feeling)) {
        discovery.feedback = { ...discovery.feedback, feelings: feelings.filter((word) => word !== feeling) };
      } else if (feelings.length < MAX_FEELINGS) {
        discovery.feedback = { ...discovery.feedback, feelings: [...feelings, feeling] };
      }
    },
    setActiveArtifact(state, action: PayloadAction<string | null>) {
      state.activeArtifactId = action.payload;
    },
    setExperiencePhase(state, action: PayloadAction<ExperiencePhase>) {
      state.experiencePhase = action.payload;
      if (action.payload === "scanning") state.completedAt = null;
    },
    /** The creature reached the shared tank; the journey ends at the moment it was sent. */
    journeyReleased(state, action: PayloadAction<number>) {
      state.completedAt = action.payload;
      state.released = true;
      state.experiencePhase = "ending";
    },
    hydrateJourney(state, action: PayloadAction<PersistedJourney>) {
      state.sessionId = action.payload.sessionId;
      state.startedAt = action.payload.startedAt;
      state.completedAt = action.payload.completedAt;
      state.released = action.payload.released ?? false;
      state.discoveries = action.payload.discoveries;
      state.narrativeState = { ...(action.payload.narrativeState ?? neutralNarrativeState) };
      // A specimen exists only once something was scanned; keep the saved one, or draw it again.
      if (action.payload.discoveries.length === 0) {
        state.creatureForm = null;
        state.creaturePalette = null;
        state.creaturePattern = null;
        state.creatureProportions = null;
      } else {
        const seed = action.payload.sessionId ?? "anonymous";
        state.creatureForm = action.payload.creatureForm ?? pickAquaticForm(seed, { openSea: state.openSea });
        state.creaturePalette = action.payload.creaturePalette ?? creatureColorPalette(seed);
        state.creaturePattern = action.payload.creaturePattern ?? creaturePattern(seed);
        state.creatureProportions = action.payload.creatureProportions ?? creatureProportions(seed);
      }
      state.activeArtifactId = null;
      state.experiencePhase = action.payload.sessionId ? "scanning" : "intro";
    },
    resetJourney(state) {
      return { ...initialJourneyState, openSea: state.openSea };
    },
    openSeaChanged(state, action: PayloadAction<boolean>) {
      state.openSea = action.payload;
    },
  },
});

export const {
  artifactCollected,
  artifactDetected,
  artifactRevisited,
  choiceMade,
  feedbackRated,
  feelingToggled,
  hydrateJourney,
  resetJourney,
  openSeaChanged,
  journeyReleased,
  setActiveArtifact,
  setExperiencePhase,
  startJourney,
} = journeySlice.actions;

export const journeyReducer = journeySlice.reducer;
