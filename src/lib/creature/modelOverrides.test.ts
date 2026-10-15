import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { applyCreatureModelOverrides, meshKey, traitMarksTag } from "./modelOverrides";

// The edits as the project file would hold them; vi.mock is hoisted above the imports.
vi.mock("@/data/modelEdits.json", () => {
  const transform = { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1, rotationX: 0, rotationY: 0, rotationZ: 0 };
  return {
    default: {
      creatures: {
        // An edit saved for a body mesh the fish no longer has, at the index an add-on would take.
        fish: { "mesh-1": transform },
        crab: { "mesh-0": transform, "mesh-1": { ...transform, hidden: true } },
      },
      plants: {},
      addons: {},
      worldEvents: {},
    },
  };
});

describe("creature model overrides", () => {
  it("never count or move a creature's add-ons", () => {
    const root = new THREE.Group();
    const body = new THREE.Mesh();
    const traits = new THREE.Group();
    traits.userData[traitMarksTag] = true;
    const addon = new THREE.Mesh();
    addon.scale.set(0.17, 0.035, 0.17);
    traits.add(addon);
    root.add(body, traits);

    applyCreatureModelOverrides(root, "fish");
    expect(addon.scale.toArray()).toEqual([0.17, 0.035, 0.17]);
    expect(meshKey(root, body)).toBe("mesh-0");
    expect(meshKey(root, addon)).toBeNull();
  });

  it("leave deleted shapes out of the creature", () => {
    const root = new THREE.Group();
    const kept = new THREE.Mesh();
    const deleted = new THREE.Mesh();
    root.add(kept, deleted);
    applyCreatureModelOverrides(root, "crab");
    expect(kept.visible).toBe(true);
    expect(deleted.visible).toBe(false);
  });
});
