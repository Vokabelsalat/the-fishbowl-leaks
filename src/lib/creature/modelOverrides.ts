import * as THREE from "three";
import type { AquaticForm } from "@/lib/creature/aquaticForms";

export const CREATURE_MODEL_OVERRIDES_KEY = "after-augmented-reality:creature-model-overrides:v1";
export const WHALE_MODEL_OVERRIDES_KEY = "after-augmented-reality:creature-model-overrides:whale-v3";
export const DOLPHIN_MODEL_OVERRIDES_KEY = "after-augmented-reality:creature-model-overrides:dolphin-v4";

export type SavedNodeTransform = {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
};

export type CreatureModelOverrides = Partial<Record<AquaticForm, Record<string, SavedNodeTransform>>>;

// Meshes added by StaticMeshMerger are not part of the model, so they never shift its mesh indices.
function isModelMesh(object: THREE.Object3D): object is THREE.Mesh {
  return object instanceof THREE.Mesh && object.userData.mergedStaticMesh !== true;
}

export function meshKey(root: THREE.Object3D, target: THREE.Object3D) {
  let index = 0;
  let result: string | null = null;
  root.traverse((object) => {
    if (!isModelMesh(object) || result) return;
    if (object === target) result = `mesh-${index}`;
    index += 1;
  });
  return result;
}

export function loadCreatureModelOverrides(): CreatureModelOverrides {
  if (typeof window === "undefined") return {};
  try {
    const overrides = JSON.parse(window.localStorage.getItem(CREATURE_MODEL_OVERRIDES_KEY) ?? "{}") as CreatureModelOverrides;
    const whaleOverrides = JSON.parse(window.localStorage.getItem(WHALE_MODEL_OVERRIDES_KEY) ?? "null") as Record<string, SavedNodeTransform> | null;
    const dolphinOverrides = JSON.parse(window.localStorage.getItem(DOLPHIN_MODEL_OVERRIDES_KEY) ?? "null") as Record<string, SavedNodeTransform> | null;
    if (whaleOverrides) overrides.whale = whaleOverrides;
    else delete overrides.whale;
    if (dolphinOverrides) overrides.dolphin = dolphinOverrides;
    else delete overrides.dolphin;
    return overrides;
  } catch {
    return {};
  }
}

export function saveCreatureModelOverrides(form: AquaticForm, changes: Record<string, SavedNodeTransform>) {
  const current = loadCreatureModelOverrides();
  if (form === "whale") {
    window.localStorage.setItem(WHALE_MODEL_OVERRIDES_KEY, JSON.stringify({ ...current.whale, ...changes }));
    window.dispatchEvent(new CustomEvent("creature-model-overrides-updated", { detail: { form } }));
    return;
  }
  if (form === "dolphin") {
    window.localStorage.setItem(DOLPHIN_MODEL_OVERRIDES_KEY, JSON.stringify({ ...current.dolphin, ...changes }));
    window.dispatchEvent(new CustomEvent("creature-model-overrides-updated", { detail: { form } }));
    return;
  }
  const next = { ...current, [form]: { ...current[form], ...changes } };
  window.localStorage.setItem(CREATURE_MODEL_OVERRIDES_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("creature-model-overrides-updated", { detail: { form } }));
}

export function clearCreatureModelOverrides(form: AquaticForm) {
  if (form === "whale") {
    window.localStorage.removeItem(WHALE_MODEL_OVERRIDES_KEY);
    window.dispatchEvent(new CustomEvent("creature-model-overrides-updated", { detail: { form } }));
    return;
  }
  if (form === "dolphin") {
    window.localStorage.removeItem(DOLPHIN_MODEL_OVERRIDES_KEY);
    window.dispatchEvent(new CustomEvent("creature-model-overrides-updated", { detail: { form } }));
    return;
  }
  const current = loadCreatureModelOverrides();
  delete current[form];
  window.localStorage.setItem(CREATURE_MODEL_OVERRIDES_KEY, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent("creature-model-overrides-updated", { detail: { form } }));
}

export function applyCreatureModelOverrides(root: THREE.Object3D, form: AquaticForm) {
  const overrides = loadCreatureModelOverrides()[form];
  if (!overrides) return;
  let index = 0;
  root.traverse((object) => {
    if (!isModelMesh(object)) return;
    const transform = overrides[`mesh-${index}`];
    index += 1;
    if (!transform) return;
    // The fish's essential face follows the edited head as one attachment. Old per-mesh
    // eye edits can otherwise hide a white, move its pupil away or leave it floating.
    if (form === "fish") {
      for (let parent = object.parent; parent && parent !== root; parent = parent.parent) {
        if (parent.userData.attachedFishFace) return;
      }
    }
    object.position.set(transform.x, transform.y, transform.z);
    object.scale.set(transform.scaleX, transform.scaleY, transform.scaleZ);
    object.rotation.set(
      THREE.MathUtils.degToRad(transform.rotationX),
      THREE.MathUtils.degToRad(transform.rotationY),
      THREE.MathUtils.degToRad(transform.rotationZ),
    );
  });
}
