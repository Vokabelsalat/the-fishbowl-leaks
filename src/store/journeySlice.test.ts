import { describe, expect, it } from "vitest";
import {
  artifactCollected,
  artifactDetected,
  artifactRevisited,
  feedbackRated,
  hydrateJourney,
  journeyReducer,
  journeyReleased,
  resetJourney,
  setActiveArtifact,
  startJourney,
} from "@/store/journeySlice";
import { creatureColorPalette } from "@/lib/creature/colorPalettes";

describe("journeySlice", () => {
  it("keeps ratings per artwork, permits revisions, and does not change the narrative", () => {
    let state = journeyReducer(undefined, artifactDetected("memory-fragment", 100));
    state = journeyReducer(state, artifactDetected("body-space", 200));
    const narrative = state.narrativeState;
    state = journeyReducer(state, feedbackRated({ artifactId: "memory-fragment", dimension: "narrative", rating: 4 }));
    state = journeyReducer(state, feedbackRated({ artifactId: "memory-fragment", dimension: "interaction", rating: null }));
    state = journeyReducer(state, feedbackRated({ artifactId: "body-space", dimension: "narrative", rating: 2 }));
    state = journeyReducer(state, artifactRevisited("memory-fragment"));
    state = journeyReducer(state, feedbackRated({ artifactId: "memory-fragment", dimension: "narrative", rating: 5 }));
    expect(state.discoveries[0].feedback).toEqual({ narrative: 5, interaction: null });
    expect(state.discoveries[1].feedback).toEqual({ narrative: 2 });
    expect(state.discoveries).toHaveLength(2);
    expect(state.narrativeState).toEqual(narrative);
    const unchanged = journeyReducer(state, feedbackRated({ artifactId: "unscanned", dimension: "interaction", rating: 3 }));
    expect(unchanged).toEqual(state);
  });

  it("starts a reproducible journey session", () => {
    const state = journeyReducer(
      undefined,
      startJourney({ sessionId: "session-test", startedAt: 100 }),
    );

    expect(state).toMatchObject({
      sessionId: "session-test",
      startedAt: 100,
      experiencePhase: "scanning",
      discoveries: [],
    });
  });

  it("starts without a specimen", () => {
    const state = journeyReducer(
      undefined,
      startJourney({ sessionId: "session-test", startedAt: 100 }),
    );

    expect(state).toMatchObject({
      creatureForm: null,
      creaturePalette: null,
      creaturePattern: null,
      creatureProportions: null,
    });
  });

  it("discovers artifacts in order", () => {
    let state = journeyReducer(
      undefined,
      startJourney({ sessionId: "session-test", startedAt: 100 }),
    );
    state = journeyReducer(state, artifactDetected("machine-voice", 200));
    state = journeyReducer(state, artifactDetected("body-space", 300));

    expect(state.discoveries).toEqual([
      { artifactId: "machine-voice", discoveredAt: 200, sequence: 1 },
      { artifactId: "body-space", discoveredAt: 300, sequence: 2 },
    ]);
    expect(state.activeArtifactId).toBe("body-space");
    expect(state.experiencePhase).toBe("revealing");
    expect(state.creatureForm).not.toBeNull();
  });

  it("gives the specimen on the first scan and keeps it through later scans", () => {
    let state = journeyReducer(
      undefined,
      startJourney({ sessionId: "session-creature", startedAt: 100 }),
    );
    state = journeyReducer(state, artifactDetected("first-work", 200));
    const specimen = {
      creatureForm: state.creatureForm,
      creaturePalette: state.creaturePalette,
      creaturePattern: state.creaturePattern,
      creatureProportions: state.creatureProportions,
    };
    state = journeyReducer(state, artifactDetected("second-work", 300));

    expect(specimen.creatureForm).not.toBeNull();
    expect(specimen.creaturePalette).toEqual(creatureColorPalette("session-creature"));
    expect(specimen.creaturePattern).not.toBeNull();
    expect(specimen.creatureProportions).not.toBeNull();
    expect(state).toMatchObject(specimen);
  });

  it("restores a saved journey without scans without a specimen", () => {
    const state = journeyReducer(
      undefined,
      hydrateJourney({
        sessionId: "session-saved",
        startedAt: 100,
        completedAt: null,
        discoveries: [],
        creatureForm: "whale",
      }),
    );

    expect(state.creatureForm).toBeNull();
    expect(state.creaturePattern).toBeNull();
  });

  it("restores the saved specimen of a journey with scans", () => {
    const state = journeyReducer(
      undefined,
      hydrateJourney({
        sessionId: "session-saved",
        startedAt: 100,
        completedAt: null,
        discoveries: [{ artifactId: "memory-fragment", sequence: 1, discoveredAt: 200 }],
        creatureForm: "whale",
      }),
    );

    expect(state.creatureForm).toBe("whale");
    expect(state.creaturePalette).toEqual(creatureColorPalette("session-saved"));
  });

  it("lets a scan shape the narrative without requiring a choice", () => {
    const state = journeyReducer(
      undefined,
      artifactDetected("grand-hotel-bald-cockatoo", 200),
    );

    expect(state.discoveries[0]).not.toHaveProperty("choiceId");
    expect(state.narrativeState).toMatchObject({
      openness: 2,
      coherence: -2,
      voice: 1,
    });
  });

  it("ignores duplicate scans without changing sequence or active state", () => {
    let state = journeyReducer(undefined, artifactDetected("memory-fragment", 100));
    state = journeyReducer(state, artifactCollected("memory-fragment"));
    state = journeyReducer(state, setActiveArtifact(null));
    state = journeyReducer(state, artifactDetected("memory-fragment", 999));

    expect(state.discoveries).toEqual([
      { artifactId: "memory-fragment", discoveredAt: 100, sequence: 1 },
    ]);
    expect(state.activeArtifactId).toBeNull();
  });

  it("reopens a discovered artifact without adding another discovery", () => {
    let state = journeyReducer(undefined, artifactDetected("memory-fragment", 100));
    state = journeyReducer(state, artifactCollected("memory-fragment"));
    state = journeyReducer(state, setActiveArtifact(null));
    state = journeyReducer(state, artifactRevisited("memory-fragment"));

    expect(state.discoveries).toEqual([
      { artifactId: "memory-fragment", discoveredAt: 100, sequence: 1 },
    ]);
    expect(state.activeArtifactId).toBe("memory-fragment");
    expect(state.experiencePhase).toBe("revealing");
  });

  it("resets all persistent and transient journey data", () => {
    const discovered = journeyReducer(
      undefined,
      artifactDetected("memory-fragment", 100),
    );
    const reset = journeyReducer(discovered, resetJourney());

    expect(reset).toMatchObject({
      sessionId: null,
      startedAt: null,
      completedAt: null,
      discoveries: [],
      activeArtifactId: null,
      experiencePhase: "intro",
      creatureForm: null,
      creaturePalette: null,
    });
  });

  it("ends the journey when the creature is released, and collects nothing after", () => {
    let state = journeyReducer(undefined, artifactDetected("memory-fragment", 100));
    state = journeyReducer(state, journeyReleased(1_500));

    expect(state.completedAt).toBe(1_500);
    expect(state.released).toBe(true);
    expect(state.experiencePhase).toBe("ending");
    expect(journeyReducer(state, artifactDetected("body-space", 2_000)).discoveries).toHaveLength(1);
  });

  it("keeps a release across a reload", () => {
    const state = journeyReducer(undefined, hydrateJourney({
      sessionId: "session-released",
      startedAt: 10,
      completedAt: 1_500,
      released: true,
      discoveries: [{ artifactId: "memory-fragment", sequence: 1, discoveredAt: 100 }],
    }));

    expect(state.released).toBe(true);
  });
});
