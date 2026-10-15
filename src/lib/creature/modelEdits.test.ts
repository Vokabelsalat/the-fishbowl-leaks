import { describe, expect, it } from "vitest";
import { applyModelEditChanges, formatModelEdits, parseModelEditChanges, type ModelEdits } from "./modelEdits";

const transform = { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1, rotationX: 0, rotationY: 0, rotationZ: 0 };

function emptyEdits(): ModelEdits {
  return { creatures: {}, plants: {}, addons: {}, worldEvents: {} };
}

describe("model edits", () => {
  it("keep a deletion when later edits to other meshes of the same model are saved", () => {
    const edits = emptyEdits();
    applyModelEditChanges(edits, { creatures: { crab: { "mesh-3": { ...transform, hidden: true } } } });
    applyModelEditChanges(edits, { creatures: { crab: { "mesh-1": { ...transform, x: 0.5 } } } });
    expect(edits.creatures.crab["mesh-3"].hidden).toBe(true);
    expect(edits.creatures.crab["mesh-1"].x).toBe(0.5);
  });

  it("restore only the model asked for", () => {
    const edits = emptyEdits();
    applyModelEditChanges(edits, { creatures: { crab: { "mesh-0": transform }, fish: { "mesh-0": transform } } });
    applyModelEditChanges(edits, { creatures: { crab: null } });
    expect(Object.keys(edits.creatures)).toEqual(["fish"]);
  });

  it("refuse anything that is not an editor transform, naming the entry", () => {
    expect(parseModelEditChanges({ creatures: { crab: { "mesh-0": { ...transform, x: "1" } } } })).toEqual({ error: "Invalid edit creatures.crab.mesh-0." });
    expect(parseModelEditChanges({ posters: {} })).toEqual({ error: "Unknown store posters." });
    expect(parseModelEditChanges({ creatures: { crab: { "mesh-0": { ...transform, hidden: true, extra: 1 } } } })).toEqual({
      changes: { creatures: { crab: { "mesh-0": { ...transform, hidden: true } } } },
    });
  });

  it("write meshes in numeric order, so saving the same edits twice changes nothing", () => {
    const edits = emptyEdits();
    edits.plants.kelp = { "mesh-10": transform, "mesh-2": transform };
    const text = formatModelEdits(edits);
    expect(text.indexOf('"mesh-2"')).toBeLessThan(text.indexOf('"mesh-10"'));
    expect(formatModelEdits(JSON.parse(text) as ModelEdits)).toBe(text);
  });
});
