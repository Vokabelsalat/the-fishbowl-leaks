"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
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
const shortestPause = 90;
const longestPause = 240;

type EventProps = { seed: number; onDone: () => void };

const ease = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
/** How far `age` has come from `from` to `to`, from 0 to 1. */
const phase = (age: number, from: number, to: number) => THREE.MathUtils.clamp((age - from) / (to - from), 0, 1);

function seededUnit(seed: number) {
  const value = Math.sin(seed * 999.13) * 43758.5453;
  return value - Math.floor(value);
}

/** Returns the event's age for a frame, and ends the event once it is `duration` old. */
function useEventAge(duration: number, onDone: () => void) {
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);
  return (elapsed: number) => {
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

const mermaidTail = ["#1fb5a5", "#1aa39a", "#178f8f", "#147a84", "#11667a", "#0f5a70"];

/** Swims in, sits on the floor for a while with her tail resting on the sand, and swims away. */
function Mermaid({ seed, onDone }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const rootRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const hairRef = useRef<THREE.Group>(null);
  const tail = useRef<(THREE.Group | null)[]>([]);
  const age = useEventAge(21, onDone);
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
    root.position.set(x, y + Math.sin(t * 1.4) * 0.06 * (1 - sit), 0.35);
    // Built facing +x; she keeps swimming the way she came in.
    root.scale.set(-plan.from, 1, 1);
    if (torsoRef.current) torsoRef.current.rotation.z = sit * 1.2;
    if (hairRef.current) hairRef.current.rotation.z = Math.sin(t * 1.8) * 0.12 - sit * 0.5;
    const amplitude = THREE.MathUtils.lerp(0.32, 0.08, sit);
    const speed = THREE.MathUtils.lerp(5, 1.5, sit);
    tail.current.forEach((segment, index) => {
      if (segment) segment.rotation.z = Math.sin(t * speed - index * 0.7) * amplitude;
    });
  });

  return (
    <group ref={rootRef}>
      {/* The tail runs back from the hips, along -x, and ends in a fin that opens to both sides. */}
      <group rotation={[0, 0, Math.PI / 2]}>
        <SegmentChain
          count={6}
          length={0.26}
          radius={0.17}
          color={mermaidTail[2]}
          accent={mermaidTail[0]}
          onSegment={(index, group) => { tail.current[index] = group; }}
          tip={[0.6, -0.6].map((spread) => (
            <mesh key={spread} rotation={[0, 0, spread]} position={[spread * 0.2, 0.16, 0]} scale={[0.08, 0.26, 0.05]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshToonMaterial color="#46e0c8" />
            </mesh>
          ))}
        />
      </group>
      <group ref={torsoRef}>
        <mesh position={[0.28, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <capsuleGeometry args={[0.13, 0.36, 6, 12]} />
          <meshToonMaterial color="#f0b993" />
        </mesh>
        <mesh position={[0.36, -0.1, 0.07]} scale={0.07}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshToonMaterial color="#b46ad8" />
        </mesh>
        <mesh position={[0.36, -0.1, -0.07]} scale={0.07}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshToonMaterial color="#b46ad8" />
        </mesh>
        <mesh position={[0.32, -0.12, 0.13]} rotation={[0, 0, -1.9]}>
          <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
          <meshToonMaterial color="#f0b993" />
        </mesh>
        <mesh position={[0.66, 0.02, 0]} scale={0.15}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshToonMaterial color="#f0b993" />
        </mesh>
        <mesh position={[0.74, 0.05, 0.12]} scale={0.022}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshToonMaterial color="#1c2430" />
        </mesh>
        <group ref={hairRef} position={[0.62, 0.08, 0]}>
          {[0.1, 0, -0.1].map((lift, index) => (
            <mesh key={lift} position={[-0.22 - index * 0.04, lift, (index - 1) * 0.05]} rotation={[0, 0, 0.15 - index * 0.15]} scale={[0.32, 0.07, 0.07]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshToonMaterial color="#e0465f" />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** A boat crosses above the tank: its hull, rudder and propeller break through the top, and its shadow falls through the water. */
function Boat({ seed, onDone }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const shadowTexture = useSoftShadowTexture();
  const hullRef = useRef<THREE.Group>(null);
  const propellerRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const floorShadowRef = useRef<THREE.Mesh>(null);
  const bubbles = useRef<(THREE.Mesh | null)[]>([]);
  const age = useEventAge(22, onDone);
  const direction = seededUnit(seed) < 0.5 ? 1 : -1;

  useFrame(({ clock }) => {
    const t = age(clock.elapsedTime);
    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;
    const edge = halfWidth + 5;
    const x = THREE.MathUtils.lerp(-direction * edge, direction * edge, t / 22);
    if (hullRef.current) {
      hullRef.current.position.set(x, halfHeight + 0.18 + Math.sin(t * 1.6) * 0.04, -0.4);
      hullRef.current.scale.set(direction, 1, 1);
      hullRef.current.rotation.z = Math.sin(t * 1.1) * 0.025;
    }
    if (propellerRef.current) propellerRef.current.rotation.x = t * 14;
    if (shadowRef.current) shadowRef.current.position.set(x, 0, -1.7);
    if (floorShadowRef.current) floorShadowRef.current.position.set(x, -halfHeight + 0.12, 0.2);
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
function Kraken({ seed, onDone }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const holeRef = useRef<THREE.Group>(null);
  const tentacleRoots = useRef<(THREE.Group | null)[]>([]);
  const segments = useRef<(THREE.Group | null)[][]>(Array.from({ length: 6 }, () => []));
  const age = useEventAge(16, onDone);
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
      holeRef.current.position.set(spot * halfWidth, floorY + 0.06, 0.3);
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

/** A big shark glides straight through the tank. */
function Shark({ seed, onDone }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const rootRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const age = useEventAge(14, onDone);
  const direction = seededUnit(seed) < 0.5 ? 1 : -1;
  const height = (seededUnit(seed * 5) - 0.5) * 0.8;

  useFrame(({ clock }) => {
    const t = age(clock.elapsedTime);
    const edge = viewport.width / 2 + 4.5;
    if (rootRef.current) {
      rootRef.current.position.set(
        THREE.MathUtils.lerp(-direction * edge, direction * edge, t / 14),
        height * viewport.height / 2 + Math.sin(t * 0.9) * 0.15,
        -0.7,
      );
      rootRef.current.scale.set(direction, 1, 1);
      rootRef.current.rotation.z = Math.cos(t * 0.9) * 0.04;
    }
    if (tailRef.current) tailRef.current.rotation.z = Math.sin(t * 4.5) * 0.18;
  });

  return (
    <group ref={rootRef} scale={1}>
      <mesh scale={[2, 0.42, 0.42]}>
        <sphereGeometry args={[1, 28, 16]} />
        <meshToonMaterial color="#6f8796" />
      </mesh>
      <mesh position={[0.1, -0.13, 0]} scale={[1.85, 0.3, 0.38]}>
        <sphereGeometry args={[1, 28, 16]} />
        <meshToonMaterial color="#e3ebee" />
      </mesh>
      <mesh position={[0.05, 0.55, 0]} rotation={[0, 0, -0.45]} scale={[1, 1, 0.22]}>
        <coneGeometry args={[0.32, 0.75, 16]} />
        <meshToonMaterial color="#5c7381" />
      </mesh>
      <mesh position={[0.65, -0.4, 0.2]} rotation={[0.4, 0, 2.3]} scale={[1, 1, 0.22]}>
        <coneGeometry args={[0.18, 0.6, 12]} />
        <meshToonMaterial color="#5c7381" />
      </mesh>
      <mesh position={[1.45, 0.1, 0.32]} scale={0.05}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshToonMaterial color="#10161a" />
      </mesh>
      {[0.95, 1.05, 1.15].map((gillX) => (
        <mesh key={gillX} position={[gillX, -0.02, 0.38]} scale={[0.012, 0.15, 0.02]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshToonMaterial color="#3d4d57" />
        </mesh>
      ))}
      <group ref={tailRef} position={[-1.85, 0, 0]}>
        <mesh position={[-0.35, 0.38, 0]} rotation={[0, 0, 0.75]} scale={[1, 1, 0.2]}>
          <coneGeometry args={[0.22, 0.95, 14]} />
          <meshToonMaterial color="#5c7381" />
        </mesh>
        <mesh position={[-0.28, -0.25, 0]} rotation={[0, 0, 2.3]} scale={[1, 1, 0.2]}>
          <coneGeometry args={[0.17, 0.6, 14]} />
          <meshToonMaterial color="#5c7381" />
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
function School({ seed, onDone, kind }: EventProps & { kind: SchoolKind }) {
  const viewport = useThree((state) => state.viewport);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const age = useEventAge(16, onDone);
  const direction = seededUnit(seed) < 0.5 ? 1 : -1;
  const members = useMemo(() => Array.from({ length: kind.count }, (_, index) => ({
    radius: 0.35 + seededUnit(seed + index * 3) * 1.2,
    angle: seededUnit(seed + index * 5) * Math.PI * 2,
    depth: (seededUnit(seed + index * 7) - 0.5) * 1.4,
    spin: 1.1 + seededUnit(seed + index * 11) * 0.7,
    roll: seededUnit(seed + index * 13) * Math.PI * 2,
  })), [kind.count, seed]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
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
      dummy.scale.set(...kind.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, kind.count]} frustumCulled={false}>
      {kind.geometry === "fish" ? <sphereGeometry args={[1, 8, 6]} /> : <boxGeometry args={[2, 2, 2]} />}
      <meshToonMaterial color={kind.color} />
    </instancedMesh>
  );
}

/** A silver school of sardines. */
function Sardines(props: EventProps) {
  return <School {...props} kind={sardineSchool} />;
}

/** A school of breaded fish sticks, tumbling as they go, as if they had never been anything else. */
function FishSticks(props: EventProps) {
  return <School {...props} kind={fishStickSchool} />;
}

/**
 * An empty, opened sardine can sinks from the surface, rocking as it falls, lands on the sand with a
 * small puff, lies there for a while, and is buried again.
 */
function SardineCan({ seed, onDone }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const canRef = useRef<THREE.Group>(null);
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const age = useEventAge(20, onDone);
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
    can.position.set(
      spot * viewport.width / 2 + sway * 0.6,
      THREE.MathUtils.lerp(halfHeight + 0.6, restY, fallen) + bounce - buried * 0.6,
      0.6,
    );
    can.rotation.set(sway * 0.5, 0, THREE.MathUtils.lerp(0.9, 0.08, fallen) + sway * 0.3);
    puffs.current.forEach((puff, index) => {
      if (!puff) return;
      const life = phase(t, landing, landing + 2.5);
      const spread = (index / (puffs.current.length - 1) - 0.5) * 2;
      puff.visible = t > landing && life < 1;
      puff.position.set(can.position.x + spread * (0.3 + life * 0.8), restY - 0.05 + life * 0.25 * (1 - Math.abs(spread) * 0.5), 0.7);
      puff.scale.setScalar(0.08 + life * 0.18);
    });
  });

  return (
    <>
      <group ref={canRef}>
        {/* A rounded tin, its label wrapped round the middle, opened at the top with the lid rolled back. */}
        <mesh>
          <boxGeometry args={[0.95, 0.24, 0.5]} />
          <meshToonMaterial color="#c9ced3" />
        </mesh>
        <mesh>
          <boxGeometry args={[0.6, 0.25, 0.51]} />
          <meshToonMaterial color="#2f6fb3" />
        </mesh>
        <mesh position={[0, 0, 0.26]} scale={[0.16, 0.05, 0.01]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshToonMaterial color="#e8c547" />
        </mesh>
        <mesh position={[0, 0.125, 0]}>
          <boxGeometry args={[0.85, 0.01, 0.42]} />
          <meshToonMaterial color="#3b3f44" />
        </mesh>
        <mesh position={[0.48, 0.2, 0]} rotation={[Math.PI / 2, 0, Math.PI]}>
          <torusGeometry args={[0.1, 0.022, 8, 20, Math.PI * 1.6]} />
          <meshToonMaterial color="#d8dde1" />
        </mesh>
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
function FishingHook({ seed, onDone }: EventProps) {
  const viewport = useThree((state) => state.viewport);
  const hookRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.Mesh>(null);
  const worm = useRef<(THREE.Group | null)[]>([]);
  const age = useEventAge(17, onDone);
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
    const x = spot * viewport.width / 2 + Math.sin(t * 0.8) * 0.12;
    const hookY = hangY + Math.sin(t * 1.3) * 0.08;
    if (hookRef.current) {
      hookRef.current.position.set(x, hookY, 0.5);
      hookRef.current.rotation.z = Math.sin(t * 0.8 + 0.6) * 0.08;
    }
    if (lineRef.current) {
      const length = Math.max(0.01, top + 2 - hookY);
      lineRef.current.position.set(x, hookY + length / 2, 0.5);
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

/**
 * Starts a random world event every `shortestPause` to `longestPause` seconds, and the requested one
 * whenever `request` changes; only one happens at a time, and a request takes over a running one.
 */
export function WorldEvents({ request }: { request?: WorldEventRequest | null }) {
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
    nextAt.current ??= elapsed + THREE.MathUtils.lerp(shortestPause, longestPause, Math.random());
    if (elapsed >= nextAt.current) start(worldEventIds[Math.floor(Math.random() * worldEventIds.length)]);
  });

  if (!active) return null;
  const Event = eventComponents[active.id];
  return <Event key={active.key} seed={active.seed} onDone={() => setActive(null)} />;
}
