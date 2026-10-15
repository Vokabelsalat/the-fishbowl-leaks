import * as THREE from "three";
import type { WorldEventId } from "@/components/collective/WorldEvents";
import { modelEdits, saveModelEdits } from "@/lib/creature/modelEdits";
import type { SavedNodeTransform } from "@/lib/creature/modelOverrides";

export const worldEventOverridesUpdated = "world-event-overrides-updated";

export type WorldEventModelOverrides = Partial<Record<WorldEventId, Record<string, SavedNodeTransform>>>;

export function loadWorldEventOverrides(): WorldEventModelOverrides {
  return modelEdits("worldEvents") as WorldEventModelOverrides;
}

/** Saves the changes into the project, so every copy of the app draws them. */
export async function saveWorldEventOverrides(id: WorldEventId, changes: Record<string, SavedNodeTransform>) {
  const saving = saveModelEdits({ worldEvents: { [id]: changes } });
  // The edits already apply on this page, so its models update even before the file is written.
  window.dispatchEvent(new CustomEvent(worldEventOverridesUpdated, { detail: { id } }));
  await saving;
}

export async function clearWorldEventOverrides(id: WorldEventId) {
  const saving = saveModelEdits({ worldEvents: { [id]: null } });
  // The edits already apply on this page, so its models update even before the file is written.
  window.dispatchEvent(new CustomEvent(worldEventOverridesUpdated, { detail: { id } }));
  await saving;
}

/** The node's transform as the editor saved it, built into a matrix. */
export function overrideMatrix(transform: SavedNodeTransform) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(transform.x, transform.y, transform.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(transform.rotationX),
      THREE.MathUtils.degToRad(transform.rotationY),
      THREE.MathUtils.degToRad(transform.rotationZ),
    )),
    new THREE.Vector3(transform.scaleX, transform.scaleY, transform.scaleZ),
  );
}

/**
 * Applies the saved transforms to the event's meshes, matched by their order in the model. A school
 * is drawn as one instanced mesh in the aquarium but edited as a single member, so it applies its
 * override to every member itself and is skipped here.
 */
export function applyWorldEventOverrides(root: THREE.Object3D, id: WorldEventId) {
  const overrides = loadWorldEventOverrides()[id];
  if (!overrides) return;
  let index = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const transform = overrides[`mesh-${index}`];
    index += 1;
    if (!transform || object instanceof THREE.InstancedMesh) return;
    object.position.set(transform.x, transform.y, transform.z);
    object.scale.set(transform.scaleX, transform.scaleY, transform.scaleZ);
    object.rotation.set(
      THREE.MathUtils.degToRad(transform.rotationX),
      THREE.MathUtils.degToRad(transform.rotationY),
      THREE.MathUtils.degToRad(transform.rotationZ),
    );
  });
}
