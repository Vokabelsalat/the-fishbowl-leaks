"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { AquaticCreatureModel } from "@/components/creature/AquaticCreatureModel";
import { artifacts } from "@/data/artifacts";

const EPS = 0.012;
const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
const form = (params.get("form") ?? "fish") as "fish";
const count = Number(params.get("count") ?? 24);
const allPieces = artifacts.map((a) => ({ artifactId: a.id, partId: a.creaturePart.id, color: a.color }));
const stretches = [[1, 1, 1], [0.88, 0.88, 0.85], [1.12, 1.15, 1.2], [0.88, 1.15, 1.2], [1.12, 0.88, 0.85]];
const listed = params.get("seeds")?.split(",");
const configs = listed
  ? listed.map((seed) => ({ seed, p: null as number[] | null, pieces: allPieces.filter((_, k) => k % 3 === 0) }))
  : Array.from({ length: count }, (_, index) => ({
    seed: `${params.get("prefix") ?? "conn"}-${index}`,
    p: stretches[index % stretches.length] as number[] | null,
    pieces: index % 3 === 0 ? [] : allPieces.filter((_, k) => (k + index) % 3 === 0),
  }));

function samplePoints(mesh: THREE.Mesh) {
  const position = mesh.geometry.getAttribute("position");
  const index = mesh.geometry.index;
  const total = index ? index.count : position.count;
  const out: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i + 2 < total; i += 3) {
    a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
    const n = Math.min(60, Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / (EPS * 0.7))));
    for (let u = 0; u <= n; u++) for (let v = 0; v <= n - u; v++) {
      p.set(0, 0, 0).addScaledVector(a, u / n).addScaledVector(b, v / n).addScaledVector(c, (n - u - v) / n);
      out.push(p.x, p.y, p.z);
    }
  }
  return out;
}

function label(object: THREE.Object3D) {
  const names: string[] = [];
  let node: THREE.Object3D | null = object;
  while (node && names.length < 2) { if (node.name) names.push(node.name); node = node.parent; }
  return `${names.join("<") || "?"}:${(object as THREE.Mesh).geometry.type}`;
}

function measure(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) meshes.push(o as THREE.Mesh); });
  const sets = meshes.map(samplePoints);
  const parent = meshes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const grid = new Map<string, Array<[number, number]>>();
  sets.forEach((pts, m) => { for (let i = 0; i < pts.length; i += 3) { const k = `${Math.floor(pts[i] / EPS)},${Math.floor(pts[i + 1] / EPS)},${Math.floor(pts[i + 2] / EPS)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push([m, i]); } });
  sets.forEach((pts, m) => { for (let i = 0; i < pts.length; i += 3) {
    const cx = Math.floor(pts[i] / EPS), cy = Math.floor(pts[i + 1] / EPS), cz = Math.floor(pts[i + 2] / EPS);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const [n, j] of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
      if (n !== m && find(n) !== find(m) && (sets[n][j] - pts[i]) ** 2 + (sets[n][j + 1] - pts[i + 1]) ** 2 + (sets[n][j + 2] - pts[i + 2]) ** 2 < EPS * EPS) parent[find(m)] = find(n);
    }
  } });
  // A part entirely inside another (such as a pupil inside an eye) counts as attached to it.
  const boxes = meshes.map((m) => new THREE.Box3().setFromObject(m));
  meshes.forEach((_, i) => meshes.forEach((__, j) => { if (i !== j && find(i) !== find(j) && boxes[j].containsBox(boxes[i])) parent[find(i)] = find(j); }));
  const groups = new Map<number, number[]>();
  meshes.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  const sorted = [...groups.values()].sort((x, y) => y.reduce((s, i) => s + sets[i].length, 0) - x.reduce((s, i) => s + sets[i].length, 0));
  const mainPts = sorted[0].flatMap((i) => sets[i]);
  return sorted.slice(1).map((g) => {
    let best = Infinity;
    for (const i of g) { const p = sets[i]; for (let k = 0; k < p.length; k += 15) for (let t = 0; t < mainPts.length; t += 15) { const d = (mainPts[t] - p[k]) ** 2 + (mainPts[t + 1] - p[k + 1]) ** 2 + (mainPts[t + 2] - p[k + 2]) ** 2; if (d < best) best = d; } }
    return { gap: +Math.sqrt(best).toFixed(3), parts: g.map((i) => label(meshes[i])).slice(0, 3) };
  });
}

function Inspector({ config, onDone }: { config: (typeof configs)[number]; onDone: (r: unknown) => void }) {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    const found: unknown[] = [];
    const times = [1200, 1900, 2700, 3400, 4300];
    const timers = times.map((time, index) => setTimeout(() => {
      found.push(...measure(ref.current!).map((d) => ({ ...d, at: time })));
      if (index === times.length - 1) onDone({ seed: config.seed, p: config.p, addons: config.pieces.length, loose: found });
    }, time));
    return () => timers.forEach(clearTimeout);
  }, [config, onDone]);
  const proportions = config.p ? { x: config.p[0], y: config.p[1], z: config.p[2] } : undefined;
  return <group ref={ref}><AquaticCreatureModel form={form} pieces={config.pieces} baseSeed={config.seed} proportions={proportions} scale={1} animated /></group>;
}

export default function BodyCheck() {
  const results = useRef<unknown[]>([]);
  return (
    <main>
      {configs.map((config, index) => (
        <div key={index} style={{ width: 60, height: 60, display: "inline-block" }}>
          <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 10 }}>
            <Inspector config={config} onDone={(r) => {
              results.current.push(r);
              if (results.current.length === configs.length) void fetch("http://127.0.0.1:8766/result", { method: "POST", mode: "no-cors", body: JSON.stringify(results.current) });
            }} />
          </Canvas>
        </div>
      ))}
    </main>
  );
}
