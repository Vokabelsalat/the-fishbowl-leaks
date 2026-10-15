import * as THREE from "three";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import { modelEdits, saveModelEdits } from "@/lib/creature/modelEdits";

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
  /** True when the shape was deleted in the creature editor, so the creature is drawn without it. */
  hidden?: boolean;
};

export type CreatureModelOverrides = Partial<Record<AquaticForm, Record<string, SavedNodeTransform>>>;

/** Marks the group holding a creature's add-ons, which the add-on editor adjusts instead. */
export const traitMarksTag = "aquaticTraitMarks";

function isInsideTraitMarks(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (node.userData[traitMarksTag]) return true;
  }
  return false;
}

// Meshes added by StaticMeshMerger are not part of the model, so they never shift its mesh indices.
// Nor are add-ons: they differ from creature to creature, so counting them would let an adjustment
// saved for one creature's body land on another creature's add-on.
function isModelMesh(object: THREE.Object3D): object is THREE.Mesh {
  return object instanceof THREE.Mesh && object.userData.mergedStaticMesh !== true && !isInsideTraitMarks(object);
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
  return modelEdits("creatures") as CreatureModelOverrides;
}

/** Saves the changes into the project, for this creature form everywhere the app draws it. */
export async function saveCreatureModelOverrides(form: AquaticForm, changes: Record<string, SavedNodeTransform>) {
  await saveModelEdits({ creatures: { [form]: changes } });
}

export async function clearCreatureModelOverrides(form: AquaticForm) {
  await saveModelEdits({ creatures: { [form]: null } });
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
    // Deleting a shape is always deliberate, so it applies to the fish's face too.
    object.visible = !transform.hidden;
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
