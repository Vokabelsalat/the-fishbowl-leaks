"use client";

import { PerformanceMonitor, type PerformanceMonitorApi } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { AquaticCreatureModel } from "@/components/creature/AquaticCreatureModel";
import { GeometryDetailReducer } from "@/components/creature/GeometryDetailReducer";
import { StaticMeshMerger } from "@/components/creature/StaticMeshMerger";
import { AquariumDioramaPlants } from "@/components/collective/AquariumDioramaPlants";
import { creatureSizeScale, creatureSpeedFactor, creatureSpeedHoldSeconds, type AquaticForm } from "@/lib/creature/aquaticForms";
import { creatureColorPalette } from "@/lib/creature/colorPalettes";
import { creaturePattern, patternForTraitCount } from "@/lib/creature/patterns";
import { creatureProportions } from "@/lib/creature/proportions";
import type { ExhibitionContribution } from "@/types/contribution";
import { collectiveCapacity } from "@/config/visualization";
import { RenderStats, type RenderStatsReport } from "@/components/development/RenderStats";

function seededUnit(seed: number) {
  const value = Math.sin(seed * 999.13) * 43758.5453;
  return value - Math.floor(value);
}

const pairingDistance = 0.65;
const whaleDepth = -5.4;
const whaleScale = 9.5;
const whaleOffscreenMargin = 9.5;
const collectiveFormScale: Record<AquaticForm, number> = {
  fish: 1,
  crab: 1.04,
  jellyfish: 1.24,
  octopus: 1.12,
  turtle: 1.08,
  ray: 1.05,
  starfish: 0.96,
  seahorse: 1.2,
  seal: 1.05,
  shrimp: 0.82,
  narwhal: 1.32,
  dolphin: 1.2,
  whale: whaleScale,
  clam: 1.08,
  pufferfish: 1,
};

const collectiveFormSpeed: Record<AquaticForm, number> = {
  fish: 1.18,
  crab: 0.62,
  jellyfish: 0.68,
  octopus: 0.82,
  turtle: 0.58,
  ray: 1.05,
  starfish: 0.48,
  seahorse: 0.72,
  seal: 1.12,
  shrimp: 0.9,
  narwhal: 0.82,
  dolphin: 1.28,
  whale: 0.46,
  clam: 0.42,
  pufferfish: 1.08,
};

/** The haze's colour, and how much of it covers whatever lies deep enough: what four see-through haze planes used to add up to. */
const hazeColor = "#0b2a33";
const hazeStrength = 0.253;
/** The haze begins at the first depth and is complete at the second, thickening smoothly in between. */
const hazeStartDepth = 1.18;
const hazeFullDepth = -0.92;
const cameraDepth = 10;

const fogMix = "smoothstep( fogNear, fogFar, vFogDepth )";

/**
 * Hazes creatures by their depth while they are drawn, instead of covering the whole screen with
 * see-through planes. The whale veil behind the tank is hazed too, which carries the haze over the backdrop.
 */
function DepthHaze() {
  // three's linear fog fades all the way into its colour; the aquarium's stops at `hazeStrength`, so the
  // whales far behind the tank stay visible. Shaders compiled while it is shown pick this up; the poster's fog does not.
  useLayoutEffect(() => {
    const original = THREE.ShaderChunk.fog_fragment;
    THREE.ShaderChunk.fog_fragment = original.replace(fogMix, `${fogMix} * ${hazeStrength.toFixed(3)}`);
    return () => {
      THREE.ShaderChunk.fog_fragment = original;
    };
  }, []);

  return <fog attach="fog" args={[hazeColor, cameraDepth - hazeStartDepth, cameraDepth - hazeFullDepth]} />;
}

function WhaleDepthVeil() {
  const viewport = useThree((state) => state.viewport);

  return (
    <mesh position={[0, 0, -3.35]} renderOrder={-1}>
      <planeGeometry args={[viewport.width + 2, viewport.height + 2]} />
      <meshBasicMaterial
        color="#071421"
        transparent
        opacity={0.62}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

type CreatureMotion = {
  initialized: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** How far the creature's body reaches from its centre at unit depth scale; 0 until measured, and for whales. */
  radius: number;
};

/** Share of a creature's measured size that counts as its body when creatures keep their distance. */
const collisionBodyShare = 0.8;
/** How quickly overlapping creatures are eased apart, per second. */
const collisionPushRate = 2.6;
/** How strongly a push also turns a creature away, so it swims off instead of being shoved along. */
const collisionSteer = 1.4;

/** A follower's place in its school, relative to the leader and its direction of travel. */
type SchoolPlace = { leaderId: number; along: number; across: number; depth: number };

/** Which creatures swim in formation right now, and who has to rest before schooling again. */
type Schooling = {
  places: Map<number, SchoolPlace>;
  schools: Array<{ memberIds: number[]; endsAt: number }>;
  cooldownUntil: Map<number, number>;
};

/** Same-species creatures this close together may form a school. */
const schoolingRadius = 1.5;
/** Once a school forms, same-species creatures this close swim over to join it. */
const schoolRecruitRadius = 3.5;
/** How often the tank looks for creatures that could school. */
const schoolingCheckSeconds = 1.5;
/** The chance that a cluster that could school actually does, so it happens only from time to time. */
const schoolingChance = 0.35;
const schoolMaxSize = 5;
/** Few schools at a time keep formation swimming an occasional event rather than constant swarming. */
const maxSchoolsAtOnce = 4;

type PairingEvent = {
  parents: [ExhibitionContribution, ExhibitionContribution];
  startedAt: number;
  midpoint: [number, number, number];
  sequence: number;
  babyCreated: boolean;
};

export type CreatureArrival = {
  id: number;
  /** Screen rect of the left arrival area where the aquarium creature begins its descent. */
  rect?: { left: number; top: number; width: number; height: number };
  /** Share of the arrival area the fitted creature fills. */
  fill: number;
};

type ArrivalMotion = {
  startedAt: number;
  fromX: number;
  fromY: number;
  fromScale: number;
};

const arrivalSinkSeconds = 4.2;
const arrivalSettleSeconds = 1.8;
const arrivalDepth = 1;

type BabyCreature = {
  contribution: ExhibitionContribution;
  spawnPosition: [number, number, number];
};

type FloatingCreatureProps = {
  contribution: ExhibitionContribution;
  progress: number;
  actorRegistry?: MutableRefObject<Map<number, MutableRefObject<CreatureMotion>>>;
  pairingRef?: MutableRefObject<PairingEvent | null>;
  schoolingRef?: MutableRefObject<Schooling>;
  juvenile?: boolean;
  spawnPosition?: [number, number, number];
  arrival?: CreatureArrival;
  onSelect?: (contribution: ExhibitionContribution) => void;
  mergeStaticMeshes?: boolean;
  reduceGeometryDetail?: boolean;
  meshQuality?: number;
};

// Re-renders only when its own props change, not whenever a baby joins or the field updates.
const FloatingCreature = memo(function FloatingCreature({
  contribution,
  progress,
  actorRegistry,
  pairingRef,
  schoolingRef,
  juvenile = false,
  spawnPosition,
  arrival,
  onSelect,
  mergeStaticMeshes = false,
  reduceGeometryDetail = false,
  meshQuality = 1,
}: FloatingCreatureProps) {
  const canvas = useThree((state) => state.gl.domElement);
  const swimRef = useRef<THREE.Group>(null);
  const directionRef = useRef<THREE.Group>(null);
  const movementDirection = useRef(new THREE.Vector3());
  const targetOrientation = useRef(new THREE.Quaternion());
  const pitchOrientation = useRef(new THREE.Quaternion());
  const yawAxis = useRef(new THREE.Vector3(0, 1, 0));
  const pitchAxis = useRef(new THREE.Vector3(0, 0, 1));
  const floorOffsetRef = useRef<number | null>(null);
  const arrivalPending = useRef(Boolean(arrival));
  const arrivalMotion = useRef<ArrivalMotion | null>(null);
  const isBottomDweller = contribution.creatureForm === "crab" || contribution.creatureForm === "clam";
  const isWhale = contribution.creatureForm === "whale";
  const formSpeed = collectiveFormSpeed[contribution.creatureForm];
  const placement = useMemo(() => ({
    xUnit: -0.84 + seededUnit(contribution.id * 3) * 1.68,
    yUnit: -0.84 + seededUnit(contribution.id * 5) * 1.68,
    z: isWhale ? whaleDepth - seededUnit(contribution.id * 7) * 0.4 : -1 + seededUnit(contribution.id * 7) * 2,
    depthSpeed: isWhale ? 0 : (0.07 + seededUnit(contribution.id * 11) * 0.17) * formSpeed,
    depthDirection: seededUnit(contribution.id * 23) > 0.5 ? 1 : -1,
    scale: 0.4,
    // Base speeds; the creature's current pace multiplies them while it swims.
    speed: isWhale
      ? 0.34 + seededUnit(contribution.id * 13) * 0.12
      : (0.4 + seededUnit(contribution.id * 13) * 0.14) * formSpeed,
    phase: seededUnit(contribution.id * 17) * Math.PI * 2,
    heading: isWhale
      ? (seededUnit(contribution.id * 19) > 0.5 ? 0 : Math.PI)
      : seededUnit(contribution.id * 19) * Math.PI * 2,
  }), [contribution.id, formSpeed, isWhale]);
  // Every creature changes its pace from time to time, easing between drifting and darting, with a short sprint now and then.
  const pace = useRef({
    factor: creatureSpeedFactor(contribution.publicId),
    target: creatureSpeedFactor(contribution.publicId),
    change: 0,
    nextChangeAt: null as number | null,
  });
  const motion = useRef<CreatureMotion>({
    initialized: false,
    radius: 0,
    x: 0,
    y: 0,
    z: placement.z,
    vx: Math.cos(placement.heading) * placement.speed,
    vy: isBottomDweller || isWhale ? 0 : Math.sin(placement.heading) * placement.speed,
    vz: placement.depthDirection * placement.depthSpeed,
  });
  const previousProgress = useRef(progress);

  const aimTowardVelocity = (vx: number, vy: number, vz: number) => {
    const horizontalSpeed = Math.hypot(vx, vz);
    const yaw = Math.atan2(-vz, vx);
    const pitch = THREE.MathUtils.clamp(
      Math.atan2(vy, Math.max(0.001, horizontalSpeed)),
      -0.68,
      0.68,
    );
    targetOrientation.current.setFromAxisAngle(yawAxis.current, yaw);
    pitchOrientation.current.setFromAxisAngle(pitchAxis.current, pitch);
    targetOrientation.current.multiply(pitchOrientation.current);
  };

  useEffect(() => {
    if (juvenile || !actorRegistry) return;
    const registry = actorRegistry.current;
    registry.set(contribution.id, motion);
    return () => {
      registry.delete(contribution.id);
    };
  }, [actorRegistry, contribution.id, juvenile]);

  useFrame(({ clock, viewport }, delta) => {
    if (!swimRef.current || !directionRef.current) return;
    const elapsed = clock.elapsedTime;
    const state = motion.current;
    const maxX = Math.max(1.6, viewport.width / 2 - 0.9);
    const maxY = Math.max(1.25, viewport.height / 2 - 0.72);
    const whaleTravelEdge = viewport.width / 2 + whaleOffscreenMargin;
    const aquariumFloorY = -viewport.height / 2;
    const backDepth = -1.45;
    const frontDepth = 1.65;
    if (isBottomDweller && floorOffsetRef.current === null) {
      // Measure how far the model reaches below its origin at unit depth scale,
      // so the lowest point can be placed exactly on the aquarium floor.
      swimRef.current.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(directionRef.current);
      const worldScale = swimRef.current.getWorldScale(new THREE.Vector3()).y || 1;
      const originY = swimRef.current.getWorldPosition(new THREE.Vector3()).y;
      if (!bounds.isEmpty()) floorOffsetRef.current = (originY - bounds.min.y) / worldScale;
    }
    const depthScaleAt = (z: number) => THREE.MathUtils.lerp(
      0.72,
      1.24,
      THREE.MathUtils.smoothstep(THREE.MathUtils.inverseLerp(backDepth, frontDepth, z), 0, 1),
    );
    const floorYAt = (z: number) => aquariumFloorY + (floorOffsetRef.current ?? 0.3) * depthScaleAt(z);
    const floorY = floorYAt(state.z);
    const turnZone = 0.48;

    if (!state.initialized || progress < previousProgress.current - 0.025) {
      state.x = isWhale
        ? placement.xUnit * whaleTravelEdge
        : spawnPosition?.[0] ?? placement.xUnit * maxX;
      state.y = isBottomDweller
        ? floorY
        : spawnPosition?.[1] ?? placement.yUnit * maxY * (isWhale ? 0.72 : 1);
      state.z = spawnPosition?.[2] ?? placement.z;
      state.initialized = true;

      if (arrivalPending.current) {
        // Begin in the left arrival area, then shrink and sink into the tank.
        arrivalPending.current = false;
        swimRef.current.position.set(0, 0, 0);
        swimRef.current.scale.setScalar(1);
        // Show the creature unturned at first; it turns toward its heading once it swims.
        directionRef.current.quaternion.identity();
        swimRef.current.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(directionRef.current);
        const canvasRect = canvas.getBoundingClientRect();
        const origin = arrival?.rect;
        const naturalScale = depthScaleAt(isWhale ? state.z : arrivalDepth);
        let fromX = state.x;
        let fromY = state.y;
        let fromScale = naturalScale * 0.3;
        if (origin && !bounds.isEmpty() && canvasRect.width > 0) {
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const pixelsPerUnit = canvasRect.width / viewport.width;
          const fittedWidth = Math.min(origin.width, origin.height * (size.x / Math.max(size.y, 0.001))) * arrival.fill;
          fromScale = fittedWidth / (Math.max(size.x, 0.001) * pixelsPerUnit);
          const centerX = ((origin.left + origin.width / 2 - canvasRect.left) / canvasRect.width - 0.5) * viewport.width;
          const centerY = (0.5 - (origin.top + origin.height / 2 - canvasRect.top) / canvasRect.height) * viewport.height;
          fromX = centerX - center.x * fromScale;
          fromY = centerY - center.y * fromScale;
        }
        if (!isWhale) {
          state.z = arrivalDepth;
          state.x = THREE.MathUtils.clamp(fromX, -maxX, maxX);
          state.y = isBottomDweller
            ? floorYAt(state.z)
            : THREE.MathUtils.clamp(fromY - 1.2, -maxY * 0.85, maxY * 0.85);
        }
        arrivalMotion.current = { startedAt: elapsed, fromX, fromY, fromScale };
      }
    }
    previousProgress.current = progress;

    const arrivalAge = arrivalMotion.current ? elapsed - arrivalMotion.current.startedAt : Infinity;
    if (arrivalMotion.current && arrivalAge < arrivalSinkSeconds) {
      const { fromX, fromY, fromScale } = arrivalMotion.current;
      const t = arrivalAge / arrivalSinkSeconds;
      const ease = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      // Interpolate scale geometrically so the shrink reads as an even recession.
      const scale = fromScale * (depthScaleAt(state.z) / fromScale) ** ease;
      swimRef.current.position.set(
        THREE.MathUtils.lerp(fromX, state.x, ease),
        THREE.MathUtils.lerp(fromY, state.y, ease),
        state.z,
      );
      swimRef.current.scale.setScalar(scale);
      return;
    }
    const settle = THREE.MathUtils.smoothstep(arrivalAge - arrivalSinkSeconds, 0, arrivalSettleSeconds);

    if (!isWhale && state.x > maxX - turnZone && state.vx > 0) state.vx = -Math.abs(state.vx);
    if (!isWhale && state.x < -maxX + turnZone && state.vx < 0) state.vx = Math.abs(state.vx);
    if (!isBottomDweller && !isWhale) {
      if (state.y > maxY - turnZone && state.vy > 0) state.vy = -Math.max(0.12, Math.abs(state.vy));
      if (state.y < -maxY + turnZone && state.vy < 0) state.vy = Math.max(0.12, Math.abs(state.vy));
    }

    const currentPace = pace.current;
    currentPace.nextChangeAt ??= elapsed + creatureSpeedHoldSeconds(contribution.publicId, 0);
    if (elapsed >= currentPace.nextChangeAt) {
      currentPace.change += 1;
      currentPace.target = creatureSpeedFactor(contribution.publicId, currentPace.change);
      currentPace.nextChangeAt = elapsed + creatureSpeedHoldSeconds(contribution.publicId, currentPace.change);
    }
    // Speeding up and slowing down take a couple of seconds rather than a jump; bursts kick in quicker.
    const paceEasing = currentPace.target > currentPace.factor + 1 ? 2.6 : 0.9;
    currentPace.factor = THREE.MathUtils.damp(currentPace.factor, currentPace.target, paceEasing, delta);
    // Whales stay slow travellers, so their pace only nudges them.
    const paceFactor = isWhale ? Math.sqrt(currentPace.factor) : currentPace.factor;
    const swimSpeed = placement.speed * paceFactor;
    const isPairing = Boolean(pairingRef?.current?.parents.some((parent) => parent.id === contribution.id));
    if (!isPairing && state.vz !== 0) state.vz = Math.sign(state.vz) * placement.depthSpeed * paceFactor;

    const turn = isBottomDweller || isWhale ? 0 : Math.sin(elapsed * 0.34 + placement.phase) * 0.12 * delta;
    const previousVx = state.vx;
    state.vx = previousVx * Math.cos(turn) - state.vy * Math.sin(turn);
    state.vy = isBottomDweller || isWhale ? 0 : previousVx * Math.sin(turn) + state.vy * Math.cos(turn);
    const currentSpeed = Math.hypot(state.vx, state.vy) || swimSpeed;
    state.vx = (state.vx / currentSpeed) * swimSpeed;
    state.vy = (state.vy / currentSpeed) * swimSpeed;

    movementDirection.current.set(state.vx, state.vy, state.vz).normalize();
    aimTowardVelocity(state.vx, state.vy, state.vz);
    const facingError = directionRef.current.quaternion.angleTo(targetOrientation.current);
    const forwardMotion = THREE.MathUtils.smoothstep(Math.PI / 2 - facingError, 0, Math.PI / 2) * settle;
    state.x += state.vx * delta * forwardMotion;
    if (isWhale) {
      if (state.x > whaleTravelEdge) state.x = -whaleTravelEdge;
      if (state.x < -whaleTravelEdge) state.x = whaleTravelEdge;
      state.y += Math.sin(elapsed * 0.17 + placement.phase) * 0.018 * delta;
    } else {
      state.y = isBottomDweller ? floorY : state.y + state.vy * delta * forwardMotion;
    }
    state.z += state.vz * delta * forwardMotion;
    if (!isWhale) {
      if (state.z >= frontDepth) {
        state.z = frontDepth;
        state.vz = -Math.abs(state.vz);
      } else if (state.z <= backDepth) {
        state.z = backDepth;
        state.vz = Math.abs(state.vz);
      }
    }
    if (!isWhale) state.x = THREE.MathUtils.clamp(state.x, -maxX, maxX);
    if (!isBottomDweller) state.y = THREE.MathUtils.clamp(state.y, -maxY, maxY);

    // Measure the body once, so creatures can keep their distance. Whales pass far behind everyone.
    if (!isWhale && state.radius === 0) {
      const bounds = new THREE.Box3().setFromObject(directionRef.current);
      const worldScale = swimRef.current.getWorldScale(new THREE.Vector3()).x || 1;
      if (!bounds.isEmpty()) {
        const [, middle, largest] = bounds.getSize(new THREE.Vector3()).toArray().sort((a, b) => a - b);
        state.radius = ((middle + largest) / 4 / worldScale) * collisionBodyShare;
      }
    }

    // A school follower takes its place behind the leader and matches its course.
    const schoolPlace = schoolingRef?.current.places.get(contribution.id);
    const leader = schoolPlace && schoolPlace.leaderId !== contribution.id
      ? actorRegistry?.current.get(schoolPlace.leaderId)?.current
      : undefined;
    if (schoolPlace && leader?.initialized) {
      const leaderSpeed = Math.hypot(leader.vx, leader.vy);
      const headingX = leaderSpeed > 0.0001 ? leader.vx / leaderSpeed : 1;
      const headingY = leaderSpeed > 0.0001 ? leader.vy / leaderSpeed : 0;
      const targetX = leader.x + headingX * schoolPlace.along - headingY * schoolPlace.across;
      const targetY = leader.y + headingY * schoolPlace.along + headingX * schoolPlace.across;
      const targetZ = THREE.MathUtils.clamp(leader.z + schoolPlace.depth, backDepth, frontDepth);
      // Ease towards the place, but no faster than a quick swim, so joiners hurry over visibly.
      const follow = 1 - Math.exp(-1.4 * delta);
      let stepX = (targetX - state.x) * follow;
      let stepY = isBottomDweller ? 0 : (targetY - state.y) * follow;
      let stepZ = (targetZ - state.z) * follow;
      const step = Math.hypot(stepX, stepY, stepZ);
      const maxStep = Math.max(swimSpeed, 0.2) * 2.2 * delta;
      if (step > maxStep) {
        stepX *= maxStep / step;
        stepY *= maxStep / step;
        stepZ *= maxStep / step;
      }
      state.x += stepX;
      state.y += stepY;
      state.z += stepZ;
      state.vx = THREE.MathUtils.damp(state.vx, leader.vx, 4, delta);
      if (!isBottomDweller) state.vy = THREE.MathUtils.damp(state.vy, leader.vy, 4, delta);
    }

    // Creatures that bump into each other drift apart. The heavier one barely gives way, so big
    // animals shoulder small ones aside. Schools and pairing couples swim close on purpose.
    if (!isPairing && state.radius > 0 && actorRegistry) {
      const ownScale = depthScaleAt(state.z);
      const ownMass = (state.radius * ownScale) ** 3;
      for (const [otherId, otherMotion] of actorRegistry.current) {
        const other = otherMotion.current;
        if (otherId === contribution.id || !other.initialized || other.radius === 0) continue;
        const otherPlace = schoolPlace && schoolingRef?.current.places.get(otherId);
        if (otherPlace && otherPlace.leaderId === schoolPlace.leaderId) continue;
        const dx = state.x - other.x;
        const dy = state.y - other.y;
        const dz = state.z - other.z;
        const otherRadius = other.radius * depthScaleAt(other.z);
        const reach = state.radius * ownScale + otherRadius;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq >= reach * reach) continue;
        const distance = Math.sqrt(distanceSq);
        // Creatures in exactly the same spot part along a direction their ids settle on.
        const away = distance > 0.0001
          ? movementDirection.current.set(dx / distance, dy / distance, dz / distance)
          : movementDirection.current.set(contribution.id < otherId ? 1 : -1, 0, 0);
        const otherMass = otherRadius ** 3;
        const giveWay = otherMass / (ownMass + otherMass);
        const push = (reach - distance) * giveWay;
        const ease = 1 - Math.exp(-collisionPushRate * delta);
        state.x += away.x * push * ease;
        if (!isBottomDweller) state.y += away.y * push * ease;
        state.z += away.z * push * ease;
        state.vx += away.x * push * collisionSteer * delta * swimSpeed;
        if (!isBottomDweller) state.vy += away.y * push * collisionSteer * delta * swimSpeed;
        if (state.vz !== 0 && Math.sign(state.vz) !== Math.sign(away.z) && Math.abs(away.z) > 0.5) state.vz = -state.vz;
      }
      state.x = THREE.MathUtils.clamp(state.x, -maxX, maxX);
      if (!isBottomDweller) state.y = THREE.MathUtils.clamp(state.y, -maxY, maxY);
      state.z = THREE.MathUtils.clamp(state.z, backDepth, frontDepth);
    }

    const pairing = pairingRef?.current;
    const participantIndex = pairing?.parents.findIndex((parent) => parent.id === contribution.id) ?? -1;
    if (pairing && participantIndex >= 0) {
      const age = elapsed - pairing.startedAt;
      const side = participantIndex === 0 ? -1 : 1;
      let targetX = pairing.midpoint[0] + side * 0.34;
      let targetY = pairing.midpoint[1];
      let targetZ = pairing.midpoint[2];

      if (age >= 4) {
        const orbitAge = age - 4;
        const radius = age < 7 ? 0.34 : 0.34 + (age - 7) * 0.24;
        // Begin the orbit on the same side as the approach target so neither
        // creature snaps across its partner when the dance starts.
        const angle = orbitAge * 1.75 + (participantIndex === 0 ? Math.PI : 0);
        targetX = pairing.midpoint[0] + Math.cos(angle) * radius;
        targetZ = pairing.midpoint[2] + Math.sin(angle) * radius * 0.72;
        if (!isBottomDweller) targetY = pairing.midpoint[1] + Math.sin(angle * 0.7) * 0.16;
      }

      movementDirection.current.set(
        targetX - state.x,
        isBottomDweller ? 0 : targetY - state.y,
        targetZ - state.z,
      );
      if (movementDirection.current.lengthSq() > 0.000001) {
        movementDirection.current.normalize();
      } else {
        movementDirection.current.set(state.vx, state.vy, state.vz).normalize();
      }
      aimTowardVelocity(
        movementDirection.current.x,
        movementDirection.current.y,
        movementDirection.current.z,
      );
      const pairingFacingError = directionRef.current.quaternion.angleTo(targetOrientation.current);
      const pairingForwardMotion = THREE.MathUtils.smoothstep(
        Math.PI / 2 - pairingFacingError,
        0,
        Math.PI / 2,
      );
      const follow = (1 - Math.exp(-(age < 4 ? 1.35 : 3.2) * delta)) * pairingForwardMotion;
      state.x = THREE.MathUtils.lerp(state.x, targetX, follow);
      state.y = isBottomDweller ? floorY : THREE.MathUtils.lerp(state.y, targetY, follow);
      state.z = THREE.MathUtils.lerp(state.z, targetZ, follow);
      const targetVx = movementDirection.current.x * swimSpeed;
      const targetVy = movementDirection.current.y * swimSpeed;
      const targetVz = movementDirection.current.z * swimSpeed;
      state.vx = THREE.MathUtils.damp(state.vx, targetVx, 7, delta);
      state.vy = isBottomDweller ? 0 : THREE.MathUtils.damp(state.vy, targetVy, 7, delta);
      state.vz = THREE.MathUtils.damp(state.vz, targetVz, 7, delta);
    }

    if (isBottomDweller) state.y = floorYAt(state.z);
    swimRef.current.position.x = state.x;
    swimRef.current.position.y = state.y;
    swimRef.current.position.z = state.z;
    const depthScale = depthScaleAt(state.z);
    swimRef.current.scale.setScalar(depthScale);
    movementDirection.current.set(state.vx, state.vy, state.vz).normalize();
    aimTowardVelocity(state.vx, state.vy, state.vz);
    directionRef.current.quaternion.slerp(
      targetOrientation.current,
      1 - Math.exp(-2.5 * delta),
    );
  });

  // An arriving creature starts large in the left column, so it keeps full detail until it settles.
  const isShownLarge = useCallback((elapsed: number) => {
    if (arrivalPending.current) return true;
    const arrivalStart = arrivalMotion.current?.startedAt;
    return arrivalStart !== undefined && elapsed - arrivalStart < arrivalSinkSeconds + arrivalSettleSeconds;
  }, []);

  const startsFacingLeft = Math.cos(placement.heading) < 0;
  const formScale = collectiveFormScale[contribution.creatureForm];
  const individualScale = creatureSizeScale(contribution.publicId) * (juvenile ? 0.48 : 1);
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onSelect || juvenile) return;
    event.stopPropagation();
    onSelect(contribution);
  };

  return (
    <group
      ref={swimRef}
      position={[0, 0, placement.z]}
      onClick={handleClick}
      onPointerEnter={(event) => {
        if (!onSelect || juvenile) return;
        event.stopPropagation();
        canvas.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        if (!onSelect || juvenile) return;
        canvas.style.cursor = "default";
      }}
    >
      <group ref={directionRef} rotation={[0, startsFacingLeft ? Math.PI : 0, 0]}>
        <StaticMeshMerger enabled={mergeStaticMeshes}>
          <GeometryDetailReducer enabled={reduceGeometryDetail} quality={meshQuality} isHeld={isShownLarge}>
            <AquaticCreatureModel
              form={contribution.creatureForm}
              pieces={contribution.parts}
              baseSeed={contribution.publicId}
              colorPalette={contribution.creaturePalette}
            pattern={patternForTraitCount(contribution.creaturePattern, contribution.parts.length)}
            proportions={contribution.creatureProportions}
              scale={placement.scale * formScale * individualScale}
              animated
              grounded={isBottomDweller}
            />
          </GeometryDetailReducer>
        </StaticMeshMerger>
      </group>
    </group>
  );
});

function PairingDirector({
  contributions,
  actorRegistry,
  pairingRef,
  schoolingRef,
  onBaby,
}: {
  contributions: ExhibitionContribution[];
  actorRegistry: MutableRefObject<Map<number, MutableRefObject<CreatureMotion>>>;
  pairingRef: MutableRefObject<PairingEvent | null>;
  schoolingRef: MutableRefObject<Schooling>;
  onBaby: (event: PairingEvent) => void;
}) {
  const lastPairAt = useRef(0);
  const sequence = useRef(0);
  const eligiblePairs = useMemo(() => {
    const byForm = new Map<AquaticForm, ExhibitionContribution[]>();
    contributions.forEach((contribution) => {
      if (contribution.creatureForm === "whale") return;
      const group = byForm.get(contribution.creatureForm) ?? [];
      group.push(contribution);
      byForm.set(contribution.creatureForm, group);
    });
    return [...byForm.values()].filter((group) => group.length >= 2);
  }, [contributions]);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    const activePairing = pairingRef.current;

    if (activePairing) {
      const age = elapsed - activePairing.startedAt;
      if (age >= 6.6 && !activePairing.babyCreated) {
        activePairing.babyCreated = true;
        onBaby(activePairing);
      }
      if (age >= 8.5) {
        pairingRef.current = null;
        lastPairAt.current = elapsed;
      }
      return;
    }

    if (elapsed - lastPairAt.current < 12 || eligiblePairs.length === 0) return;
    let chanceEncounter: {
      first: ExhibitionContribution;
      second: ExhibitionContribution;
      firstMotion: CreatureMotion;
      secondMotion: CreatureMotion;
    } | null = null;

    for (const group of eligiblePairs) {
      for (let firstIndex = 0; firstIndex < group.length - 1; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < group.length; secondIndex += 1) {
          const first = group[firstIndex];
          const second = group[secondIndex];
          // Creatures swimming in formation are busy.
          if (schoolingRef.current.places.has(first.id) || schoolingRef.current.places.has(second.id)) continue;
          const firstMotion = actorRegistry.current.get(first.id)?.current;
          const secondMotion = actorRegistry.current.get(second.id)?.current;
          if (!firstMotion?.initialized || !secondMotion?.initialized) continue;

          const distance = Math.hypot(
            firstMotion.x - secondMotion.x,
            firstMotion.y - secondMotion.y,
            firstMotion.z - secondMotion.z,
          );
          if (distance <= pairingDistance) {
            chanceEncounter = { first, second, firstMotion, secondMotion };
            break;
          }
        }
        if (chanceEncounter) break;
      }
      if (chanceEncounter) break;
    }

    if (!chanceEncounter) return;
    const { first, second, firstMotion, secondMotion } = chanceEncounter;

    pairingRef.current = {
      parents: [first, second],
      startedAt: elapsed,
      midpoint: [
        (firstMotion.x + secondMotion.x) / 2,
        (firstMotion.y + secondMotion.y) / 2,
        (firstMotion.z + secondMotion.z) / 2,
      ],
      sequence: sequence.current,
      babyCreated: false,
    };
    sequence.current += 1;
  });

  return null;
}

/**
 * From time to time lets nearby creatures of the same species swim in formation: one leads, the
 * others line up behind it in a V (or single file along the floor). After a school breaks up,
 * its members rest for a while before they can school again.
 */
function SchoolingDirector({
  contributions,
  actorRegistry,
  pairingRef,
  schoolingRef,
}: {
  contributions: ExhibitionContribution[];
  actorRegistry: MutableRefObject<Map<number, MutableRefObject<CreatureMotion>>>;
  pairingRef: MutableRefObject<PairingEvent | null>;
  schoolingRef: MutableRefObject<Schooling>;
}) {
  const nextCheckAt = useRef(0);
  const candidates = useMemo(
    () => contributions.filter((contribution) => contribution.creatureForm !== "whale"),
    [contributions],
  );

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (elapsed < nextCheckAt.current) return;
    nextCheckAt.current = elapsed + schoolingCheckSeconds;
    const schooling = schoolingRef.current;

    // Break up schools whose time is over, and let their members rest.
    schooling.schools = schooling.schools.filter((school) => {
      const leaving = elapsed >= school.endsAt || !actorRegistry.current.has(school.memberIds[0]);
      if (!leaving) return true;
      school.memberIds.forEach((id) => {
        schooling.places.delete(id);
        schooling.cooldownUntil.set(id, elapsed + 35 + Math.random() * 25);
      });
      return false;
    });

    const pairingIds = new Set(pairingRef.current?.parents.map((parent) => parent.id));
    const available = candidates.flatMap((contribution) => {
      const motion = actorRegistry.current.get(contribution.id)?.current;
      const resting = (schooling.cooldownUntil.get(contribution.id) ?? 0) > elapsed;
      if (!motion?.initialized || resting || schooling.places.has(contribution.id) || pairingIds.has(contribution.id)) return [];
      return [{ contribution, motion }];
    });

    // At most one new school per check, so schools form one after another.
    if (schooling.schools.length >= maxSchoolsAtOnce) return;
    if (Math.random() > schoolingChance) return;
    // A school starts where two of a kind meet; the one with the most of its kind around leads,
    // and calls the nearest of them over, so schools grow beyond the pair that met.
    const gatherings = available.flatMap((leader) => {
      const kin = available
        .filter((other) =>
          other.contribution.id !== leader.contribution.id &&
          other.contribution.creatureForm === leader.contribution.creatureForm)
        .map((other) => ({
          ...other,
          distance: Math.hypot(other.motion.x - leader.motion.x, other.motion.y - leader.motion.y, other.motion.z - leader.motion.z),
        }))
        .filter((other) => other.distance <= schoolRecruitRadius)
        .sort((a, b) => a.distance - b.distance);
      return kin.length > 0 && kin[0].distance <= schoolingRadius ? [{ leader, kin }] : [];
    });
    if (gatherings.length === 0) return;
    const mostKin = Math.max(...gatherings.map((gathering) => gathering.kin.length));
    const largest = gatherings.filter((gathering) => gathering.kin.length === mostKin);
    const { leader, kin } = largest[Math.floor(Math.random() * largest.length)];
    const neighbours = kin.slice(0, schoolMaxSize - 1);

    const onFloor = leader.contribution.creatureForm === "crab" || leader.contribution.creatureForm === "clam";
    const memberIds = [leader.contribution.id, ...neighbours.map((neighbour) => neighbour.contribution.id)];
    schooling.places.set(leader.contribution.id, { leaderId: leader.contribution.id, along: 0, across: 0, depth: 0 });
    neighbours.forEach((neighbour, index) => {
      const row = Math.ceil((index + 1) / 2);
      const side = index % 2 === 0 ? 1 : -1;
      schooling.places.set(neighbour.contribution.id, onFloor
        ? { leaderId: leader.contribution.id, along: -0.6 * (index + 1), across: 0, depth: 0 }
        : { leaderId: leader.contribution.id, along: -0.65 * row, across: side * 0.42 * row, depth: side * 0.15 * row });
    });
    schooling.schools.push({ memberIds, endsAt: elapsed + 10 + Math.random() * 6 });
  });

  return null;
}

function PairingHeart({ pairingRef }: { pairingRef: MutableRefObject<PairingEvent | null> }) {
  const heartRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const activeSequence = useRef<number | null>(null);
  const appearedAt = useRef(0);
  const origin = useRef<[number, number, number]>([0, 0, 0]);
  const shape = useMemo(() => {
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.3);
    heart.bezierCurveTo(-0.08, -0.2, -0.45, 0.02, -0.45, 0.3);
    heart.bezierCurveTo(-0.45, 0.62, -0.08, 0.72, 0, 0.46);
    heart.bezierCurveTo(0.08, 0.72, 0.45, 0.62, 0.45, 0.3);
    heart.bezierCurveTo(0.45, 0.02, 0.08, -0.2, 0, -0.3);
    return heart;
  }, []);

  useFrame(({ clock }) => {
    const heart = heartRef.current;
    const material = materialRef.current;
    if (!heart || !material) return;

    const pairing = pairingRef.current;
    if (pairing && pairing.sequence !== activeSequence.current) {
      activeSequence.current = pairing.sequence;
      appearedAt.current = clock.elapsedTime;
      origin.current = pairing.midpoint;
      heart.visible = true;
    }

    const age = clock.elapsedTime - appearedAt.current;
    if (activeSequence.current === null || age >= 2.4) {
      heart.visible = false;
      return;
    }

    const rise = THREE.MathUtils.smoothstep(age, 0, 2.4);
    const pop = Math.min(1, age / 0.22);
    const dissolve = 1 - THREE.MathUtils.smoothstep(age, 0.8, 2.4);
    heart.position.set(
      origin.current[0] + Math.sin(age * 4.2) * 0.08 * rise,
      origin.current[1] + rise * 1.35,
      3,
    );
    heart.scale.setScalar((0.42 + Math.sin(age * 7) * 0.035) * pop);
    material.opacity = dissolve;
  });

  return (
    <mesh ref={heartRef} visible={false} renderOrder={4}>
      <shapeGeometry args={[shape, 20]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#ef3340"
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function createBaby(event: PairingEvent): BabyCreature {
  const [first, second] = event.parents;
  // Traits are keyed and placed by artifact, so each artifact may be inherited only once.
  // When the preferred trait is taken, the next unused one from either parent stands in;
  // the first parent's own traits are all distinct, so one is always left.
  const inheritedIds = new Set<string>();
  const inheritedParts = first.parts.map((part, index) => {
    const preferred = index % 2 === 0
      ? [part]
      : [second.parts.find((candidate) => candidate.partId === part.partId), second.parts[index % second.parts.length], part];
    const inherited = [...preferred, ...second.parts, ...first.parts].find(
      (candidate) => candidate && !inheritedIds.has(candidate.artifactId),
    )!;
    inheritedIds.add(inherited.artifactId);
    return inherited;
  });
  const id = 1_000_000 + event.sequence;
  const publicId = `offspring-${first.publicId}-${second.publicId}-${event.sequence}`;

  return {
    contribution: {
      id,
      publicId,
      creatureForm: first.creatureForm,
      creaturePalette: creatureColorPalette(publicId),
      creaturePattern: creaturePattern(publicId),
      creatureProportions: creatureProportions(publicId),
      parts: inheritedParts,
      narrative: [],
      createdAt: new Date().toISOString(),
    },
    spawnPosition: event.midpoint,
  };
}

/** The sharpest the aquarium renders, in device pixels per CSS pixel, on screens that have that many. */
const sharpestPixelRatio = 1.35;
/** How far the resolution may drop while frames come too slowly, as a share of the sharpest. */
const lowestResolutionShare = 0.6;

/** The pixel ratio for a performance factor from 0 (struggling) to 1 (comfortable), in steps of 0.05. */
function pixelRatioFor(factor: number) {
  const sharpest = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio, sharpestPixelRatio);
  return Math.round(sharpest * THREE.MathUtils.lerp(lowestResolutionShare, 1, factor) * 20) / 20;
}

export function CollectiveCreatureField({
  contributions,
  progress = 1,
  arrival,
  onSelectContribution,
  onRenderStats,
  mergeStaticMeshes = false,
  reduceGeometryDetail = false,
  meshQuality = 1,
}: {
  contributions: ExhibitionContribution[];
  progress?: number;
  arrival?: CreatureArrival | null;
  onSelectContribution?: (contribution: ExhibitionContribution) => void;
  /** When set, receives the frame rate and mesh counts twice a second. */
  onRenderStats?: (report: RenderStatsReport) => void;
  /** Merges each creature's still parts into a few meshes to save draw calls. */
  mergeStaticMeshes?: boolean;
  /** Builds rounded shapes with only as many segments as their size on screen needs. */
  reduceGeometryDetail?: boolean;
  /** The share of their full segments the creatures' rounded shapes keep, from 0.1 to 1. */
  meshQuality?: number;
}) {
  const [babies, setBabies] = useState<BabyCreature[]>([]);
  // Starts sharp; the monitor lowers the resolution while the frame rate stays low, and raises it again once it recovers.
  const [pixelRatio, setPixelRatio] = useState(() => pixelRatioFor(1));
  const adjustPixelRatio = useCallback(({ factor }: PerformanceMonitorApi) => setPixelRatio(pixelRatioFor(factor)), []);
  const settleOnLowestPixelRatio = useCallback(() => setPixelRatio(pixelRatioFor(0)), []);
  const actorRegistry = useRef(new Map<number, MutableRefObject<CreatureMotion>>());
  const pairingRef = useRef<PairingEvent | null>(null);
  const schoolingRef = useRef<Schooling>({ places: new Map(), schools: [], cooldownUntil: new Map() });
  const adults = useMemo(() => contributions.slice(-collectiveCapacity), [contributions]);
  const whales = useMemo(
    () => adults.filter((contribution) => contribution.creatureForm === "whale"),
    [adults],
  );
  const tankAdults = useMemo(
    () => adults.filter((contribution) => contribution.creatureForm !== "whale"),
    [adults],
  );
  const handleBaby = useCallback((event: PairingEvent) => {
    setBabies((current) => [...current, createBaby(event)].slice(-8));
  }, []);

  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, cameraDepth], zoom: 82, near: 0.1, far: 30 }}
      dpr={pixelRatio}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
    >
      <PerformanceMonitor factor={1} onChange={adjustPixelRatio} onFallback={settleOnLowestPixelRatio} />
      {onRenderStats && <RenderStats onReport={onRenderStats} />}
      <DepthHaze />
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 5, 8]} intensity={2.4} color="#FFF4DF" />
      <pointLight position={[-5, 1, 5]} intensity={2.2} color="#58D6FF" />
      <pointLight position={[5, -2, 5]} intensity={1.8} color="#FF7557" />
      {whales.map((contribution) => (
        <FloatingCreature
          key={contribution.id}
          contribution={contribution}
          progress={progress}
          mergeStaticMeshes={mergeStaticMeshes}
          reduceGeometryDetail={reduceGeometryDetail}
          meshQuality={meshQuality}
          arrival={arrival?.id === contribution.id ? arrival : undefined}
          onSelect={onSelectContribution}
        />
      ))}
      <WhaleDepthVeil />
      <AquariumDioramaPlants layer="back" />
      <PairingDirector
        contributions={tankAdults}
        actorRegistry={actorRegistry}
        pairingRef={pairingRef}
        schoolingRef={schoolingRef}
        onBaby={handleBaby}
      />
      <SchoolingDirector
        contributions={tankAdults}
        actorRegistry={actorRegistry}
        pairingRef={pairingRef}
        schoolingRef={schoolingRef}
      />
      <PairingHeart pairingRef={pairingRef} />
      {tankAdults.map((contribution) => (
        <FloatingCreature
          key={contribution.id}
          contribution={contribution}
          progress={progress}
          mergeStaticMeshes={mergeStaticMeshes}
          reduceGeometryDetail={reduceGeometryDetail}
          meshQuality={meshQuality}
          actorRegistry={actorRegistry}
          pairingRef={pairingRef}
          schoolingRef={schoolingRef}
          arrival={arrival?.id === contribution.id ? arrival : undefined}
          onSelect={onSelectContribution}
        />
      ))}
      {babies.map((baby) => (
        <FloatingCreature
          key={baby.contribution.id}
          contribution={baby.contribution}
          progress={progress}
          mergeStaticMeshes={mergeStaticMeshes}
          reduceGeometryDetail={reduceGeometryDetail}
          meshQuality={meshQuality}
          juvenile
          spawnPosition={baby.spawnPosition}
        />
      ))}
      <AquariumDioramaPlants layer="front" />
    </Canvas>
  );
}
