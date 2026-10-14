import { describe, expect, it } from "vitest";
import { makeStore } from "@/store";
import { artifactDetected, feedbackRated, feelingToggled, startJourney } from "@/store/journeySlice";
import {
  JOURNEY_STORAGE_KEY,
  clearJourney,
  loadJourney,
  saveJourney,
  subscribeToJourneyPersistence,
} from "@/store/persistence";
import { creatureColorPalette } from "@/lib/creature/colorPalettes";
import { creaturePattern } from "@/lib/creature/patterns";
import { creatureProportions } from "@/lib/creature/proportions";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("journey persistence", () => {
  it("persists partial ratings and feeling words across reloads", () => {
    const storage = new MemoryStorage();
    const store = makeStore();
    const unsubscribe = subscribeToJourneyPersistence(store, storage);
    store.dispatch(startJourney({ sessionId: "session-rated", startedAt: 10 }));
    store.dispatch(artifactDetected("body-space", 20));
    store.dispatch(feedbackRated({ artifactId: "body-space", dimension: "narrative", rating: 4 }));
    store.dispatch(feelingToggled({ artifactId: "body-space", feeling: "Moved" }));
    unsubscribe();
    expect(loadJourney(storage)?.discoveries[0].feedback).toEqual({ narrative: 4, feelings: ["Moved"] });
  });

  it("keeps discoveries but drops feedback saved under the earlier questionnaire", () => {
    const storage = new MemoryStorage();
    storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify({
      sessionId: "session-legacy",
      startedAt: 10,
      completedAt: null,
      discoveries: [{ artifactId: "body-space", sequence: 1, discoveredAt: 20, feedback: { ludicEntertainment: 2, interaction: null } }],
    }));
    const discoveries = loadJourney(storage)?.discoveries;
    expect(discoveries).toHaveLength(1);
    expect(discoveries?.[0]).not.toHaveProperty("feedback");
  });

  it("round-trips the serializable journey fields", () => {
    const storage = new MemoryStorage();
    const persisted = {
      sessionId: "session-test",
      startedAt: 100,
      completedAt: null,
      creatureForm: "jellyfish" as const,
      creaturePalette: creatureColorPalette("session-test"),
      creaturePattern: creaturePattern("session-test"),
      creatureProportions: creatureProportions("session-test"),
      discoveries: [
        { artifactId: "memory-fragment", sequence: 1, discoveredAt: 200 },
      ],
    };

    saveJourney(storage, persisted);
    expect(loadJourney(storage)).toEqual(persisted);
  });

  it("rejects malformed local data instead of crashing hydration", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({ sessionId: 42, discoveries: "not-an-array" }),
    );

    expect(loadJourney(storage)).toBeNull();
  });

  it("rejects a malformed skin pattern", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({
        sessionId: "session-test",
        startedAt: 100,
        completedAt: null,
        creaturePattern: { kind: "tartan", density: 2, orientation: "along", contrast: 0.5, seed: 1 },
        discoveries: [],
      }),
    );

    expect(loadJourney(storage)).toBeNull();
  });

  it("subscribes to store changes and can clear the saved journey", () => {
    const storage = new MemoryStorage();
    const store = makeStore();
    const unsubscribe = subscribeToJourneyPersistence(store, storage);

    store.dispatch(startJourney({ sessionId: "session-live", startedAt: 10 }));
    store.dispatch(artifactDetected("body-space", 20));
    unsubscribe();

    expect(loadJourney(storage)?.discoveries[0]).toEqual({
      artifactId: "body-space",
      discoveredAt: 20,
      sequence: 1,
    });
    clearJourney(storage);
    expect(loadJourney(storage)).toBeNull();
  });
});
