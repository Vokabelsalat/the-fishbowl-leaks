import * as THREE from "three";
import { modelEdits, saveModelEdits } from "@/lib/creature/modelEdits";
import type { SavedNodeTransform } from "@/lib/creature/modelOverrides";
import type { CreaturePartId } from "@/types/exhibition";

export type AddonModelOverrides = Partial<Record<CreaturePartId, Record<string, SavedNodeTransform>>>;

export function loadAddonModelOverrides(): AddonModelOverrides {
  return modelEdits("addons") as AddonModelOverrides;
}

/** Saves the changes into the project, so every copy of the app draws them. */
export async function saveAddonModelOverrides(partId: CreaturePartId, changes: Record<string, SavedNodeTransform>) {
  const saving = saveModelEdits({ addons: { [partId]: changes } });
  // The edits already apply on this page, so its models update even before the file is written.
  window.dispatchEvent(new CustomEvent("addon-model-overrides-updated", { detail: { partId } }));
  await saving;
}

export async function clearAddonModelOverrides(partId: CreaturePartId) {
  const saving = saveModelEdits({ addons: { [partId]: null } });
  // The edits already apply on this page, so its models update even before the file is written.
  window.dispatchEvent(new CustomEvent("addon-model-overrides-updated", { detail: { partId } }));
  await saving;
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
