import { isValidElement, type ReactNode } from "react";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { CreatureModel } from "./CreatureModel";
import { BodyAttachment, BodyProportions } from "./CreatureLook";
import { creatureProportions } from "@/lib/creature/proportions";

const state = vi.hoisted(() => ({
  stretch: { x: 1, y: 1, z: 1 },
  frame: null as null | ((state: { clock: { elapsedTime: number } }) => void),
}));

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useMemo: (create: () => unknown) => create(),
  useRef: (current: unknown) => ({ current }),
  useContext: () => ({ proportions: state.stretch }),
}));
vi.mock("@react-three/fiber", () => ({ useFrame: (frame: typeof state.frame) => { state.frame = frame; } }));
vi.mock("./AquaticModelShared", () => ({ TraitMarks: () => null }));
vi.mock("./CreaturePatternMaterial", () => ({ PatternedToonMaterial: () => null }));
vi.mock("./StaticMeshMerger", () => ({ movingPartTag: "movesOnItsOwn" }));

// Resolve the model's real JSX transforms and refs into a Three scene without a WebGL renderer.
function scene(node: ReactNode, parent: THREE.Object3D) {
  if (Array.isArray(node)) { node.forEach((child) => scene(child, parent)); return; }
  if (!isValidElement<Record<string, unknown>>(node)) return;
  const props = node.props;
  if (node.type === BodyProportions || node.type === BodyAttachment) {
    scene(node.type(props as never) as ReactNode, parent);
    return;
  }
  if (node.type !== "group" && node.type !== "mesh") return;
  const object = node.type === "mesh" ? new THREE.Mesh() : new THREE.Group();
  object.name = props.name as string ?? "";
  if (props.position) object.position.fromArray(props.position as number[]);
  if (props.rotation) object.rotation.set(...props.rotation as [number, number, number]);
  if (typeof props.scale === "number") object.scale.setScalar(props.scale);
  else if (props.scale) object.scale.fromArray(props.scale as number[]);
  const children = props.children as ReactNode;
  if (object instanceof THREE.Mesh && Array.isArray(children)) {
    const sphere = children.find((child) => isValidElement(child) && child.type === "sphereGeometry");
    if (isValidElement<{ args: [number, number, number] }>(sphere)) object.geometry = new THREE.SphereGeometry(...sphere.props.args);
  }
  parent.add(object);
  if (typeof props.ref === "function") props.ref(object);
  else if (props.ref) (props.ref as { current: THREE.Object3D }).current = object;
  scene(children, object);
}

describe("fish eyes", () => {
  it("exposes the camera-facing eye in the reported poster pose", () => {
    state.stretch = creatureProportions("632cd7bf:fish:4");
    const root = new THREE.Group();
    root.position.set(-0.05, 0.45, 1.5);
    root.rotation.set(0.13, -Math.PI / 2 + 0.42 - 1.91, 0);
    scene(CreatureModel({ pieces: [], baseSeed: "632cd7bf:fish:4", scale: 1.6, animated: false }), root);
    root.updateMatrixWorld(true);
    const eye = root.getObjectByName("Fish far eye")!;
    const center = eye.getWorldPosition(new THREE.Vector3());
    const camera = new THREE.Vector3(0, 0.4, 13);
    const ray = new THREE.Raycaster(camera, center.clone().sub(camera).normalize());
    const hits = ray.intersectObject(root, true);
    expect(hits[0]?.object.parent).toBe(eye);
    const pupil = eye.children[1];
    const target = pupil.getWorldPosition(new THREE.Vector3());
    ray.set(camera, target.sub(camera).normalize());
    expect(ray.intersectObject(root, true)[0]?.object).toBe(pupil);
  });
  it.each(Array.from({ length: 40 }, (_, seed) => seed))("keeps both eyes attached and visible throughout animation at all proportion extremes for seed %i", (seed) => {
    const extremes = [0.88, 1.12].flatMap((x) => [0.88, 1.15].flatMap((y) => [0.85, 1.2].map((z) => ({ x, y, z }))));
    for (const stretch of [{ x: 1, y: 1, z: 1 }, ...extremes]) {
      state.stretch = stretch;
      const root = new THREE.Group();
      scene(CreatureModel({ pieces: [], baseSeed: `eye-check-${seed}` }), root);
      const head = root.getObjectByName("Fish head")!;
      const eyes = [root.getObjectByName("Fish near eye")!, root.getObjectByName("Fish far eye")!];
      expect(eyes.every(Boolean)).toBe(true);
      for (let time = 0; time < 12; time += 0.09) {
        state.frame!({ clock: { elapsedTime: time } });
        root.updateMatrixWorld(true);
        for (const [index, eye] of eyes.entries()) {
          const center = eye.getWorldPosition(new THREE.Vector3());
          // An embedded centre proves that the white intersects the actual head volume.
          expect(head.worldToLocal(center.clone()).length()).toBeLessThan(0.7);
          expect(eye.scale.y).toBe(1);
          const pupil = eye.children[1];
          expect(eye.worldToLocal(pupil.getWorldPosition(new THREE.Vector3())).length()).toBeLessThan(0.14);
          const side = index === 0 ? 1 : -1;
          const origin = center.clone();
          origin.z = side * 10;
          const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -side));
          const hits = ray.intersectObject(root, true);
          expect(hits[0]?.object.parent).toBe(eye);
        }
      }
      root.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    }
  });
});
