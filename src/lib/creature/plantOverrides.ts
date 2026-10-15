import * as THREE from "three";
import type { PlantKind } from "@/components/collective/AquariumDioramaPlants";
import { modelEdits, saveModelEdits } from "@/lib/creature/modelEdits";
import type { SavedNodeTransform } from "@/lib/creature/modelOverrides";

export type PlantModelOverrides = Partial<Record<PlantKind, Record<string, SavedNodeTransform>>>;

export function loadPlantModelOverrides(): PlantModelOverrides {
  return modelEdits("plants") as PlantModelOverrides;
}

/** Saves the changes into the project, so every copy of the app draws them. */
export async function savePlantModelOverrides(kind: PlantKind, changes: Record<string, SavedNodeTransform>) {
  const saving = saveModelEdits({ plants: { [kind]: changes } });
  // The edits already apply on this page, so its models update even before the file is written.
  window.dispatchEvent(new CustomEvent("plant-model-overrides-updated", { detail: { kind } }));
  await saving;
}

export async function clearPlantModelOverrides(kind: PlantKind) {
  const saving = saveModelEdits({ plants: { [kind]: null } });
  // The edits already apply on this page, so its models update even before the file is written.
  window.dispatchEvent(new CustomEvent("plant-model-overrides-updated", { detail: { kind } }));
  await saving;
}

export function applyPlantModelOverrides(root: THREE.Object3D, kind: PlantKind) {
  const overrides = loadPlantModelOverrides()[kind];
  if (!overrides) return;
  let index = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
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
