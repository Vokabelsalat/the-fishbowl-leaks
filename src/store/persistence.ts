import type { AppStore } from "@/store";
import { isAquaticForm } from "@/lib/creature/aquaticForms";
import type { Discovery, PersistedJourney } from "@/store/journeySlice";
import { isCreatureColorPalette } from "@/lib/creature/colorPalettes";
import { isCreaturePattern } from "@/lib/creature/patterns";
import { isCreatureProportions } from "@/lib/creature/proportions";
import { isArtworkFeedback } from "@/lib/evaluation/artworkFeedback";

export const JOURNEY_STORAGE_KEY = "say-hi:journey:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isNarrativeState(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["openness", "memory", "agency", "coherence", "voice"].every(
    (axis) => typeof candidate[axis] === "number" && Number.isFinite(candidate[axis]),
  );
}

function isDiscovery(value: unknown): value is Discovery {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Discovery>;
  return (
    typeof candidate.artifactId === "string" &&
    typeof candidate.sequence === "number" &&
    typeof candidate.discoveredAt === "number" &&
    (candidate.feedback === undefined || isArtworkFeedback(candidate.feedback))
  );
}

export function loadJourney(storage: StorageLike): PersistedJourney | null {
  try {
    const raw = storage.getItem(JOURNEY_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PersistedJourney>;
    const storedCreatureForm = (value as { creatureForm?: unknown }).creatureForm;
    const creatureForm = storedCreatureForm === "eel" ? "ray" : storedCreatureForm;
    const creaturePalette = (value as { creaturePalette?: unknown }).creaturePalette;
    const creaturePattern = (value as { creaturePattern?: unknown }).creaturePattern;
    const creatureProportions = (value as { creatureProportions?: unknown }).creatureProportions;

    if (
      !Array.isArray(value.discoveries) ||
      !value.discoveries.every(isDiscovery) ||
      (value.sessionId !== null && typeof value.sessionId !== "string") ||
      (value.startedAt !== null && typeof value.startedAt !== "number") ||
      (value.completedAt != null && typeof value.completedAt !== "number") ||
      (creatureForm !== undefined && creatureForm !== null && !isAquaticForm(creatureForm)) ||
      (creaturePalette !== undefined && creaturePalette !== null && !isCreatureColorPalette(creaturePalette)) ||
      (creaturePattern !== undefined && creaturePattern !== null && !isCreaturePattern(creaturePattern)) ||
      (creatureProportions !== undefined && creatureProportions !== null && !isCreatureProportions(creatureProportions)) ||
      (value.narrativeState !== undefined && !isNarrativeState(value.narrativeState))
    ) {
      return null;
    }

    return {
      sessionId: value.sessionId ?? null,
      startedAt: value.startedAt ?? null,
      completedAt: value.completedAt ?? null,
      ...(creatureForm ? { creatureForm } : {}),
      ...(creaturePalette ? { creaturePalette } : {}),
      ...(creaturePattern ? { creaturePattern } : {}),
      ...(creatureProportions ? { creatureProportions } : {}),
      ...(value.narrativeState ? { narrativeState: value.narrativeState } : {}),
      discoveries: value.discoveries
        .slice()
        .sort((a, b) => a.sequence - b.sequence),
    };
  } catch {
    return null;
  }
}

export function saveJourney(
  storage: StorageLike,
  journey: PersistedJourney,
) {
  storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(journey));
}

export function clearJourney(storage: StorageLike) {
  storage.removeItem(JOURNEY_STORAGE_KEY);
}

export function subscribeToJourneyPersistence(
  store: AppStore,
  storage: StorageLike,
) {
  let previous = "";
  return store.subscribe(() => {
    const { sessionId, startedAt, completedAt, discoveries, narrativeState, creatureForm, creaturePalette, creaturePattern, creatureProportions } = store.getState().journey;
    if (!sessionId && startedAt === null && discoveries.length === 0) {
      previous = "";
      storage.removeItem(JOURNEY_STORAGE_KEY);
      return;
    }
    const serialized = JSON.stringify({ sessionId, startedAt, completedAt, discoveries, narrativeState, creatureForm, creaturePalette, creaturePattern, creatureProportions });
    if (serialized === previous) return;
    previous = serialized;
    storage.setItem(JOURNEY_STORAGE_KEY, serialized);
  });
}
