import type * as THREEType from "three";
import { createArtifactFormationPositions } from "@/components/particles/particleGeometry";
import { revealAssemblesConstellation, revealTiming } from "@/lib/animation/revealMachine";
import type { ExhibitionArtifact } from "@/types/exhibition";

const AR_PARTICLE_COUNT = 2000;
/** Share of the formation's particles drawn on a tracked target, spread evenly across it. */
const AR_PARTICLE_SHARE = 0.7;
const AR_PARTICLE_SIZE_PX = 15;
const AR_CLUSTER_FADE_MS = 450;
const AR_FORMATION_SCALE = 0.51;

const trackedClusterVertexShader = /* glsl */ `
  attribute float aSeed;
  uniform float uPointSize;
  varying float vBrightness;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uPointSize * (0.72 + aSeed * 0.8);
    vBrightness = 0.72 + aSeed * 0.28;
  }
`;

const trackedClusterFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vBrightness;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float particle = 1.0 - smoothstep(0.08, 0.5, distanceToCenter);
    float glow = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
    gl_FragColor = vec4((uColor + glow * 0.25) * vBrightness, particle * uOpacity);
  }
`;

export type TargetDetectionResult = "reveal" | "revisit" | "ignore";
export type TargetFoundEvent = (
  targetIndex: number,
) => TargetDetectionResult;
export type TargetLostEvent = (targetIndex: number) => void;

export type MindARAdapterOptions = {
  imageTargetSrc: string;
  targets: ARParticleTarget[];
  onTargetFound: TargetFoundEvent;
  onTargetLost: TargetLostEvent;
};

export type ARParticleTarget = Pick<
  ExhibitionArtifact,
  "id" | "targetIndex" | "particleForm" | "color"
> & {
  // Compiled MindAR target indices that all resolve to this artifact, e.g. its
  // dark and white target images.
  anchorIndices: number[];
};

export type ARAdapterErrorCode =
  | "unsupported"
  | "missing-targets"
  | "permission-denied"
  | "initialization-failed";

export class ARAdapterError extends Error {
  constructor(
    public code: ARAdapterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ARAdapterError";
  }
}

type NativeParticle = {
  group: THREEType.Group;
  points: THREEType.Points;
  material: THREEType.ShaderMaterial;
  positions: Float32Array;
  basePositions: Float32Array;
  seeds: Float32Array;
  startedAt: number;
};

type MindARNative = InstanceType<
  typeof import("mind-ar/dist/mindar-image-three.prod.js").MindARThree
>;

type MindARModules = [typeof import("mind-ar/dist/mindar-image-three.prod.js"), typeof THREEType];

let modulesPreload: Promise<MindARModules> | null = null;
const targetPreloads = new Map<string, Promise<boolean>>();

function loadModules() {
  modulesPreload ??= Promise.all([
    import("mind-ar/dist/mindar-image-three.prod.js"),
    import("three"),
  ]).catch((error) => {
    modulesPreload = null;
    throw error;
  });
  return modulesPreload;
}

/** Downloads the target bundle into the browser cache, where MindAR's own request finds it; false if it is missing. */
function loadTargets(imageTargetSrc: string) {
  let preload = targetPreloads.get(imageTargetSrc);
  if (!preload) {
    preload = fetch(imageTargetSrc)
      .then(async (response) => {
        if (response.ok) await response.arrayBuffer();
        return response.ok;
      })
      .catch((error) => {
        targetPreloads.delete(imageTargetSrc);
        throw error;
      });
    targetPreloads.set(imageTargetSrc, preload);
  }
  return preload;
}

/**
 * Starts downloading MindAR, Three.js and the target bundle before the camera is asked for, so
 * pressing "Start camera" only has to wait for the camera and the tracker to warm up.
 */
export function preloadMindAR(imageTargetSrc: string) {
  void loadModules().catch(() => {});
  void loadTargets(imageTargetSrc).catch(() => {});
}

export class MindARAdapter {
  private instance: MindARNative | null = null;
  private particles = new Map<number, NativeParticle>();
  private visibleTargets = new Set<number>();
  private activeTargets = new Set<number>();
  private revealTimeScale = 1;
  private stopped = false;

  constructor(private options: MindARAdapterOptions) {}

  async start(container: HTMLElement) {
    this.stopped = false;
    this.revealTimeScale = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
      ? 0.08
      : 1;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.isSecureContext
    ) {
      throw new ARAdapterError(
        "unsupported",
        "Camera AR requires a secure context and a browser with camera support.",
      );
    }

    // Usually already under way since preloadMindAR, so this mostly waits for what is left.
    const [targetsFound, modules] = await Promise.all([
      loadTargets(this.options.imageTargetSrc).catch(() => true),
      loadModules().catch((error: unknown) => error),
    ]);
    if (!targetsFound) {
      throw new ARAdapterError(
        "missing-targets",
        `No compiled MindAR target file was found at ${this.options.imageTargetSrc}.`,
      );
    }
    if (this.stopped) return;

    try {
      if (!Array.isArray(modules)) throw modules;
      const [{ MindARThree }, THREE] = modules as MindARModules;
      const mindar = new MindARThree({
        container,
        imageTargetSrc: this.options.imageTargetSrc,
        uiLoading: "no",
        uiScanning: "no",
        uiError: "no",
        filterMinCF: 0.0001,
        filterBeta: 10,
        warmupTolerance: 30,
        missTolerance: 5,
      });
      this.instance = mindar;
      mindar.renderer.domElement.style.zIndex = "1";
      mindar.renderer.domElement.style.pointerEvents = "none";

      this.options.targets.forEach((target) => {
        const nativeParticle = this.createNativeParticle(THREE, target);
        this.particles.set(target.targetIndex, nativeParticle);
        mindar.scene.add(nativeParticle.group);

        target.anchorIndices.forEach((anchorIndex) => {
          const anchor = mindar.addAnchor(anchorIndex);
          anchor.onTargetFound = () => {
            if (this.stopped || this.visibleTargets.has(target.targetIndex)) return;
            this.visibleTargets.add(target.targetIndex);
            const detection = this.options.onTargetFound(target.targetIndex);

            if (
              detection !== "ignore" &&
              !this.activeTargets.has(target.targetIndex)
            ) {
              this.activeTargets.add(target.targetIndex);
              this.resetNativeParticle(nativeParticle);
              nativeParticle.startedAt =
                performance.now() -
                (detection === "revisit" ? this.clusterRevealDelay() : 0);
            }
          };
          anchor.onTargetLost = () => {
            if (this.stopped || !this.visibleTargets.has(target.targetIndex)) return;
            this.visibleTargets.delete(target.targetIndex);
            this.options.onTargetLost(target.targetIndex);
          };
          anchor.onTargetUpdate = () => {
            if (
              !anchor.group.visible ||
              !this.activeTargets.has(target.targetIndex)
            ) {
              return;
            }
            nativeParticle.group.matrix.copy(anchor.group.matrix);
            nativeParticle.group.matrixWorldNeedsUpdate = true;
          };
        });
      });

      await mindar.start();
      if (this.stopped || this.instance !== mindar) {
        await mindar.stop();
        return;
      }
      mindar.renderer.setAnimationLoop(() => {
        this.updateNativeParticles(performance.now());
        mindar.renderer.render(mindar.scene, mindar.camera);
      });
    } catch (error) {
      await this.stop();
      if (error instanceof ARAdapterError) throw error;
      if (
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")
      ) {
        throw new ARAdapterError(
          "permission-denied",
          "Camera permission was denied. Allow camera access and try again.",
        );
      }
      throw new ARAdapterError(
        "initialization-failed",
        error instanceof Error ? error.message : "MindAR could not be initialized.",
      );
    }
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.visibleTargets.clear();
    this.activeTargets.clear();

    const instance = this.instance;
    this.instance = null;
    if (instance) {
      instance.renderer.setAnimationLoop(null);
      try {
        await instance.stop();
      } catch {
        // MindAR can reject stop while camera initialization is still unwinding.
      }
    }

    this.particles.forEach(({ group, points }) => {
      points.geometry.dispose();
      if (Array.isArray(points.material)) {
        points.material.forEach((material) => material.dispose());
      } else {
        points.material.dispose();
      }
      group.removeFromParent();
    });
    this.particles.clear();
  }

  dismissArtifact(targetIndex: number) {
    // End only the current presentation. A later lost → found cycle may
    // activate this target again without changing its Redux collection state.
    this.activeTargets.delete(targetIndex);
    const particle = this.particles.get(targetIndex);
    if (!particle) return;
    this.hideNativeParticle(particle);
  }

  private createNativeParticle(
    THREE: typeof THREEType,
    target: ARParticleTarget,
  ): NativeParticle {
    const count = Math.max(1, Math.round(AR_PARTICLE_COUNT * AR_PARTICLE_SHARE));
    const positions = new Float32Array(count * 3);
    const basePositions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    // An even subset of the full formation, so the constellation keeps its shape, only sparser.
    const full = createArtifactFormationPositions(target, AR_PARTICLE_COUNT);
    const formation = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const source = Math.floor((index * AR_PARTICLE_COUNT) / count);
      formation.set(full.subarray(source * 3, source * 3 + 3), index * 3);
    }
    let seed = (target.targetIndex + 1) * 104729;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      positions[offset] = formation[offset] * AR_FORMATION_SCALE;
      positions[offset + 1] =
        (formation[offset + 1] - 0.32) * AR_FORMATION_SCALE;
      positions[offset + 2] =
        0.12 +
        (formation[offset + 2] - 0.35) * 0.12 +
        random() * 0.25;
      basePositions[offset] = positions[offset];
      basePositions[offset + 1] = positions[offset + 1];
      basePositions[offset + 2] = positions[offset + 2];
      seeds[index] = random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: trackedClusterVertexShader,
      fragmentShader: trackedClusterFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(target.color) },
        uOpacity: { value: 0 },
        uPointSize: { value: AR_PARTICLE_SIZE_PX },
      },
    });
    material.toneMapped = false;
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    points.frustumCulled = false;
    points.renderOrder = 10;
    const group = new THREE.Group();
    group.visible = false;
    group.matrixAutoUpdate = false;
    group.add(points);

    return {
      group,
      points,
      material,
      positions,
      basePositions,
      seeds,
      startedAt: 0,
    };
  }

  private resetNativeParticle(particle: NativeParticle) {
    particle.positions.set(particle.basePositions);
    const attribute = particle.points.geometry.getAttribute(
      "position",
    ) as THREEType.BufferAttribute;
    attribute.needsUpdate = true;
    particle.points.visible = false;
    particle.group.visible = false;
    particle.material.uniforms.uOpacity.value = 0;
  }

  private hideNativeParticle(particle: NativeParticle) {
    particle.points.visible = false;
    particle.group.visible = false;
    particle.material.uniforms.uOpacity.value = 0;
  }

  private clusterRevealDelay() {
    // After the on-screen assembly, the tracked constellation takes over on the
    // target while the creature evolves; otherwise it follows the whole reveal.
    if (revealAssemblesConstellation) {
      return revealTiming.assembling * this.revealTimeScale;
    }
    return (
      (revealTiming.attached +
        revealTiming.release +
        revealTiming.formation) *
      this.revealTimeScale
    );
  }

  private updateNativeParticles(now: number) {
    this.particles.forEach((particle, targetIndex) => {
      if (!this.activeTargets.has(targetIndex)) return;
      const elapsed = Math.max(0, now - particle.startedAt);
      const clusterRevealAt = this.clusterRevealDelay();
      const clusterElapsed = elapsed - clusterRevealAt;

      if (clusterElapsed < 0) return;

      particle.group.visible = true;
      particle.points.visible = true;
      const elapsedSeconds = elapsed / 1000;
      const revealProgress = Math.min(
        clusterElapsed / (AR_CLUSTER_FADE_MS * this.revealTimeScale),
        1,
      );
      const easedReveal = 1 - Math.pow(1 - revealProgress, 3);

      for (let index = 0; index < particle.seeds.length; index += 1) {
        const offset = index * 3;
        const seed = particle.seeds[index];
        particle.positions[offset] =
          particle.basePositions[offset] +
          Math.sin(elapsedSeconds * 0.72 + seed * 20) * 0.012;
        particle.positions[offset + 1] =
          particle.basePositions[offset + 1] +
          Math.cos(elapsedSeconds * 0.61 + seed * 18) * 0.014;
        particle.positions[offset + 2] =
          particle.basePositions[offset + 2] +
          Math.sin(elapsedSeconds * 0.52 + seed * 13) * 0.018;
      }

      const attribute = particle.points.geometry.getAttribute(
        "position",
      ) as THREEType.BufferAttribute;
      attribute.needsUpdate = true;
      particle.material.uniforms.uOpacity.value =
        easedReveal * (0.82 + Math.sin(elapsedSeconds * 0.7) * 0.05);
    });
  }
}
