"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createBendableBody, finGeometry } from "@/components/collective/bendableBody";
import { applyWorldEventOverrides, loadWorldEventOverrides, overrideMatrix, worldEventOverridesUpdated } from "@/lib/creature/worldEventOverrides";
import * as THREE from "three";

/**
 * Things that happen to the aquarium from time to time, one at a time: a mermaid rests on the floor,
 * a boat passes overhead, a kraken reaches out of the ground, a shark crosses, a sardine school swirls
 * by, an empty sardine can sinks, a baited hook dangles from above, and fish sticks school like fish.
 */
export const worldEventIds = ["mermaid", "boat", "kraken", "shark", "sardines", "sardineCan", "fishingHook", "fishSticks"] as const;
export type WorldEventId = (typeof worldEventIds)[number];

export const worldEventLabels: Record<WorldEventId, string> = {
  mermaid: "Mermaid",
  boat: "Boat overhead",
  kraken: "Kraken",
  shark: "Shark",
  sardines: "Sardine school",
  sardineCan: "Sinking sardine can",
  fishingHook: "Fishing hook",
  fishSticks: "Fish stick school",
};

/** Each change of `nonce` starts the event `id` at once. */
export type WorldEventRequest = { id: WorldEventId; nonce: number };

/** The shortest and longest wait between two events, in seconds. */
const shortestPause = 45;
const longestPause = 90;

type EventProps = {
  seed: number;
  onDone: () => void;
  /**
   * Shows the model held still at this age of the event, at the centre and facing right, the way the
   * creature editor presents it; the event then never ends.
   */
  still?: number;
};

const ease = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
/** How far `age` has come from `from` to `to`, from 0 to 1. */
const phase = (age: number, from: number, to: number) => THREE.MathUtils.clamp((age - from) / (to - from), 0, 1);

function seededUnit(seed: number) {
  const value = Math.sin(seed * 999.13) * 43758.5453;
  return value - Math.floor(value);
}

/** Returns the event's age for a frame, and ends the event once it is `duration` old; a still model keeps its age. */
function useEventAge(duration: number, onDone: () => void, still?: number) {
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);
  return (elapsed: number) => {
    if (still !== undefined) return still;
    startedAt.current ??= elapsed;
    const age = elapsed - startedAt.current;
    if (age >= duration && !done.current) {
      done.current = true;
      onDone();
    }
    return age;
  };
}

/**
 * A bendable limb of tapering segments growing along +y, like a tail or a tentacle. Each segment's
 * group is handed out through `onSegment`, so the owner can bend it every frame.
 */
function SegmentChain({
  count,
  length,
  radius,
  color,
  accent,
  tip,
  onSegment,
  index = 0,
}: {
  count: number;
  length: number;
  radius: number;
  color: string;
  /** A paler spot on every other segment, like a sucker or a scale. */
  accent?: string;
  /** Drawn at the end of the last segment, so it bends along, like a tail fin. */
  tip?: ReactNode;
  onSegment: (index: number, group: THREE.Group | null) => void;
  index?: number;
}) {
  if (index >= count) return null;
  const segmentRadius = radius * (1 - (index / count) * 0.8);
  return (
    <group ref={(group) => onSegment(index, group)} position={[0, index === 0 ? 0 : length, 0]}>
      <mesh position={[0, length / 2, 0]} scale={[segmentRadius, length * 0.62, segmentRadius]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshToonMaterial color={color} />
      </mesh>
      {accent && index % 2 === 1 && (
        <mesh position={[segmentRadius * 0.75, length / 2, segmentRadius * 0.4]} scale={segmentRadius * 0.38}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshToonMaterial color={accent} />
        </mesh>
      )}
      {index === count - 1 && tip && <group position={[0, length, 0]}>{tip}</group>}
      <SegmentChain count={count} length={length} radius={radius} color={color} accent={accent} tip={tip} onSegment={onSegment} index={index + 1} />
    </group>
  );
}

/** A soft round shade, dark in the middle and clear at the rim, for shadows. */
function useSoftShadowTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(0.55, "rgba(0,0,0,0.55)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);
}

const mermaidTailRoot = new THREE.Color("#1fc0ad");
const mermaidTailEnd = new THREE.Color("#0f5f78");
const mermaidBelly = new THREE.Color("#9ff2df");
const mermaidTailLength = 1.45;

/** The mermaid's tail: wide at the hips, tapering to the fin, with a paler belly and a shimmer of scale bands. */
function mermaidTailColor(u: number, up: number) {
  const color = mermaidTailRoot.clone().lerp(mermaidTailEnd, u);
  color.lerp(mermaidBelly, THREE.MathUtils.smoothstep(-up, 0.3, 0.9) * 0.6);
  return color.offsetHSL(0, 0, 0.035 * Math.cos(u * 55));
}

/** A forked fish tail fin, pointing back along -x from where it meets the tail. */
const mermaidFlukeOutline: Array<[number, number]> = [
  [0.02, 0.05], [-0.22, 0.18], [-0.5, 0.4], [-0.58, 0.42], [-0.42, 0.1], [-0.36, 0],
  [-0.42, -0.1], [-0.58, -0.42], [-0.5, -0.4], [-0.22, -0.18], [0.02, -0.05],
];

const mermaidSkin = "#f3c19d";
const mermaidShell = "#8e5fd1";
const mermaidHairRoot = new THREE.Color("#b81f2a");
const mermaidHairTip = new THREE.Color("#f04a3e");

/** A smooth outline through `[u, value]` points, for body profiles. */
function profile(points: Array<[number, number]>) {
  return (u: number) => {
    const next = points.findIndex(([at]) => at >= u);
    if (next <= 0) return points[next === 0 ? 0 : points.length - 1][1];
    const [fromU, from] = points[next - 1];
    const [toU, to] = points[next];
    return THREE.MathUtils.lerp(from, to, THREE.MathUtils.smoothstep(u, fromU, toU));
  };
}

/** Waist, ribs, chest, shoulders and neck, from the hips up; wider across than front to back. */
const mermaidTorsoRadius = profile([[0, 0.112], [0.3, 0.118], [0.58, 0.14], [0.8, 0.145], [0.9, 0.08], [1, 0.05]]);
const mermaidTorsoLength = 0.62;

/** Long strands of hair: where each leaves the head, how long it is, and how it sways. */
const mermaidHairStrands = [
  { y: 0.09, z: 0, length: 1.15, radius: 0.075, phase: 0 },
  { y: 0.05, z: 0.08, length: 1.0, radius: 0.065, phase: 1.1 },
  { y: 0.05, z: -0.08, length: 1.05, radius: 0.065, phase: 2.2 },
  { y: 0.0, z: 0.1, length: 0.85, radius: 0.055, phase: 3.1 },
  { y: 0.0, z: -0.1, length: 0.9, radius: 0.055, phase: 4.4 },
  { y: 0.12, z: 0.04, length: 0.75, radius: 0.05, phase: 5.2 },
];

/** Swims in, sits on the floor for a while with her tail resting on the sand, and swims away. */
function Mermaid({ seed, onDone, still }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const rootRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const flukeRef = useRef<THREE.Mesh>(null);
  const torso = useMemo(() => createBendableBody({ length: mermaidTorsoLength, radius: mermaidTorsoRadius, depthShare: 1.25, rings: 20 }), []);
  const hair = useMemo(() => mermaidHairStrands.map((strand) => createBendableBody({
    length: strand.length,
    radius: (u) => strand.radius * (1 - u * 0.75),
    rings: 18,
    sides: 10,
    colorAt: (u) => mermaidHairRoot.clone().lerp(mermaidHairTip, u),
  })), []);
  const tail = useMemo(() => createBendableBody({
    length: mermaidTailLength,
    radius: (u) => 0.035 + 0.14 * (1 - u) ** 0.85 * (1 + 0.6 * u * (1 - u)),
    colorAt: mermaidTailColor,
  }), []);
  const fluke = useMemo(() => finGeometry(mermaidFlukeOutline, 0.025), []);
  const age = useEventAge(21, onDone, still);
  const plan = useMemo(() => ({ from: seededUnit(seed) < 0.5 ? -1 : 1, seat: (seededUnit(seed * 3) - 0.5) * 0.9 }), [seed]);

  useFrame(({ clock }) => {
    const root = rootRef.current;
    if (!root) return;
    const t = age(clock.elapsedTime);
    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;
    const edge = halfWidth + 3;
    const seatX = plan.seat * halfWidth;
    const seatY = -halfHeight + 0.2;
    const arrive = ease(phase(t, 0, 6.5));
    const depart = ease(phase(t, 15, 21));
    const sit = ease(phase(t, 5.5, 7.5)) * (1 - ease(phase(t, 14, 16)));
    const x = t < 15 ? THREE.MathUtils.lerp(plan.from * edge, seatX, arrive) : THREE.MathUtils.lerp(seatX, -plan.from * edge, depart);
    const y = t < 15 ? THREE.MathUtils.lerp(halfHeight * 0.35, seatY, arrive) : THREE.MathUtils.lerp(seatY, halfHeight * 0.45, depart);
    if (still === undefined) {
      root.position.set(x, y + Math.sin(t * 1.4) * 0.06 * (1 - sit), 0.35);
      // Built facing +x; she keeps swimming the way she came in.
      root.scale.set(-plan.from, 1, 1);
    }
    if (torsoRef.current) torsoRef.current.rotation.z = sit * 1.2;
    // Seated, she tips her head forward to look out over the tank.
    if (headRef.current) headRef.current.rotation.z = -0.15 - sit * 0.35 + Math.sin(t * 0.9) * 0.05;
    // The hair streams behind her while she swims and falls down her back while she sits, always swaying.
    hair.forEach((strand, index) => {
      const sway = mermaidHairStrands[index].phase;
      strand.bend((u) => (0.12 + sit * 0.1) * Math.sin(t * 2.1 - u * 3.4 + sway) * u ** 1.2 - 0.12 * u ** 2);
    });
    // Swimming, a wave runs down the tail and grows towards the fin; seated, the tail lies on the
    // sand, its end curling up and the fin slowly fanning.
    tail.bend((u) => {
      const swimming = 0.22 * Math.sin(t * 4.6 - u * 3.2) * u ** 1.4;
      const resting = 0.28 * u ** 3 + 0.04 * Math.sin(t * 1.5 - u * 3) * u ** 2;
      return THREE.MathUtils.lerp(swimming, resting, sit);
    });
    const end = tail.end();
    flukeRef.current?.position.set(end.x, end.y, 0);
    flukeRef.current?.rotation.set(0, 0, -end.angle);
  });

  return (
    <group ref={rootRef}>
      {/* The tail runs back from the hips along -x, one smooth body that bends, ending in a forked fin. */}
      <group position={[0.05, 0, 0]}>
        <mesh geometry={tail.geometry} name="Mermaid tail">
          <meshToonMaterial vertexColors />
        </mesh>
        <mesh ref={flukeRef} geometry={fluke} name="Mermaid tail fin">
          <meshToonMaterial color="#46e0c8" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Built from the waist up along +x, her front facing -y; seated, the whole upper body turns upright. */}
      <group ref={torsoRef}>
        <mesh geometry={torso.geometry} rotation={[0, 0, Math.PI]} name="Mermaid torso">
          <meshToonMaterial color={mermaidSkin} />
        </mesh>
        {/* A shell top: two scallops on the chest, held by a thin strap. */}
        {[0.065, -0.065].map((side) => (
          <mesh key={side} position={[0.37, -0.128, side]} rotation={[Math.PI, 0, 0]} scale={[0.072, 0.05, 0.066]} name="Shell">
            <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshToonMaterial color={mermaidShell} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh position={[0.4, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1.22, 1, 1]} name="Shell strap">
          <torusGeometry args={[0.142, 0.008, 6, 32]} />
          <meshToonMaterial color={mermaidShell} />
        </mesh>
        {/* Arms hang from the shoulders and bend at the elbow, the hands resting in front of the waist. */}
        {[0.17, -0.17].map((side) => (
          <group key={side} position={[0.5, -0.02, side]} rotation={[0, 0, 2.02]}>
            <mesh position={[0, 0.1, 0]} name="Upper arm">
              <capsuleGeometry args={[0.032, 0.17, 4, 10]} />
              <meshToonMaterial color={mermaidSkin} />
            </mesh>
            <group position={[0, 0.2, 0]} rotation={[0, 0, 0.55]}>
              <mesh position={[0, 0.1, 0]} name="Forearm">
                <capsuleGeometry args={[0.027, 0.16, 4, 10]} />
                <meshToonMaterial color={mermaidSkin} />
              </mesh>
              <mesh position={[0, 0.215, 0]} scale={[0.035, 0.045, 0.025]} name="Hand">
                <sphereGeometry args={[1, 10, 8]} />
                <meshToonMaterial color={mermaidSkin} />
              </mesh>
            </group>
          </group>
        ))}
        {/* The head turns three quarters towards the viewer; its face looks along +x. */}
        <group ref={headRef} position={[mermaidTorsoLength + 0.12, 0, 0]}>
          <group rotation={[0, -0.7, 0]}>
            <mesh scale={[0.15, 0.165, 0.14]} name="Head">
              <sphereGeometry args={[1, 20, 16]} />
              <meshToonMaterial color={mermaidSkin} />
            </mesh>
            {[0.055, -0.055].map((side) => (
              <group key={side} position={[0.125, 0.025, side]}>
                <mesh scale={[0.012, 0.034, 0.028]} name="Eye white">
                  <sphereGeometry args={[1, 12, 10]} />
                  <meshToonMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0.008, -0.004, 0]} scale={[0.008, 0.022, 0.018]} name="Iris">
                  <sphereGeometry args={[1, 10, 8]} />
                  <meshToonMaterial color="#2c9fc7" />
                </mesh>
                <mesh position={[0.013, -0.004, 0]} scale={[0.005, 0.011, 0.009]} name="Pupil">
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshBasicMaterial color="#10161c" />
                </mesh>
                <mesh position={[0.004, 0.05, 0]} rotation={[side > 0 ? 0.25 : -0.25, 0, 0]} scale={[0.006, 0.006, 0.03]} name="Brow">
                  <sphereGeometry args={[1, 6, 6]} />
                  <meshToonMaterial color="#8a2a22" />
                </mesh>
              </group>
            ))}
            <mesh position={[0.152, -0.025, 0]} scale={[0.016, 0.014, 0.012]} name="Nose">
              <sphereGeometry args={[1, 8, 6]} />
              <meshToonMaterial color="#e8a882" />
            </mesh>
            {/* The arc turns to hang below its centre, so it curves up at both ends. */}
            <mesh position={[0.13, -0.075, 0]} rotation={[0, Math.PI / 2, Math.PI * 1.1]} name="Smile">
              <torusGeometry args={[0.03, 0.006, 6, 16, Math.PI * 0.8]} />
              <meshToonMaterial color="#d2334a" />
            </mesh>
            {/* Red hair covers the back of the head, with a full fringe over the forehead. */}
            <mesh position={[-0.01, 0.012, 0]} scale={[0.165, 0.18, 0.158]} name="Hair">
              <sphereGeometry args={[1, 20, 14, -Math.PI / 2, Math.PI, 0, Math.PI]} />
              <meshToonMaterial color="#c9232d" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.07, 0.125, 0.01]} rotation={[0, 0, -0.45]} scale={[0.13, 0.06, 0.15]} name="Fringe">
              <sphereGeometry args={[1, 16, 10]} />
              <meshToonMaterial color="#d72a30" />
            </mesh>
          </group>
          {mermaidHairStrands.map((strand, index) => (
            <mesh key={index} geometry={hair[index].geometry} position={[-0.08, strand.y, strand.z]} rotation={[0, 0, -0.25]} name="Hair strand">
              <meshToonMaterial vertexColors />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** A boat crosses above the tank: its hull, rudder and propeller break through the top, and its shadow falls through the water. */
function Boat({ seed, onDone, still }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const shadowTexture = useSoftShadowTexture();
  const hullRef = useRef<THREE.Group>(null);
  const propellerRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const floorShadowRef = useRef<THREE.Mesh>(null);
  const bubbles = useRef<(THREE.Mesh | null)[]>([]);
  const age = useEventAge(22, onDone, still);
  const direction = seededUnit(seed) < 0.5 ? 1 : -1;

  useFrame(({ clock }) => {
    const t = age(clock.elapsedTime);
    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;
    const edge = halfWidth + 5;
    const x = THREE.MathUtils.lerp(-direction * edge, direction * edge, t / 22);
    if (hullRef.current && still === undefined) {
      hullRef.current.position.set(x, halfHeight + 0.18 + Math.sin(t * 1.6) * 0.04, -0.4);
      hullRef.current.scale.set(direction, 1, 1);
      hullRef.current.rotation.z = Math.sin(t * 1.1) * 0.025;
    }
    if (propellerRef.current) propellerRef.current.rotation.x = t * 14;
    // The shadows only make sense in the tank, so a still model leaves them out.
    if (shadowRef.current) {
      shadowRef.current.visible = still === undefined;
      shadowRef.current.position.set(x, 0, -1.7);
    }
    if (floorShadowRef.current) {
      floorShadowRef.current.visible = still === undefined;
      floorShadowRef.current.position.set(x, -halfHeight + 0.12, 0.2);
    }
    bubbles.current.forEach((bubble, index) => {
      if (!bubble) return;
      const life = (t * 0.9 + index / bubbles.current.length) % 1;
      bubble.position.set(-2.1 - life * 2.4, -0.48 + life * 0.42 + Math.sin(index * 2.3 + t * 3) * 0.05, (index % 3 - 1) * 0.15);
      bubble.scale.setScalar(0.03 + (1 - life) * 0.07);
    });
  });

  return (
    <>
      {/* The shadow reaches down through the water column and lands on the sand. */}
      <mesh ref={shadowRef} scale={[5.5, viewport.height * 1.3, 1]} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTexture} color="#000000" transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <mesh ref={floorShadowRef} scale={[3.4, 0.5, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTexture} color="#000000" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <group ref={hullRef}>
        <mesh scale={[2.7, 0.55, 0.9]}>
          <sphereGeometry args={[1, 24, 14]} />
          <meshToonMaterial color="#7a4a30" />
        </mesh>
        <mesh position={[0, -0.12, 0]} scale={[2.6, 0.45, 0.86]}>
          <sphereGeometry args={[1, 24, 14]} />
          <meshToonMaterial color="#b0342b" />
        </mesh>
        <mesh position={[-2.35, -0.55, 0]}>
          <boxGeometry args={[0.32, 0.55, 0.07]} />
          <meshToonMaterial color="#4a3426" />
        </mesh>
        <group ref={propellerRef} position={[-2.05, -0.45, 0]}>
          {[0, 1, 2].map((blade) => (
            <mesh key={blade} rotation={[(blade * Math.PI * 2) / 3, 0, 0]} position={[0, 0, 0]}>
              <boxGeometry args={[0.04, 0.32, 0.1]} />
              <meshToonMaterial color="#c9b26a" />
            </mesh>
          ))}
        </group>
        {Array.from({ length: 14 }, (_, index) => (
          <mesh key={index} ref={(mesh) => { bubbles.current[index] = mesh; }}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshToonMaterial color="#e8fbff" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** A dark hole opens in the sand; kraken tentacles rise out of it, thrash around and sink back. */
function Kraken({ seed, onDone, still }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const holeRef = useRef<THREE.Group>(null);
  const tentacleRoots = useRef<(THREE.Group | null)[]>([]);
  const segments = useRef<(THREE.Group | null)[][]>(Array.from({ length: 6 }, () => []));
  const age = useEventAge(16, onDone, still);
  const spot = (seededUnit(seed) - 0.5) * 0.8;
  const tentacles = useMemo(() => Array.from({ length: 6 }, (_, index) => ({
    offset: (index / 5 - 0.5) * 1.8,
    depth: (seededUnit(seed + index * 7) - 0.5) * 0.7,
    lean: (index / 5 - 0.5) * 0.9,
    phase: seededUnit(seed + index * 13) * Math.PI * 2,
    speed: 1.6 + seededUnit(seed + index * 17) * 1.4,
  })), [seed]);

  useFrame(({ clock }) => {
    const t = age(clock.elapsedTime);
    const halfWidth = viewport.width / 2;
    const floorY = -viewport.height / 2;
    const open = ease(phase(t, 0, 1.5)) * (1 - ease(phase(t, 14.5, 16)));
    const rise = ease(phase(t, 1.5, 3.5)) * (1 - ease(phase(t, 12, 14.3)));
    const thrash = 0.1 + 0.28 * ease(phase(t, 3.5, 5)) * (1 - ease(phase(t, 10, 12)));
    if (holeRef.current) {
      if (still === undefined) holeRef.current.position.set(spot * halfWidth, floorY + 0.06, 0.3);
      holeRef.current.scale.setScalar(Math.max(0.001, open));
    }
    tentacles.forEach((tentacle, index) => {
      const root = tentacleRoots.current[index];
      if (root) {
        root.scale.setScalar(Math.max(0.001, rise));
        root.rotation.z = tentacle.lean + Math.sin(t * tentacle.speed * 0.5 + tentacle.phase) * thrash * 0.6;
      }
      segments.current[index].forEach((segment, segmentIndex) => {
        if (segment && segmentIndex > 0) {
          segment.rotation.z = Math.sin(t * tentacle.speed - segmentIndex * 0.55 + tentacle.phase) * thrash;
        }
      });
    });
  });

  return (
    <group ref={holeRef}>
      <mesh scale={[1.5, 0.3, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#04080a" />
      </mesh>
      {Array.from({ length: 9 }, (_, index) => {
        const angle = (index / 9) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 1.5, Math.sin(angle) * 0.3, 0.05]} scale={[0.22, 0.13, 0.15]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshToonMaterial color="#6b6157" />
          </mesh>
        );
      })}
      {tentacles.map((tentacle, index) => (
        <group key={index} ref={(group) => { tentacleRoots.current[index] = group; }} position={[tentacle.offset, 0, tentacle.depth]}>
          <SegmentChain count={14} length={0.3} radius={0.17} color="#c2414f" accent="#f3b5a8" onSegment={(segmentIndex, group) => { segments.current[index][segmentIndex] = group; }} />
        </group>
      ))}
    </group>
  );
}

const sharkBack = new THREE.Color("#5c7787");
const sharkBelly = new THREE.Color("#eef3f4");
const sharkLength = 4;
const sharkFin = "#557080";

/** The shark's half height along its body: a pointed snout, a deep chest and a narrow tail stock. */
function sharkRadius(u: number) {
  if (u < 0.3) return 0.05 + 0.43 * Math.sin((u / 0.3) * (Math.PI / 2)) ** 0.7;
  return 0.07 + 0.41 * Math.cos(((u - 0.3) / 0.7) * (Math.PI / 2)) ** 1.1;
}

/** Dark on the back and white on the belly, the line between them running low along the flank. */
function sharkColor(u: number, up: number) {
  return sharkBelly.clone().lerp(sharkBack, THREE.MathUtils.smoothstep(up, -0.2, 0.25)).offsetHSL(0, 0, -0.05 * u);
}

const sharkFins = {
  dorsal: finGeometry([[0.35, 0], [0.12, 0.22], [-0.12, 0.58], [-0.24, 0.62], [-0.28, 0.34], [-0.45, 0]]),
  pectoral: finGeometry([[0.22, 0], [0, -0.12], [-0.42, -0.58], [-0.55, -0.62], [-0.36, -0.24], [-0.2, 0]]),
  small: finGeometry([[0.16, 0], [0.02, 0.14], [-0.1, 0.24], [-0.16, 0.22], [-0.16, 0.1], [-0.24, 0]]),
  // A long upper lobe and a shorter lower one, as on most sharks.
  caudal: finGeometry([
    [0.12, 0.08], [-0.3, 0.42], [-0.86, 0.96], [-0.97, 0.94], [-0.6, 0.32], [-0.45, 0.02],
    [-0.62, -0.44], [-0.56, -0.5], [-0.22, -0.18], [0.12, -0.07],
  ]),
};

/** A big shark glides straight through the tank, beating its tail from side to side. */
function Shark({ seed, onDone, still }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const rootRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const body = useMemo(() => createBendableBody({ length: sharkLength, radius: sharkRadius, depthShare: 0.85, rings: 36, sides: 16, colorAt: sharkColor }), []);
  const age = useEventAge(14, onDone, still);
  const direction = seededUnit(seed) < 0.5 ? 1 : -1;
  const height = (seededUnit(seed * 5) - 0.5) * 0.8;

  useFrame(({ clock }) => {
    const t = age(clock.elapsedTime);
    const edge = viewport.width / 2 + 4.5;
    if (rootRef.current && still === undefined) {
      rootRef.current.position.set(
        THREE.MathUtils.lerp(-direction * edge, direction * edge, t / 14),
        height * viewport.height / 2 + Math.sin(t * 0.9) * 0.15,
        -0.7,
      );
      rootRef.current.scale.set(direction, 1, 1);
      rootRef.current.rotation.z = Math.cos(t * 0.9) * 0.04;
    }
    // A slow wave along the rear of the body carries into the tail, which swings from side to side.
    body.bend((u) => 0.05 * Math.sin(t * 2.2 - u * 3) * u ** 2);
    const end = body.end();
    if (tailRef.current) {
      tailRef.current.position.set(end.x, end.y, 0);
      tailRef.current.rotation.set(0, Math.sin(t * 4.5) * 0.5, -end.angle);
    }
  });

  return (
    <group ref={rootRef}>
      {/* Built from the snout at +x back to the tail at -x. */}
      <group position={[sharkLength / 2, 0, 0]}>
        <mesh geometry={body.geometry} name="Shark body">
          <meshToonMaterial vertexColors />
        </mesh>
        <mesh geometry={sharkFins.dorsal} position={[-1.55, 0.4, 0]} name="First dorsal fin">
          <meshToonMaterial color={sharkFin} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={sharkFins.small} position={[-3.05, 0.18, 0]} name="Second dorsal fin">
          <meshToonMaterial color={sharkFin} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={sharkFins.pectoral} position={[-1.15, -0.28, 0.28]} rotation={[-0.45, 0, 0]} name="Pectoral fin">
          <meshToonMaterial color={sharkFin} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={sharkFins.pectoral} position={[-2.45, -0.26, 0.12]} rotation={[-0.3, 0, 0]} scale={0.42} name="Pelvic fin">
          <meshToonMaterial color={sharkFin} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={sharkFins.small} position={[-3.15, -0.13, 0]} rotation={[Math.PI, 0, 0]} scale={0.8} name="Anal fin">
          <meshToonMaterial color={sharkFin} side={THREE.DoubleSide} />
        </mesh>
        <group ref={tailRef}>
          <mesh geometry={sharkFins.caudal} name="Tail fin">
            <meshToonMaterial color={sharkFin} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <mesh position={[-0.45, 0.12, 0.29]} scale={0.045} name="Eye">
          <sphereGeometry args={[1, 10, 8]} />
          <meshToonMaterial color="#0c1114" />
        </mesh>
        <mesh position={[-0.43, 0.135, 0.33]} scale={0.012} name="Eye glint">
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {[0, 1, 2, 3, 4].map((slit) => (
          <mesh key={slit} position={[-0.92 - slit * 0.07, -0.02, 0.41]} rotation={[0, 0, -0.18]} scale={[0.012, 0.13 - slit * 0.008, 0.02]} name={`Gill slit ${slit + 1}`}>
            <sphereGeometry args={[1, 6, 6]} />
            <meshToonMaterial color="#34444e" />
          </mesh>
        ))}
        <mesh position={[-0.42, -0.17, 0.25]} rotation={[0, 0.35, 0.22]} scale={[0.22, 0.012, 0.02]} name="Mouth">
          <sphereGeometry args={[1, 10, 6]} />
          <meshToonMaterial color="#2a2f33" />
        </mesh>
      </group>
    </group>
  );
}

type SchoolKind = {
  count: number;
  /** Each member's size along its length, height and depth. */
  size: [number, number, number];
  color: string;
  /** How fast members roll about their length; fish keep upright, breaded sticks tumble. */
  roll: number;
  geometry: "fish" | "stick";
};

const sardineSchool: SchoolKind = { count: 140, size: [0.15, 0.045, 0.04], color: "#cfdde6", roll: 0, geometry: "fish" };
const fishStickSchool: SchoolKind = { count: 60, size: [0.17, 0.05, 0.06], color: "#d9932f", roll: 1.6, geometry: "stick" };

/** A school that swirls through the tank as one shape, along a gently rising and falling path. */
function School({ id, seed, onDone, still, kind }: EventProps & { id: WorldEventId; kind: SchoolKind }) {
  const viewport = useThree((state) => state.viewport);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const age = useEventAge(16, onDone, still);
  const direction = seededUnit(seed) < 0.5 ? 1 : -1;
  const members = useMemo(() => Array.from({ length: kind.count }, (_, index) => ({
    radius: 0.35 + seededUnit(seed + index * 3) * 1.2,
    angle: seededUnit(seed + index * 5) * Math.PI * 2,
    depth: (seededUnit(seed + index * 7) - 0.5) * 1.4,
    spin: 1.1 + seededUnit(seed + index * 11) * 0.7,
    roll: seededUnit(seed + index * 13) * Math.PI * 2,
  })), [kind.count, seed]);

  // Every member takes the single member's saved transform, as edited in the creature editor.
  const memberTransform = useRef(new THREE.Matrix4());
  const headingMatrix = useMemo(() => new THREE.Matrix4(), []);
  useEffect(() => {
    const read = () => {
      const saved = loadWorldEventOverrides()[id]?.["mesh-0"];
      if (saved) memberTransform.current.copy(overrideMatrix(saved));
      else memberTransform.current.makeScale(...kind.size);
    };
    read();
    window.addEventListener(worldEventOverridesUpdated, read);
    return () => window.removeEventListener(worldEventOverridesUpdated, read);
  }, [id, kind.size]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || still !== undefined) return;
    const t = age(clock.elapsedTime);
    const edge = viewport.width / 2 + 3.5;
    const speed = (2 * edge) / 16;
    const centerX = THREE.MathUtils.lerp(-direction * edge, direction * edge, t / 16);
    const centerY = Math.sin(t * 0.7 + seed) * viewport.height * 0.15;
    const centerRise = Math.cos(t * 0.7 + seed) * 0.7 * viewport.height * 0.15;
    members.forEach((member, index) => {
      const angle = member.angle + t * member.spin * direction;
      const velocityX = direction * speed - Math.sin(angle) * member.radius * 1.4 * member.spin * direction;
      const velocityY = centerRise + Math.cos(angle) * member.radius * 0.6 * member.spin * direction;
      dummy.position.set(centerX + Math.cos(angle) * member.radius * 1.4, centerY + Math.sin(angle) * member.radius * 0.6, 0.2 + member.depth);
      dummy.rotation.set(kind.roll ? member.roll + t * kind.roll : 0, 0, Math.atan2(velocityY, velocityX), "ZYX");
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, headingMatrix.multiplyMatrices(dummy.matrix, memberTransform.current));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  const geometry = kind.geometry === "fish" ? <sphereGeometry args={[1, 8, 6]} /> : <boxGeometry args={[2, 2, 2]} />;
  // Held still, the school is shown as one member, whose edits every member then takes on.
  if (still !== undefined) {
    return (
      <mesh scale={kind.size}>
        {geometry}
        <meshToonMaterial color={kind.color} />
      </mesh>
    );
  }
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, kind.count]} frustumCulled={false}>
      {geometry}
      <meshToonMaterial color={kind.color} />
    </instancedMesh>
  );
}

/** A silver school of sardines. */
function Sardines(props: EventProps) {
  return <School {...props} id="sardines" kind={sardineSchool} />;
}

/** A school of breaded fish sticks, tumbling as they go, as if they had never been anything else. */
function FishSticks(props: EventProps) {
  return <School {...props} id="fishSticks" kind={fishStickSchool} />;
}

/** A rectangle with rounded corners, centred on the origin, for the tin's outline. */
function roundedRectangle(width: number, depth: number, corner: number, shape = new THREE.Shape()) {
  const x = width / 2;
  const y = depth / 2;
  shape.moveTo(-x + corner, -y);
  shape.lineTo(x - corner, -y);
  shape.quadraticCurveTo(x, -y, x, -y + corner);
  shape.lineTo(x, y - corner);
  shape.quadraticCurveTo(x, y, x - corner, y);
  shape.lineTo(-x + corner, y);
  shape.quadraticCurveTo(-x, y, -x, y - corner);
  shape.lineTo(-x, -y + corner);
  shape.quadraticCurveTo(-x, -y, -x + corner, -y);
  return shape;
}

/** The tin's outline raised to `height`, standing on the xz-plane and centred on y = 0. */
function tinGeometry(width: number, depth: number, corner: number, height: number, hole?: [number, number, number]) {
  const shape = roundedRectangle(width, depth, corner);
  if (hole) shape.holes.push(roundedRectangle(...hole, new THREE.Path() as THREE.Shape));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 8 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height / 2, 0);
  return geometry;
}

const canWidth = 0.95;
const canDepth = 0.5;
const canHeight = 0.22;
const canTin = "#c9ced3";

const sardineCanParts = {
  body: tinGeometry(canWidth, canDepth, 0.17, canHeight),
  label: tinGeometry(canWidth + 0.012, canDepth + 0.012, 0.176, 0.13),
  rim: tinGeometry(canWidth + 0.02, canDepth + 0.02, 0.18, 0.025, [canWidth - 0.06, canDepth - 0.06, 0.14]),
  inside: tinGeometry(canWidth - 0.06, canDepth - 0.06, 0.14, 0.004),
  // The sardine on the label, nose to the right: body, darker back, forked tail, dorsal and pectoral fins.
  fish: finGeometry([[0.17, 0], [0.12, 0.042], [0, 0.056], [-0.12, 0.034], [-0.17, 0.012], [-0.17, -0.012], [-0.12, -0.03], [0, -0.05], [0.12, -0.036]], 0.004),
  fishBack: finGeometry([[0.15, 0.012], [0.1, 0.04], [0, 0.054], [-0.12, 0.032], [-0.16, 0.01], [-0.05, 0.02]], 0.004),
  fishTail: finGeometry([[0.01, 0.012], [-0.05, 0.05], [-0.08, 0.06], [-0.05, 0], [-0.08, -0.06], [-0.05, -0.05], [0.01, -0.012]], 0.004),
  fishDorsal: finGeometry([[0.04, 0], [0, 0.04], [-0.04, 0.042], [-0.06, 0]], 0.004),
  fishPectoral: finGeometry([[0.02, 0], [-0.04, -0.012], [-0.05, -0.03], [-0.01, -0.01]], 0.004),
};

/**
 * An empty, opened sardine can sinks from the surface, rocking as it falls, lands on the sand with a
 * small puff, lies there for a while, and is buried again.
 */
function SardineCan({ seed, onDone, still }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const canRef = useRef<THREE.Group>(null);
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const age = useEventAge(20, onDone, still);
  const spot = (seededUnit(seed) - 0.5) * 1.2;
  const landing = 7;

  useFrame(({ clock }) => {
    const can = canRef.current;
    if (!can) return;
    const t = age(clock.elapsedTime);
    const halfHeight = viewport.height / 2;
    const restY = -halfHeight + 0.14;
    const fall = phase(t, 0, landing);
    // Water slows it: it falls fast at first and gently at the end.
    const fallen = 1 - (1 - fall) ** 2;
    const sway = (1 - fall) * Math.sin(t * 1.8);
    const settle = Math.max(0, 1 - (t - landing) / 1.2);
    const bounce = t > landing ? Math.abs(Math.sin((t - landing) * 6)) * 0.08 * settle : 0;
    const buried = ease(phase(t, 17, 20));
    if (still === undefined) {
      can.position.set(
        spot * viewport.width / 2 + sway * 0.6,
        THREE.MathUtils.lerp(halfHeight + 0.6, restY, fallen) + bounce - buried * 0.6,
        0.6,
      );
    }
    can.rotation.set(sway * 0.5, 0, THREE.MathUtils.lerp(0.9, 0.08, fallen) + sway * 0.3);
    puffs.current.forEach((puff, index) => {
      if (!puff) return;
      const life = phase(t, landing, landing + 2.5);
      const spread = (index / (puffs.current.length - 1) - 0.5) * 2;
      puff.visible = still === undefined && t > landing && life < 1;
      puff.position.set(can.position.x + spread * (0.3 + life * 0.8), restY - 0.05 + life * 0.25 * (1 - Math.abs(spread) * 0.5), 0.7);
      puff.scale.setScalar(0.08 + life * 0.18);
    });
  });

  return (
    <>
      <group ref={canRef}>
        {/* A rounded tin with rolled rims and its label wrapped round the sides. */}
        <mesh geometry={sardineCanParts.body} name="Tin">
          <meshToonMaterial color={canTin} />
        </mesh>
        <mesh geometry={sardineCanParts.label} name="Label">
          <meshToonMaterial color="#2f6fb3" />
        </mesh>
        <mesh geometry={sardineCanParts.rim} position={[0, canHeight / 2, 0]} name="Top rim">
          <meshToonMaterial color="#dfe3e6" />
        </mesh>
        <mesh geometry={sardineCanParts.rim} position={[0, -canHeight / 2, 0]} name="Bottom rim">
          <meshToonMaterial color="#dfe3e6" />
        </mesh>
        {/* Opened and empty: only a dark, oily inside is left under the rim. */}
        <mesh geometry={sardineCanParts.inside} position={[0, canHeight / 2 - 0.006, 0]} name="Empty inside">
          <meshToonMaterial color="#3a3528" />
        </mesh>
        {/* The sardine logo on a yellow badge on the front of the label. */}
        <group position={[-0.02, 0, canDepth / 2 + 0.008]}>
          <mesh scale={[0.25, 0.08, 0.004]} name="Logo badge">
            <sphereGeometry args={[1, 20, 10]} />
            <meshToonMaterial color="#e8c547" />
          </mesh>
          <group position={[0.015, 0, 0.006]}>
            <mesh geometry={sardineCanParts.fishTail} position={[-0.16, 0, 0]} name="Logo tail fin">
              <meshToonMaterial color="#7f98ab" />
            </mesh>
            <mesh geometry={sardineCanParts.fishDorsal} position={[-0.01, 0.048, -0.001]} name="Logo dorsal fin">
              <meshToonMaterial color="#7f98ab" />
            </mesh>
            <mesh geometry={sardineCanParts.fish} name="Logo sardine">
              <meshToonMaterial color="#d3dde5" />
            </mesh>
            <mesh geometry={sardineCanParts.fishBack} position={[0, 0, 0.002]} name="Logo sardine back">
              <meshToonMaterial color="#4f7596" />
            </mesh>
            <mesh geometry={sardineCanParts.fishPectoral} position={[0.06, -0.012, 0.004]} name="Logo pectoral fin">
              <meshToonMaterial color="#7f98ab" />
            </mesh>
            <mesh position={[0.088, 0, 0.004]} rotation={[0, 0, -Math.PI / 2]} name="Logo gill">
              <torusGeometry args={[0.03, 0.003, 4, 12, Math.PI]} />
              <meshToonMaterial color="#4f7596" />
            </mesh>
            <mesh position={[0.125, 0.012, 0.005]} scale={[0.011, 0.011, 0.003]} name="Logo eye">
              <sphereGeometry args={[1, 10, 8]} />
              <meshToonMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.127, 0.012, 0.008]} scale={[0.005, 0.005, 0.002]} name="Logo pupil">
              <sphereGeometry args={[1, 8, 6]} />
              <meshBasicMaterial color="#10161c" />
            </mesh>
          </group>
        </group>
        {/* The lid has been peeled off and rolled up into a scroll at one end, the pull ring still on it. */}
        <group position={[canWidth / 2 - 0.06, canHeight / 2 + 0.07, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} name="Rolled lid">
            <cylinderGeometry args={[0.065, 0.065, canDepth - 0.04, 20, 1, true]} />
            <meshToonMaterial color="#d8dde1" side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} name="Rolled lid, inner turn">
            <cylinderGeometry args={[0.04, 0.04, canDepth - 0.04, 16, 1, true]} />
            <meshToonMaterial color="#9ea5ab" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-0.045, -0.06, 0]} rotation={[0, 0, 0.9]} name="Torn lid edge">
            <boxGeometry args={[0.07, 0.006, canDepth - 0.06]} />
            <meshToonMaterial color="#d8dde1" />
          </mesh>
          <mesh position={[0.075, 0.035, 0]} rotation={[0, 0, -0.5]} name="Pull tab">
            <boxGeometry args={[0.06, 0.012, 0.05]} />
            <meshToonMaterial color="#e1e5e8" />
          </mesh>
          <mesh position={[0.15, 0.08, 0]} rotation={[Math.PI / 2, 0.55, 0]} name="Pull ring">
            <torusGeometry args={[0.065, 0.012, 8, 24]} />
            <meshToonMaterial color="#e1e5e8" />
          </mesh>
        </group>
      </group>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh key={index} ref={(mesh) => { puffs.current[index] = mesh; }} visible={false}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshToonMaterial color="#c9b48a" transparent opacity={0.55} />
        </mesh>
      ))}
    </>
  );
}

/** A fishing line lowers a baited hook into the tank; the worm wriggles, and then the line is yanked back up. */
function FishingHook({ seed, onDone, still }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const hookRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.Mesh>(null);
  const worm = useRef<(THREE.Group | null)[]>([]);
  const age = useEventAge(17, onDone, still);
  const spot = (seededUnit(seed) - 0.5) * 1.3;
  const depth = 0.35 + seededUnit(seed * 3) * 0.3;

  useFrame(({ clock }) => {
    const t = age(clock.elapsedTime);
    const halfHeight = viewport.height / 2;
    const top = halfHeight + 0.3;
    const lowered = ease(phase(t, 0, 4));
    // Pulled up much faster than it came down.
    const yanked = phase(t, 15.6, 17) ** 2;
    const hangY = THREE.MathUtils.lerp(top, halfHeight - depth * viewport.height, lowered) + yanked * (viewport.height + 1);
    const x = still === undefined ? spot * viewport.width / 2 + Math.sin(t * 0.8) * 0.12 : 0;
    const hookY = still === undefined ? hangY + Math.sin(t * 1.3) * 0.08 : 0;
    if (hookRef.current) {
      hookRef.current.position.set(x, hookY, still === undefined ? 0.5 : 0);
      hookRef.current.rotation.z = Math.sin(t * 0.8 + 0.6) * 0.08;
    }
    if (lineRef.current) {
      // A still model shows only the line's last stretch above the hook.
      const length = still === undefined ? Math.max(0.01, top + 2 - hookY) : 1.2;
      lineRef.current.position.set(x, hookY + length / 2, still === undefined ? 0.5 : 0);
      lineRef.current.scale.set(1, length, 1);
    }
    worm.current.forEach((segment, index) => {
      if (segment && index > 0) segment.rotation.z = Math.sin(t * 4.2 - index * 0.8) * 0.45;
    });
  });

  return (
    <>
      <mesh ref={lineRef}>
        <cylinderGeometry args={[0.008, 0.008, 1, 6]} />
        <meshBasicMaterial color="#e8f0ee" transparent opacity={0.7} />
      </mesh>
      <group ref={hookRef}>
        {/* The shank hangs from the line and curves into the barbed bend below. */}
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
          <meshToonMaterial color="#9aa3a8" />
        </mesh>
        <mesh position={[0.11, -0.5, 0]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.11, 0.018, 8, 20, Math.PI * 1.15]} />
          <meshToonMaterial color="#9aa3a8" />
        </mesh>
        <mesh position={[0.22, -0.42, 0]} rotation={[0, 0, -0.5]}>
          <coneGeometry args={[0.03, 0.09, 8]} />
          <meshToonMaterial color="#9aa3a8" />
        </mesh>
        {/* The worm is threaded on the bend and dangles below it, wriggling. */}
        <group position={[0.05, -0.55, 0.03]} rotation={[0, 0, Math.PI]}>
          <SegmentChain
            count={9}
            length={0.09}
            radius={0.045}
            color="#d9707a"
            accent="#b8545f"
            onSegment={(index, group) => { worm.current[index] = group; }}
          />
        </group>
      </group>
    </>
  );
}

const eventComponents: Record<WorldEventId, ComponentType<EventProps>> = {
  mermaid: Mermaid,
  boat: Boat,
  kraken: Kraken,
  shark: Shark,
  sardines: Sardines,
  sardineCan: SardineCan,
  fishingHook: FishingHook,
  fishSticks: FishSticks,
};

/** The moment of each event that the creature editor shows: the mermaid seated, the kraken thrashing, the can at rest. */
export const worldEventStillAges: Record<WorldEventId, number> = {
  mermaid: 10,
  boat: 4,
  kraken: 7,
  shark: 3,
  sardines: 0,
  sardineCan: 12,
  fishingHook: 8,
  fishSticks: 0,
};

/** An event's model, with the transforms saved for it in the creature editor applied. */
export function WorldEventModel({ id, ...props }: EventProps & { id: WorldEventId }) {
  const rootRef = useRef<THREE.Group>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const apply = () => applyWorldEventOverrides(root, id);
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: WorldEventId }>).detail;
      if (!detail?.id || detail.id === id) apply();
    };
    apply();
    window.addEventListener(worldEventOverridesUpdated, handleUpdate);
    return () => window.removeEventListener(worldEventOverridesUpdated, handleUpdate);
  }, [id]);
  const Event = eventComponents[id];
  return (
    <group ref={rootRef}>
      <Event {...props} />
    </group>
  );
}

/**
 * Starts a random world event every `shortestPause` to `longestPause` seconds, and the requested one
 * whenever `request` changes; only one happens at a time, and a request takes over a running one.
 */
export function WorldEvents({ request, pauses = [shortestPause, longestPause] }: {
  request?: WorldEventRequest | null;
  /** The shortest and longest wait between two events, in seconds. */
  pauses?: readonly [number, number];
}) {
  const [active, setActive] = useState<{ id: WorldEventId; seed: number; key: number } | null>(null);
  const nextAt = useRef<number | null>(null);
  const handledNonce = useRef(request?.nonce ?? 0);
  const startedCount = useRef(0);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    const start = (id: WorldEventId) => {
      startedCount.current += 1;
      nextAt.current = null;
      setActive({ id, seed: Math.floor(Math.random() * 1_000_000), key: startedCount.current });
    };
    if (request && request.nonce !== handledNonce.current) {
      handledNonce.current = request.nonce;
      start(request.id);
      return;
    }
    if (active) return;
    nextAt.current ??= elapsed + THREE.MathUtils.lerp(pauses[0], pauses[1], Math.random());
    if (elapsed >= nextAt.current) start(worldEventIds[Math.floor(Math.random() * worldEventIds.length)]);
  });

  if (!active) return null;
  return <WorldEventModel key={active.key} id={active.id} seed={active.seed} onDone={() => setActive(null)} />;
}
