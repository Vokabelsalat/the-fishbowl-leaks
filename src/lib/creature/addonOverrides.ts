import * as THREE from "three";
import type { SavedNodeTransform } from "@/lib/creature/modelOverrides";
import type { CreaturePartId } from "@/types/exhibition";

export const ADDON_MODEL_OVERRIDES_KEY = "after-augmented-reality:addon-model-overrides:v1";

export type AddonModelOverrides = Partial<Record<CreaturePartId, Record<string, SavedNodeTransform>>>;

export function loadAddonModelOverrides(): AddonModelOverrides {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(ADDON_MODEL_OVERRIDES_KEY) ?? "{}") as AddonModelOverrides;
  } catch {
    return {};
  }
}

export function saveAddonModelOverrides(partId: CreaturePartId, changes: Record<string, SavedNodeTransform>) {
  const current = loadAddonModelOverrides();
  const next = { ...current, [partId]: { ...current[partId], ...changes } };
  window.localStorage.setItem(ADDON_MODEL_OVERRIDES_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("addon-model-overrides-updated", { detail: { partId } }));
}

export function clearAddonModelOverrides(partId: CreaturePartId) {
  const current = loadAddonModelOverrides();
  delete current[partId];
  window.localStorage.setItem(ADDON_MODEL_OVERRIDES_KEY, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent("addon-model-overrides-updated", { detail: { partId } }));
}

/** Meshes are counted within the add-on itself, so the same mesh matches on every creature. */
export function applyAddonModelOverrides(root: THREE.Object3D, partId: CreaturePartId) {
  const overrides = loadAddonModelOverrides()[partId];
  if (!overrides) return;
  let index = 0;
  root.traverse((object) => {
    // Meshes added by StaticMeshMerger are not part of the add-on, so they never shift its mesh indices.
    if (!(object instanceof THREE.Mesh) || object.userData.mergedStaticMesh === true) return;
    const transform = overrides[`mesh-${index}`];
    index += 1;
    if (!transform) return;
    object.position.set(transform.x, transform.y, transform.z);
    object.scale.set(transform.scaleX, transform.scaleY, transform.scaleZ);
    object.rotation.set(
      THREE.MathUtils.degToRad(transform.rotationX),
      THREE.MathUtils.degToRad(transform.rotationY),
      THREE.MathUtils.degToRad(transform.rotationZ),
    );
  });
}
