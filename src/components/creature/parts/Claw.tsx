"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { withDetailRecipe } from "@/lib/creature/geometryDetail";

type Vector3Tuple = [number, number, number];

export type ClawPose = {
  /** Raise of the arm from the shoulder, in radians. */
  shoulder?: number;
  /** How far the arm arches between shoulder and wrist, in radians. */
  elbow?: number;
  /** Tilt of the pincer against the end of the arm, in radians. */
  wrist?: number;
  /** Swing of the whole arm toward the viewer (negative) or away from it. */
  yaw?: number;
};

export type ClawProps = {
  /** 1 builds a right claw reaching along +x, -1 mirrors it into a left claw. */
  side?: 1 | -1;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: number;
  /** The whole claw: arm, knuckles, palm and fingers. */
  color: string;
  /** Length of the arm relative to the pincer. */
  reach?: number;
  /** Size of the palm and fingers relative to the arm. */
  pincerSize?: number;
  pose?: ClawPose;
  animated?: boolean;
  /** Offset in pinch cycles, so claws on one creature do not snap in unison. */
  phase?: number;
  /** Pinch cycles per second. */
  pinchSpeed?: number;
  /** How far the movable finger opens, in radians. */
  maxOpen?: number;
  /** Strength of the idle arm sway, 0 keeps the arm still while it pinches. */
  sway?: number;
  /** When set, the claw uses a lit, glowing material like creature traits instead of toon shading. */
  glow?: number;
};

const defaultPose: Required<ClawPose> = { shoulder: 0.5, elbow: 0.75, wrist: -0.55, yaw: 0 };

function easeInOutSine(value: number) {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

/**
 * One pinch: the finger parts slowly, hesitates, snaps shut and rebounds.
 * `open` runs from 0 (closed) to 1 (fully open); `recoil` is the jolt the snap sends up the arm.
 */
export function pinchCycle(cycle: number) {
  const progress = cycle - Math.floor(cycle);
  if (progress < 0.45) return { open: easeInOutSine(progress / 0.45), recoil: 0 };
  if (progress < 0.62) {
    const hold = (progress - 0.45) / 0.17;
    return { open: 1 - Math.sin(hold * Math.PI * 3) * 0.04, recoil: 0 };
  }
  if (progress < 0.68) {
    const snap = (progress - 0.62) / 0.06;
    return { open: 1 - snap * snap * snap, recoil: 0 };
  }
  const after = (progress - 0.68) / 0.32;
  const damping = Math.exp(-after * 6);
  return {
    open: Math.max(0, Math.sin(after * Math.PI * 3) * damping * 0.18),
    recoil: Math.sin(after * Math.PI * 2) * damping,
  };
}

function ClawSurface({ color, glow }: { color: string; glow?: number }) {
  if (glow === undefined) return <meshToonMaterial color={color} />;
  return (
    <meshToonMaterial
      color={color}
      emissive={color}
      emissiveIntensity={glow}
    />
  );
}

// The finger lies along +x and hooks toward +y at its tip, where the opposite finger sits.
function fingerShape(length: number, width: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -width / 2);
  shape.quadraticCurveTo(length * 0.62, -width * 0.72, length, width * 0.38);
  shape.quadraticCurveTo(length * 0.52, width * 0.12, 0, width / 2);
  shape.closePath();
  return shape;
}

/** `detail` scales the curve and bevel segments, for claws shown small. */
function fingerGeometry(length: number, width: number, detail = 1) {
  const depth = width * 0.7;
  const extruded = new THREE.ExtrudeGeometry(fingerShape(length, width), {
    depth,
    steps: 1,
    curveSegments: Math.max(3, Math.round(14 * detail)),
    bevelEnabled: true,
    bevelThickness: depth * 0.35,
    bevelSize: width * 0.16,
    bevelSegments: Math.max(1, Math.round(3 * detail)),
  });
  extruded.translate(0, 0, -depth / 2);
  return extruded;
}

function ClawFinger({ length, width, color, glow }: { length: number; width: number; color: string; glow?: number }) {
  const geometry = useMemo(
    () => withDetailRecipe(14, (detail) => fingerGeometry(length, width, detail)),
    [length, width],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <ClawSurface color={color} glow={glow} />
    </mesh>
  );
}

/**
 * A crustacean claw: an arched arm and a pincer whose movable finger opens and snaps shut.
 * Its origin is the shoulder, where the arm's open end can sink into any body.
 */
export function Claw({
  side = 1,
  position,
  rotation,
  scale = 1,
  color,
  reach = 1,
  pincerSize = 1,
  pose,
  animated = true,
  phase = 0,
  pinchSpeed = 0.45,
  maxOpen = 0.75,
  sway = 1,
  glow,
}: ClawProps) {
  const shoulderRef = useRef<THREE.Group>(null);
  const wristRef = useRef<THREE.Group>(null);
  const movableFingerRef = useRef<THREE.Group>(null);
  const fixedFingerRef = useRef<THREE.Group>(null);
  const resting = { ...defaultPose, ...pose };
  const closedAngle = -0.1;
  const armRadius = 0.065;

  // The arm leaves the shoulder along +x and curves by the elbow angle toward the wrist.
  const upperArm = 0.38 * reach;
  const forearm = 0.28 * reach;
  const wrist = useMemo(
    () => new THREE.Vector3(upperArm + forearm * Math.cos(resting.elbow), forearm * Math.sin(resting.elbow), 0),
    [forearm, resting.elbow, upperArm],
  );
  const armGeometry = useMemo(() => {
    const arc = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(upperArm, 0, 0), wrist);
    return new THREE.TubeGeometry(arc, 20, armRadius, 10, false);
  }, [upperArm, wrist]);

  useEffect(() => () => armGeometry.dispose(), [armGeometry]);

  // The pincer continues in the direction the arm arrives at the wrist.
  const wristAngle = resting.elbow + resting.wrist;

  useFrame(({ clock }) => {
    if (!animated) return;
    const time = clock.elapsedTime;
    const swing = phase * Math.PI * 2;
    const { open, recoil } = pinchCycle(time * pinchSpeed + phase);
    if (shoulderRef.current) shoulderRef.current.rotation.z = resting.shoulder + Math.sin(time * 1.7 + swing) * 0.14 * sway;
    if (wristRef.current) wristRef.current.rotation.z = wristAngle + Math.sin(time * 2.1 + swing) * 0.06 * sway + open * 0.1 + recoil * 0.12;
    if (movableFingerRef.current) movableFingerRef.current.rotation.z = closedAngle + open * maxOpen;
    if (fixedFingerRef.current) fixedFingerRef.current.rotation.z = -open * maxOpen * 0.12;
  });

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group scale={[side, 1, 1]}>
        <group ref={shoulderRef} rotation={[0, resting.yaw, resting.shoulder]}>
          <mesh geometry={armGeometry}>
            <ClawSurface color={color} glow={glow} />
          </mesh>
          <group ref={wristRef} position={wrist} rotation={[0, 0, wristAngle]}>
            <group scale={pincerSize}>
              <mesh position={[0.2, 0.01, 0]} scale={[0.27, 0.19, 0.15]}>
                <sphereGeometry args={[1, 20, 14]} />
                <ClawSurface color={color} glow={glow} />
              </mesh>
              <group ref={fixedFingerRef} position={[0.38, -0.06, 0]}>
                <ClawFinger length={0.3} width={0.11} color={color} glow={glow} />
              </group>
              <group ref={movableFingerRef} position={[0.34, 0.08, 0]} rotation={[0, 0, closedAngle + (animated ? 0 : maxOpen * 0.25)]}>
                <group scale={[1, -1, 1]}>
                  <ClawFinger length={0.33} width={0.1} color={color} glow={glow} />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
