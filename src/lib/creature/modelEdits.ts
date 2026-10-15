import savedModelEdits from "@/data/modelEdits.json";
import type { SavedNodeTransform } from "@/lib/creature/modelOverrides";

/**
 * The creature editor's changes, kept in src/data/modelEdits.json so they travel with every commit,
 * server install and poster export instead of living in one browser. The editor writes the file
 * through /api/development/model-edits during development; everywhere else it is only read.
 */
export const MODEL_EDITS_FILE = "src/data/modelEdits.json";

export const modelEditStores = ["creatures", "plants", "addons", "worldEvents"] as const;
export type ModelEditStore = (typeof modelEditStores)[number];

/** One model's edits, keyed by the mesh's position in the model (`mesh-0`, `mesh-1`, …). */
export type ModelEditGroup = Record<string, SavedNodeTransform>;
export type ModelEdits = Record<ModelEditStore, Record<string, ModelEditGroup>>;

/** Changes to apply: a group's edits to merge in, or null to restore that model to its original. */
export type ModelEditChanges = Partial<Record<ModelEditStore, Record<string, ModelEditGroup | null>>>;

const transformNumbers = ["x", "y", "z", "scaleX", "scaleY", "scaleZ", "rotationX", "rotationY", "rotationZ"] as const;

function isTransform(value: unknown): value is SavedNodeTransform {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    transformNumbers.every((key) => typeof record[key] === "number" && Number.isFinite(record[key])) &&
    (record.hidden === undefined || typeof record.hidden === "boolean")
  );
}

/** The changes in a request body, or the first entry that is not an edit the editor makes. */
export function parseModelEditChanges(value: unknown): { changes: ModelEditChanges } | { error: string } {
  if (!value || typeof value !== "object") return { error: "The body holds no edits." };
  const changes: ModelEditChanges = {};
  for (const [store, groups] of Object.entries(value)) {
    if (!modelEditStores.includes(store as ModelEditStore) || !groups || typeof groups !== "object") {
      return { error: `Unknown store ${store}.` };
    }
    const parsed: Record<string, ModelEditGroup | null> = {};
    for (const [group, edits] of Object.entries(groups)) {
      if (!/^[\w-]+$/.test(group)) return { error: `Invalid model name ${store}.${group}.` };
      if (edits === null) {
        parsed[group] = null;
        continue;
      }
      if (typeof edits !== "object") return { error: `Invalid edits for ${store}.${group}.` };
      const meshes: ModelEditGroup = {};
      for (const [mesh, transform] of Object.entries(edits)) {
        if (!/^mesh-\d+$/.test(mesh) || !isTransform(transform)) return { error: `Invalid edit ${store}.${group}.${mesh}.` };
        // Only the fields the editor writes, so nothing else can slip into the project file.
        const { x, y, z, scaleX, scaleY, scaleZ, rotationX, rotationY, rotationZ, hidden } = transform;
        const saved: SavedNodeTransform = { x, y, z, scaleX, scaleY, scaleZ, rotationX, rotationY, rotationZ };
        meshes[mesh] = hidden ? { ...saved, hidden: true } : saved;
      }
      parsed[group] = meshes;
    }
    changes[store as ModelEditStore] = parsed;
  }
  return { changes };
}

/** Merges changes into the edits, mesh by mesh; a null group restores that model. Changes `edits` in place. */
export function applyModelEditChanges(edits: ModelEdits, changes: ModelEditChanges) {
  for (const store of modelEditStores) {
    for (const [group, meshes] of Object.entries(changes[store] ?? {})) {
      if (meshes === null) delete edits[store][group];
      else edits[store][group] = { ...edits[store][group], ...meshes };
    }
  }
  return edits;
}

const byMeshNumber = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/** The file's text, with models and meshes sorted so saving the same edits twice changes nothing. */
export function formatModelEdits(edits: ModelEdits) {
  const sorted = Object.fromEntries(modelEditStores.map((store) => [
    store,
    Object.fromEntries(Object.keys(edits[store] ?? {}).sort().map((group) => [
      group,
      Object.fromEntries(Object.keys(edits[store][group]).sort(byMeshNumber).map((mesh) => [mesh, edits[store][group][mesh]])),
    ])),
  ]));
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/** The edits this page runs with: the file's, plus any the editor saved since the page loaded. */
const edits = structuredClone(savedModelEdits) as ModelEdits;

export function modelEdits<Store extends ModelEditStore>(store: Store): ModelEdits[Store] {
  return edits[store];
}

/**
 * Saves changes into the project file. They apply on this page at once, so a restored model can be
 * rebuilt straight away; if the file cannot be written, the error says so and a reload drops them.
 */
export async function saveModelEdits(changes: ModelEditChanges) {
  applyModelEditChanges(edits, changes);
  const response = await fetch("/api/development/model-edits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error ?? response.statusText);
  }
}

/**
 * Where the editor kept its changes before they moved into the project file: one browser's
 * localStorage. Whale and dolphin had keys of their own, and only their latest versions were read.
 */
const legacyStorage = {
  creatures: "after-augmented-reality:creature-model-overrides:v1",
  whale: "after-augmented-reality:creature-model-overrides:whale-v3",
  dolphin: "after-augmented-reality:creature-model-overrides:dolphin-v4",
  plants: "after-augmented-reality:plant-model-overrides:v1",
  addons: "after-augmented-reality:addon-model-overrides:v1",
  worldEvents: "after-augmented-reality:world-event-overrides:v1",
} as const;

function readLegacy(key: string): Record<string, ModelEditGroup> {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "null") as unknown;
    return value && typeof value === "object" ? (value as Record<string, ModelEditGroup>) : {};
  } catch {
    return {};
  }
}

/** This browser's edits from before the project file, as the app showed them, or null if it has none. */
export function legacyModelEdits(): ModelEditChanges | null {
  if (typeof window === "undefined") return null;
  const creatures = readLegacy(legacyStorage.creatures);
  // The shared key's whale and dolphin entries were never read once they had keys of their own.
  delete creatures.whale;
  delete creatures.dolphin;
  const whale = readLegacy(legacyStorage.whale);
  const dolphin = readLegacy(legacyStorage.dolphin);
  if (Object.keys(whale).length > 0) creatures.whale = whale as unknown as ModelEditGroup;
  if (Object.keys(dolphin).length > 0) creatures.dolphin = dolphin as unknown as ModelEditGroup;
  const changes: ModelEditChanges = {
    creatures,
    plants: readLegacy(legacyStorage.plants),
    addons: readLegacy(legacyStorage.addons),
    worldEvents: readLegacy(legacyStorage.worldEvents),
  };
  const empty = modelEditStores.every((store) => Object.keys(changes[store] ?? {}).length === 0);
  return empty ? null : changes;
}

/** The legacy edits as text, which compares equal while they stay the same, for useSyncExternalStore. */
export function legacyModelEditsSnapshot() {
  const legacy = legacyModelEdits();
  return legacy ? JSON.stringify(legacy) : "";
}

export function clearLegacyModelEdits() {
  Object.values(legacyStorage).forEach((key) => window.localStorage.removeItem(key));
}
