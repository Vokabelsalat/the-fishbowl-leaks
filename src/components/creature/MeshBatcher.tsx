"use client";

import { useThree } from "@react-three/fiber";
import { createContext, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import {
  drawPatternMask,
  patternSourceKey,
  patternTileSize,
  type PatternTextureSource,
} from "@/components/creature/CreaturePatternMaterial";
import type { CreaturePattern } from "@/lib/creature/patterns";

/**
 * Meshes handed to the batcher stay in their creature for clicks, but only on this layer: the
 * click raycaster looks at it, the camera does not.
 */
export const batchProxyLayer = 30;

const batchableMaterialTypes = new Set(["MeshToonMaterial", "MeshBasicMaterial"]);
const initialInstances = 64;
// Above 65,535 vertices, so the shared index buffer starts with 32-bit indices and never has to switch.
const initialVertices = 70_000;
const initialMaskLayers = 16;
const bytesPerMask = patternTileSize * patternTileSize;

/** Colourings of the same pattern share one mask; contrast and colours travel with the vertices. */
function maskKey(pattern: CreaturePattern) {
  return `${pattern.kind}|${pattern.orientation}|${pattern.seed}`;
}

/**
 * The marks of every pattern in the tank, one byte per pixel, as the layers of one texture array,
 * so meshes with different patterns can share a draw call. Layer 0 is empty, for meshes without a
 * pattern. Layers are counted and reused once no mesh shows them any more.
 */
class PatternMasks {
  readonly uniform: { value: THREE.DataArrayTexture };
  private capacity = initialMaskLayers;
  private readonly layers = new Map<string, { layer: number; users: number }>();
  private readonly free: number[] = [];
  private next = 1;
  /** Until a texture's first full upload, three would upload only the layers marked as changed. */
  private uploaded = false;

  constructor(private readonly maxLayers: number) {
    this.uniform = { value: this.texture(new Uint8Array(bytesPerMask * this.capacity), this.capacity) };
  }

  private texture(data: Uint8Array, depth: number) {
    const texture = new THREE.DataArrayTexture(data, patternTileSize, patternTileSize, depth);
    texture.format = THREE.RedFormat;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.uploaded = false;
    texture.onUpdate = () => {
      this.uploaded = true;
    };
    return texture;
  }

  /** The layer holding the pattern's marks, drawn in if it is new, or null when the array is full. */
  acquire(pattern: CreaturePattern) {
    const key = maskKey(pattern);
    const known = this.layers.get(key);
    if (known) {
      known.users += 1;
      return known.layer;
    }
    const layer = this.free.pop() ?? (this.next < this.maxLayers ? this.next++ : null);
    if (layer === null) return null;
    if (layer >= this.capacity) this.grow(Math.min(this.maxLayers, this.capacity * 2));

    const pixels = drawPatternMask(pattern).getContext("2d")!.getImageData(0, 0, patternTileSize, patternTileSize).data;
    const texture = this.uniform.value;
    const data = texture.image.data as Uint8Array;
    // Canvas textures are flipped on upload, so the canvas's bottom row comes first, as it does there.
    for (let row = 0; row < patternTileSize; row += 1) {
      const from = (patternTileSize - 1 - row) * patternTileSize;
      for (let column = 0; column < patternTileSize; column += 1) {
        data[layer * bytesPerMask + row * patternTileSize + column] = pixels[(from + column) * 4];
      }
    }
    if (this.uploaded) texture.addLayerUpdate(layer);
    texture.needsUpdate = true;
    this.layers.set(key, { layer, users: 1 });
    return layer;
  }

  release(layer: number) {
    if (layer === 0) return;
    for (const [key, entry] of this.layers) {
      if (entry.layer !== layer) continue;
      entry.users -= 1;
      if (entry.users === 0) {
        this.layers.delete(key);
        this.free.push(layer);
      }
      return;
    }
  }

  private grow(capacity: number) {
    const previous = this.uniform.value;
    const data = new Uint8Array(bytesPerMask * capacity);
    data.set(previous.image.data as Uint8Array);
    this.uniform.value = this.texture(data, capacity);
    this.capacity = capacity;
    previous.dispose();
  }

  dispose() {
    this.uniform.value.dispose();
  }
}

type SourceMaterial = THREE.Material & {
  color: THREE.Color;
  map?: THREE.Texture | null;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  flatShading?: boolean;
};

/** Everything that must match for meshes to share a batch; colour, glow, opacity and pattern travel with the vertices. */
function batchKey(material: SourceMaterial, renderOrder: number) {
  return [
    material.type,
    material.side,
    material.transparent,
    material.depthWrite,
    material.depthTest,
    material.alphaTest,
    material.blending,
    material.flatShading,
    material.forceSinglePass,
    material.toneMapped,
    (material as unknown as { fog?: boolean }).fog,
    renderOrder,
  ].join("|");
}

/** A toon or basic material that reads colour, opacity, glow and pattern from the vertices instead. */
function batchMaterial(source: SourceMaterial, masks: PatternMasks) {
  const material = source.clone() as SourceMaterial;
  material.color.set("#FFFFFF");
  material.map = null;
  material.opacity = 1;
  material.vertexColors = true;
  if (material.emissive) {
    material.emissive.set("#000000");
    material.emissiveIntensity = 1;
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.patternMasks = masks.uniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
attribute vec2 patternUv;
attribute float patternLayer;
attribute vec4 markingTint;
attribute vec3 emissiveTint;
varying vec2 vPatternUv;
// Not "flat": on Metal that makes the browser rewrite the whole index buffer before each draw.
varying float vPatternLayer;
varying vec3 vMarkingTint;
varying vec3 vEmissiveTint;`)
      .replace("#include <uv_vertex>", `#include <uv_vertex>
vPatternUv = patternUv;
vPatternLayer = patternLayer;
vMarkingTint = markingTint.rgb;
vEmissiveTint = emissiveTint;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform sampler2DArray patternMasks;
varying vec2 vPatternUv;
varying float vPatternLayer;
varying vec3 vMarkingTint;
varying vec3 vEmissiveTint;`)
      // The vertex colour is the body colour; the pattern's marks are painted over it in the marking colour.
      .replace("#include <color_fragment>", `#include <color_fragment>
diffuseColor.rgb = mix( diffuseColor.rgb, vMarkingTint, texture( patternMasks, vec3( vPatternUv, floor( vPatternLayer + 0.5 ) ) ).r );`)
      .replace("vec3 totalEmissiveRadiance = emissive;", "vec3 totalEmissiveRadiance = emissive + vEmissiveTint;");
  };
  material.customProgramCacheKey = () => "tank-batch";
  return material;
}

/** The mesh's geometry with the attributes every batched geometry shares, or null if it cannot be batched. */
function batchGeometry(mesh: THREE.Mesh, material: SourceMaterial, pattern: PatternTextureSource | undefined, layer: number) {
  const source = mesh.geometry;
  const position = source.getAttribute("position");
  const normal = source.getAttribute("normal");
  const index = source.getIndex();
  if (!position || !normal || !index) return null;
  const count = position.count;
  const vertexColor = source.getAttribute("color");
  const uv = source.getAttribute("uv");

  // A patterned part's texture showed its body colour with marks in a blend toward the marking colour.
  const body = pattern ? new THREE.Color(pattern.baseColor) : new THREE.Color(1, 1, 1);
  const marks = pattern ? body.clone().lerp(new THREE.Color(pattern.markingColor), pattern.pattern.contrast) : body;
  const colors = new Uint16Array(count * 4);
  // Four values per vertex, though only three are used: Metal needs vertex data in steps of four bytes,
  // and a six-byte stride makes the browser convert the whole buffer before drawing it.
  const markings = new Uint16Array(count * 4);
  const shade = new THREE.Color();
  const tint = new THREE.Color();
  const unit = (value: number) => Math.round(THREE.MathUtils.clamp(value, 0, 1) * 65535);
  for (let vertex = 0; vertex < count; vertex += 1) {
    if (vertexColor) shade.setRGB(vertexColor.getX(vertex), vertexColor.getY(vertex), vertexColor.getZ(vertex));
    else shade.setRGB(1, 1, 1);
    shade.multiply(material.color);
    tint.copy(shade).multiply(body);
    colors[vertex * 4] = unit(tint.r);
    colors[vertex * 4 + 1] = unit(tint.g);
    colors[vertex * 4 + 2] = unit(tint.b);
    colors[vertex * 4 + 3] = unit(material.opacity);
    tint.copy(shade).multiply(marks);
    markings[vertex * 4] = unit(tint.r);
    markings[vertex * 4 + 1] = unit(tint.g);
    markings[vertex * 4 + 2] = unit(tint.b);
  }

  // The pattern's repeat and offset are baked in, so the texture array's wrapping repeats each tile.
  const patternUv = new Float32Array(count * 2);
  if (pattern && material.map && uv) {
    const map = material.map;
    if (map.matrixAutoUpdate) map.updateMatrix();
    const point = new THREE.Vector2();
    for (let vertex = 0; vertex < count; vertex += 1) {
      point.set(uv.getX(vertex), uv.getY(vertex)).applyMatrix3(map.matrix);
      patternUv[vertex * 2] = point.x;
      patternUv[vertex * 2 + 1] = point.y;
    }
  }

  const glow = material.emissive ? material.emissive.clone().multiplyScalar(material.emissiveIntensity ?? 1) : new THREE.Color(0, 0, 0);
  const emissiveTint = new Float32Array(count * 3);
  for (let vertex = 0; vertex < count; vertex += 1) glow.toArray(emissiveTint, vertex * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", position.clone());
  geometry.setAttribute("normal", normal.clone());
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4, true));
  geometry.setAttribute("patternUv", new THREE.BufferAttribute(patternUv, 2));
  geometry.setAttribute("patternLayer", new THREE.BufferAttribute(new Float32Array(count).fill(layer), 1));
  geometry.setAttribute("markingTint", new THREE.BufferAttribute(markings, 4, true));
  geometry.setAttribute("emissiveTint", new THREE.BufferAttribute(emissiveTint, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(index.array as ArrayLike<number>), 1));
  return geometry;
}

type Entry = { batch: Batch; geometryId: number; instanceId: number; layer: number; shown: boolean };
type Batch = { mesh: THREE.BatchedMesh; material: THREE.Material; meshes: Map<THREE.Mesh, Entry>; maxVertices: number; maxIndices: number };

/** True when the mesh and everything above it are visible, up to the scene. */
function isShown(mesh: THREE.Object3D) {
  let node: THREE.Object3D | null = mesh;
  let last: THREE.Object3D = mesh;
  while (node) {
    if (!node.visible) return false;
    last = node;
    node = node.parent;
  }
  return (last as THREE.Scene).isScene === true;
}

/**
 * Draws the merged meshes of every creature in a tank with a few batched draw calls, one per
 * kind of material. Each mesh keeps its place in its creature, and its batched copy follows it.
 */
export class TankBatcher {
  readonly root = new THREE.Group();
  private readonly batches = new Map<string, Batch>();
  private readonly masks: PatternMasks;

  constructor(maxMaskLayers: number) {
    this.masks = new PatternMasks(maxMaskLayers);
    // The batched copies take their meshes' world matrices, so the root stays at the world's origin
    // wherever it is placed; a moving parent would otherwise move them twice.
    this.root.matrixAutoUpdate = false;
    this.root.matrixWorldAutoUpdate = false;
  }

  /** Takes over drawing `mesh`; false when it cannot be batched and should draw itself. */
  add(mesh: THREE.Mesh) {
    if (Array.isArray(mesh.material) || !batchableMaterialTypes.has(mesh.material.type)) return false;
    const material = mesh.material as SourceMaterial;
    // Only creature patterns can be rebuilt from a mask; any other texture keeps the mesh drawing itself.
    const pattern = material.map?.userData[patternSourceKey] as PatternTextureSource | undefined;
    if (material.map && !pattern) return false;

    const layer = pattern ? this.masks.acquire(pattern.pattern) : 0;
    if (layer === null) return false;
    const geometry = batchGeometry(mesh, material, pattern, layer);
    if (!geometry) {
      this.masks.release(layer);
      return false;
    }

    const batch = this.batchFor(material, mesh.renderOrder);
    this.makeRoom(batch, geometry.getAttribute("position").count, geometry.getIndex()!.count);
    const geometryId = batch.mesh.addGeometry(geometry);
    const instanceId = batch.mesh.addInstance(geometryId);
    geometry.dispose();
    batch.meshes.set(mesh, { batch, geometryId, instanceId, layer, shown: true });
    return true;
  }

  remove(mesh: THREE.Mesh) {
    for (const batch of this.batches.values()) {
      const entry = batch.meshes.get(mesh);
      if (!entry) continue;
      batch.mesh.deleteGeometry(entry.geometryId);
      this.masks.release(entry.layer);
      batch.meshes.delete(mesh);
      return;
    }
  }

  private batchFor(material: SourceMaterial, renderOrder: number) {
    const key = batchKey(material, renderOrder);
    const existing = this.batches.get(key);
    if (existing) return existing;

    const batchedMaterial = batchMaterial(material, this.masks);
    const mesh = new THREE.BatchedMesh(initialInstances, initialVertices, initialVertices * 2, batchedMaterial);
    // The batch's own bounds would go stale as creatures swim; each instance is culled on its own instead.
    mesh.frustumCulled = false;
    mesh.perObjectFrustumCulled = true;
    mesh.renderOrder = renderOrder;
    // See-through batches sort against other see-through objects by this centre: the middle of the tank.
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
    const batch: Batch = { mesh, material: batchedMaterial, meshes: new Map(), maxVertices: initialVertices, maxIndices: initialVertices * 2 };

    // Matrices are copied after the scene has updated its own and before the batch culls and sorts,
    // so batched parts never trail a frame behind the parts drawn on their own.
    const draw = mesh.onBeforeRender.bind(mesh);
    mesh.onBeforeRender = (...args) => {
      this.follow(batch);
      draw(...args);
    };
    this.batches.set(key, batch);
    this.root.add(mesh);
    return batch;
  }

  private makeRoom(batch: Batch, vertices: number, indices: number) {
    const { mesh } = batch;
    if (mesh.unusedVertexCount < vertices || mesh.unusedIndexCount < indices) mesh.optimize();
    if (mesh.unusedVertexCount < vertices || mesh.unusedIndexCount < indices) {
      batch.maxVertices = Math.max(batch.maxVertices * 2, batch.maxVertices + vertices);
      batch.maxIndices = Math.max(batch.maxIndices * 2, batch.maxIndices + indices);
      mesh.setGeometrySize(batch.maxVertices, batch.maxIndices);
    }
    if (mesh.instanceCount >= mesh.maxInstanceCount) mesh.setInstanceCount(mesh.maxInstanceCount * 2);
  }

  private follow(batch: Batch) {
    for (const [mesh, entry] of batch.meshes) {
      const shown = isShown(mesh);
      if (shown !== entry.shown) {
        batch.mesh.setVisibleAt(entry.instanceId, shown);
        entry.shown = shown;
      }
      if (shown) batch.mesh.setMatrixAt(entry.instanceId, mesh.matrixWorld);
    }
  }

  /** Frees the GPU copies; the batcher keeps its contents and uploads them again if it is drawn later. */
  dispose() {
    for (const batch of this.batches.values()) {
      batch.mesh.dispose();
      batch.material.dispose();
    }
    this.masks.dispose();
  }
}

export const MeshBatcherContext = createContext<TankBatcher | null>(null);

/**
 * Batches the merged meshes of every creature inside it, when `enabled`. Turning it off hands
 * the meshes back to their creatures.
 */
export function TankMeshBatches({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const gl = useThree((state) => state.gl);
  const raycaster = useThree((state) => state.raycaster);
  const batcher = useMemo(() => {
    if (!enabled) return null;
    const context = gl.getContext() as WebGL2RenderingContext;
    return new TankBatcher(context.getParameter(context.MAX_ARRAY_TEXTURE_LAYERS) as number);
  }, [enabled, gl]);

  useEffect(() => {
    if (!batcher) return;
    raycaster.layers.enable(batchProxyLayer);
    return () => {
      raycaster.layers.disable(batchProxyLayer);
      batcher.dispose();
    };
  }, [batcher, raycaster]);

  return (
    <>
      {batcher && <primitive object={batcher.root} />}
      <MeshBatcherContext.Provider value={batcher}>{children}</MeshBatcherContext.Provider>
    </>
  );
}
