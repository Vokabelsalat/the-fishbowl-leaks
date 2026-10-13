import { ADDON_MODEL_OVERRIDES_KEY } from "@/lib/creature/addonOverrides";
import { CREATURE_MODEL_OVERRIDES_KEY, DOLPHIN_MODEL_OVERRIDES_KEY, WHALE_MODEL_OVERRIDES_KEY } from "@/lib/creature/modelOverrides";
import { PLANT_MODEL_OVERRIDES_KEY } from "@/lib/creature/plantOverrides";

/** Every store the editors save to, so exports show the creatures, plants and add-ons as edited. */
export const modelOverrideKeys = [
  CREATURE_MODEL_OVERRIDES_KEY,
  WHALE_MODEL_OVERRIDES_KEY,
  DOLPHIN_MODEL_OVERRIDES_KEY,
  PLANT_MODEL_OVERRIDES_KEY,
  ADDON_MODEL_OVERRIDES_KEY,
];

export type ExportedModelOverrides = Record<string, string>;

/** The saved overrides of this browser, as stored, for the headless Chrome that captures exports. */
export function collectModelOverrides(): ExportedModelOverrides {
  const overrides: ExportedModelOverrides = {};
  for (const key of modelOverrideKeys) {
    const value = window.localStorage.getItem(key);
    if (value !== null) overrides[key] = value;
  }
  return overrides;
}

/** Keeps only the known stores, so an export can never write other keys into the page. */
export function parseModelOverrides(value: unknown): ExportedModelOverrides {
  if (!value || typeof value !== "object") return {};
  const overrides: ExportedModelOverrides = {};
  for (const key of modelOverrideKeys) {
    const stored = (value as Record<string, unknown>)[key];
    if (typeof stored === "string") overrides[key] = stored;
  }
  return overrides;
}
