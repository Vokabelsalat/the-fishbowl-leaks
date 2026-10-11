"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { aquaticPalette, TraitMarks } from "@/components/creature/AquaticModelShared";
import type { AquaticModelProps } from "@/components/creature/AquaticCreatureModel";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import { PatternedToonMaterial } from "@/components/creature/CreaturePatternMaterial";
import { BodyAttachment, BodyProportions } from "@/components/creature/CreatureLook";
import { dorsalFinStyleFor, pectoralFinStyleFor } from "@/components/creature/CreatureModel";
import { withDetailRecipe } from "@/lib/creature/geometryDetail";

type AdditionalForm = Exclude<AquaticForm, "fish" | "crab" | "jellyfish" | "octopus">;

function LivingGroup({
  children,
  animated,
  scale,
  motion = "glide",
  position = [0, 0, 0],
  grounded = false,
}: {
  children: ReactNode;
  animated?: boolean;
  scale: number;
  motion?: "glide" | "bob" | "coil" | "pulse";
  position?: [number, number, number];
  grounded?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (animated === false || !ref.current) return;
    const time = clock.elapsedTime;
    ref.current.position.y = grounded ? position[1] : position[1] + Math.sin(time * (motion === "bob" ? 1.45 : 0.85)) * (motion === "bob" ? 0.09 : 0.045);
    ref.current.rotation.z = Math.sin(time * (motion === "coil" ? 1.35 : 0.62)) * (motion === "coil" ? 0.075 : 0.035);
    if (motion === "pulse") {
      const breath = 1 + Math.sin(time * 1.6) * 0.035;
      ref.current.scale.set(scale * breath, scale * breath, scale);
    }
  });

  return <group ref={ref} scale={scale} position={position}>{children}</group>;
}

function MovingPart({ children, animated, phase, base = 0, amount = 0.1, speed = 1.2 }: { children: ReactNode; animated?: boolean; phase: number; base?: number; amount?: number; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (animated === false || !ref.current) return;
    ref.current.rotation.z = base + Math.sin(clock.elapsedTime * speed + phase) * amount;
  });
  return <group ref={ref} rotation={[0, 0, base]}>{children}</group>;
}

/**
 * A limb that rests where it would after turning `angle` around the creature's centre, but
 * paddles around `pivot`, its root on the body, so it stays attached while it moves. `center`
 * and `pivot` are given before that turn.
 */
function PivotedPart({ center, pivot, angle, animated, phase, amount, speed, children }: { center: Point3; pivot: Point3; angle: number; animated?: boolean; phase: number; amount: number; speed: number; children: ReactNode }) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const root: Point3 = [pivot[0] * cos - pivot[1] * sin, pivot[0] * sin + pivot[1] * cos, pivot[2]];
  return (
    <group position={root}>
      <MovingPart animated={animated} phase={phase} base={angle} amount={amount} speed={speed}>
        <group position={[center[0] - pivot[0], center[1] - pivot[1], center[2] - pivot[2]]}>{children}</group>
      </MovingPart>
    </group>
  );
}

function MovingPupil({ position, scale, animated, phase = 0, range = [0.035, 0.025] }: { position: [number, number, number]; scale: number | [number, number, number]; animated?: boolean; phase?: number; range?: [number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (animated === false || !ref.current) return;
    ref.current.position.x = position[0] + Math.sin(clock.elapsedTime * 0.65 + phase) * range[0];
    ref.current.position.y = position[1] + Math.cos(clock.elapsedTime * 0.52 + phase) * range[1];
  });
  return <mesh ref={ref} position={position} scale={scale}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#071015" /></mesh>;
}

type Point3 = [number, number, number];

/**
 * How far toward the viewer the skin of an ellipsoid body part sits above (x, y), or null when
 * (x, y) lies outside it. `rotationZ` is the part's own turn in the xy plane.
 */
function ellipsoidSkinZ(center: Point3, radii: Point3, x: number, y: number, rotationZ = 0) {
  const dx = x - center[0];
  const dy = y - center[1];
  const along = dx * Math.cos(rotationZ) + dy * Math.sin(rotationZ);
  const across = -dx * Math.sin(rotationZ) + dy * Math.cos(rotationZ);
  const inside = 1 - (along / radii[0]) ** 2 - (across / radii[1]) ** 2;
  return inside > 0 ? center[2] + radii[2] * Math.sqrt(inside) : null;
}

function CartoonEye({ position, animated, phase }: { position: Point3; animated?: boolean; phase: number }) {
  return (
    <group position={position}>
      <mesh scale={[0.12, 0.15, 0.08]}>
        <sphereGeometry args={[1, 14, 12]} />
        <meshToonMaterial color="#F3F0E8" />
      </mesh>
      <MovingPupil position={[0, 0, 0.075]} scale={[0.045, 0.07, 0.03]} animated={animated} phase={phase} />
    </group>
  );
}

function PairOfEyes({ x = 0.34, y = 0.25, z = 0.55, animated }: { x?: number; y?: number; z?: number; animated?: boolean }) {
  return [-1, 1].map((side) => <CartoonEye key={side} position={[side * x, y, z]} animated={animated} phase={side * 0.2} />);
}

const turtleShellTop = { center: [0, 0.03, 0.24] as Point3, radii: [0.92 * 0.92, 0.58 * 0.92, 0.18 * 0.92] as Point3 };
const turtleHead = { center: [1.12, 0.02, 0] as Point3, radii: [0.46 * 0.75, 0.38 * 0.75, 0.34 * 0.75] as Point3 };

function TurtleModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  return (
    <LivingGroup animated={props.animated} scale={props.scale}>
      <BodyProportions>
        <mesh scale={[1.18, 0.78, 0.38]}>
          <sphereGeometry args={[0.9, 20, 14]} />
          <meshToonMaterial color={colors.dark} />
        </mesh>
        <mesh position={[0, 0.03, 0.24]} scale={[0.92, 0.58, 0.18]}>
          <sphereGeometry args={[0.92, 20, 14]} />
          <PatternedToonMaterial color={colors.body} />
        </mesh>
        {[0.46, 0.8].map((ring, index) => (
          // Each ring lies on the domed shell at the height the dome has that far out.
          <mesh key={ring} position={[0, 0.03, (ellipsoidSkinZ(turtleShellTop.center, turtleShellTop.radii, ring * 0.85, 0.03) ?? 0) + 0.002]} scale={[ring * 1.18, ring * 0.78, 0.06]}>
            <torusGeometry args={[0.72, 0.035 + index * 0.01, 7, 24]} />
            <meshToonMaterial color={colors.light} />
          </mesh>
        ))}
      </BodyProportions>
      <mesh position={turtleHead.center} scale={[0.46, 0.38, 0.34]}>
        <sphereGeometry args={[0.75, 20, 14]} />
        <meshToonMaterial color={colors.light} />
      </mesh>
      {/* Both eyes sit on the near side of the head, half sunk into its skin. */}
      {[1.16, 1.33].map((x, index) => (
        <group key={x} position={[x, 0.12, (ellipsoidSkinZ(turtleHead.center, turtleHead.radii, x, 0.12) ?? 0) - 0.02]} scale={0.7}>
          <CartoonEye position={[0, 0, 0]} animated={props.animated} phase={index ? 0.2 : -0.2} />
        </group>
      ))}
      {[-1, 1].flatMap((side) => [-1, 1].map((front) => (
        <PivotedPart
          key={`${side}-${front}`}
          center={[front * 0.62, side * 0.68, -0.02]}
          pivot={[front * 0.16, side * 0.68, -0.02]}
          angle={side * (front > 0 ? -0.58 : 0.58)}
          animated={props.animated}
          phase={side * 0.8 + front}
          amount={0.12}
          speed={1.45}
        >
          <mesh scale={[0.48, 0.2, 0.09]}><sphereGeometry args={[1, 18, 12]} /><meshToonMaterial color={colors.accent} /></mesh>
        </PivotedPart>
      )))}
      <mesh position={[-1.15, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.2, 0.34, 0.12]}>
        <coneGeometry args={[1, 1, 12]} />
        <meshToonMaterial color={colors.light} />
      </mesh>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="turtle" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

/** Gill slits lie on the pale underside where it bulges out, and on the disc beyond it. */
function rayGillZ(x: number, y: number) {
  const belly = ellipsoidSkinZ([0.42, 0, 0.1], [0.92 * 0.92, 0.92 * 0.54, 0.92 * 0.16], x, y) ?? 0;
  return Math.max(belly, 0.14) + 0.004;
}

/** The ray's eyes bulge out of the pale underside, sunk into it by most of their depth. */
const rayEyeZ = rayGillZ(0.75, 0.24) - 0.004;

function RayModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  const disc = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.82, 0);
    shape.bezierCurveTo(-0.72, 0.5, -0.3, 0.94, 0.2, 1.08);
    shape.bezierCurveTo(0.7, 0.96, 1.18, 0.46, 1.42, 0.04);
    shape.bezierCurveTo(1.18, -0.46, 0.7, -0.96, 0.2, -1.08);
    shape.bezierCurveTo(-0.3, -0.94, -0.72, -0.5, -0.82, 0);
    return shape;
  }, []);
  const tail = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.78, 0, 0.02),
    new THREE.Vector3(-1.55, -0.08, 0.01),
    new THREE.Vector3(-2.4, 0.08, 0),
    new THREE.Vector3(-3.35, -0.06, -0.01),
  ]), []);
  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="glide">
      <BodyProportions>
        <mesh position={[0, 0, -0.12]}>
          <extrudeGeometry args={[disc, { depth: 0.18, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.1, bevelThickness: 0.08, curveSegments: 28 }]} />
          <PatternedToonMaterial color={colors.body} repeat={[0.8, 0.8]} wraps={false} />
        </mesh>
        <mesh position={[0.42, 0, 0.1]} scale={[0.92, 0.54, 0.16]}>
          <sphereGeometry args={[0.92, 20, 14]} />
          <meshToonMaterial color={colors.light} />
        </mesh>
      </BodyProportions>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0.12, side * 0.93, 0.04]}
          rotation={[side * 0.18, 0, side * -0.2]}
          scale={[0.68, 0.2, 0.08]}
        >
          <sphereGeometry args={[1, 18, 12]} />
          <meshToonMaterial color={colors.dark} />
        </mesh>
      ))}
      <BodyProportions>
        <mesh>
          <tubeGeometry args={[tail, 40, 0.028, 7, false]} />
          <meshToonMaterial color={colors.dark} />
        </mesh>
      </BodyProportions>
      {[-1, 1].map((side) => (
        <BodyAttachment key={`eye-${side}`} anchor={[0.75, side * 0.24, rayEyeZ]}>
        <group position={[0.75, side * 0.24, rayEyeZ + 0.02]}>
          <mesh scale={[0.105, 0.075, 0.06]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshToonMaterial color="#F3F0E8" />
          </mesh>
          <MovingPupil position={[0.025, 0, 0.055]} scale={[0.042, 0.034, 0.025]} animated={props.animated} phase={side * 0.25} />
        </group>
        </BodyAttachment>
      ))}
      <BodyProportions>
      {[-1, 1].flatMap((side) => [0, 1, 2].map((index) => (
        <mesh
          key={`gill-${side}-${index}`}
          position={[0.38 - index * 0.12, side * (0.24 + index * 0.055), rayGillZ(0.38 - index * 0.12, side * (0.24 + index * 0.055))]}
          rotation={[0, 0, side * 0.18]}
          scale={[0.08, 0.018, 0.012]}
        >
          <capsuleGeometry args={[0.5, 1, 4, 8]} />
          <meshBasicMaterial color={colors.dark} />
        </mesh>
      )))}
      <mesh position={[0.72, 0, 0.29]} rotation={[Math.PI / 2, 0, 0]} scale={[0.12, 0.08, 0.04]}>
        <torusGeometry args={[1, 0.16, 7, 18]} />
        <meshBasicMaterial color={colors.dark} />
      </mesh>
      </BodyProportions>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="ray" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

const starArms = 5;
/** Tip and valley radius of the star outline: chunky arms like a storybook starfish's. */
const starTipRadius = 1.62;
const starValleyRadius = 0.64;
/** Radius of the round cap on each arm's tip. */
const starTipRounding = 0.17;
const starPuff = 0.36;
/** How far the arms curl round, in radians at the tips, so the star looks caught mid-wiggle. */
const starCurl = 0.12;

/** Angular distance from the nearest arm's axis, from 0 on the axis to 1 in the valley between arms. */
function starArmOffset(angle: number) {
  const sector = (Math.PI * 2) / starArms;
  const wrapped = THREE.MathUtils.euclideanModulo(angle - Math.PI / 2, sector);
  return Math.min(wrapped, sector - wrapped) / (sector / 2);
}

/**
 * The star's outline: each side runs as a straight edge from the tip to the valley between two
 * arms, drawn in a little, with well rounded tips.
 */
function starRadius(angle: number) {
  const offset = starArmOffset(angle);
  const half = Math.PI / starArms;
  // Where a ray at this angle off the arm's axis meets the straight edge from tip to valley.
  const tip = new THREE.Vector2(starTipRadius, 0);
  const valley = new THREE.Vector2(Math.cos(half) * starValleyRadius, Math.sin(half) * starValleyRadius);
  const normal = new THREE.Vector2(valley.y - tip.y, tip.x - valley.x);
  const ray = new THREE.Vector2(Math.cos(offset * half), Math.sin(offset * half));
  const straight = (normal.dot(tip) / normal.dot(ray)) * (1 - 0.05 * Math.sin(Math.PI * offset));
  // Each tip is capped by the circle that touches both of its edges, so the arms end round instead of pointed.
  const edgeAngle = Math.atan2(valley.y, tip.x - valley.x);
  const capCenter = tip.x - starTipRounding / Math.sin(edgeAngle);
  const across = capCenter * Math.sin(offset * half);
  if (across >= starTipRounding) return straight;
  const capped = capCenter * Math.cos(offset * half) + Math.sqrt(starTipRounding ** 2 - across ** 2);
  return Math.min(straight, capped);
}

/** How high the puffy top sits at a share `t` of the way out to the outline: flat-topped, with a rounded rim. */
function starHeight(t: number, angle: number) {
  // A little higher along each arm's spine. The ridges fade in away from the centre, so the
  // middle stays one round dome.
  const spine = (1 + Math.cos(starArmOffset(angle) * Math.PI)) / 2;
  const ridge = 1 - 0.2 * (1 - spine) * THREE.MathUtils.smoothstep(t, 0, 0.55);
  return starPuff * Math.max(0, 1 - t ** 2.2) ** 0.42 * ridge;
}

/** A point on the top skin, `t` of the way out along `angle`, with the arms' curl applied. */
function starPoint(t: number, angle: number, lift = 0) {
  const radius = starRadius(angle) * t;
  const curled = angle + starCurl * (radius / starTipRadius) ** 2;
  return new THREE.Vector3(Math.cos(curled) * radius, Math.sin(curled) * radius, starHeight(t, angle) + lift);
}

/** One puffy star with a rounded rim and a softly rounded underside. */
const starfishBodyGeometry = withDetailRecipe(160, (detail) => {
  const around = Math.max(starArms * 8, Math.round(160 * detail));
  const rings = Math.max(5, Math.round(16 * detail));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const top of [true, false]) {
    const offset = positions.length / 3;
    for (let ring = 0; ring <= rings; ring += 1) {
      const t = ring / rings;
      for (let step = 0; step <= around; step += 1) {
        const angle = (step / around) * Math.PI * 2;
        const point = starPoint(t, angle);
        if (!top) point.z = -0.1 * Math.max(0, 1 - t ** 2.2) ** 0.42;
        positions.push(point.x, point.y, point.z);
        uvs.push(point.x, point.y);
      }
    }
    for (let ring = 0; ring < rings; ring += 1) {
      for (let step = 0; step < around; step += 1) {
        const a = offset + ring * (around + 1) + step;
        const b = a + around + 1;
        // Outward rings and counter-clockwise steps face the top toward the viewer; the underside is reversed.
        if (top) indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Every vertex of the innermost ring sits on the centre point; face them straight out so the
  // dome's peak does not pick up shading from the tilted triangles around it.
  const normals = geometry.getAttribute("normal");
  const perSurface = (rings + 1) * (around + 1);
  for (let step = 0; step <= around; step += 1) {
    normals.setXYZ(step, 0, 0, 1);
    normals.setXYZ(perSurface + step, 0, 0, -1);
  }
  return geometry;
});

/** A row of pale, flattened dots down the spine of every arm, shrinking toward the tip. */
const starfishDotGeometry = withDetailRecipe(10, (detail) => {
  const dots: THREE.BufferGeometry[] = [];
  for (let arm = 0; arm < starArms; arm += 1) {
    const axis = Math.PI / 2 + (arm / starArms) * Math.PI * 2;
    for (let index = 0; index < 6; index += 1) {
      const t = 0.44 + index * 0.09;
      const size = 0.062 - index * 0.005;
      const point = starPoint(t, axis, 0.004);
      dots.push(
        new THREE.SphereGeometry(size, Math.max(6, Math.round(10 * detail)), Math.max(4, Math.round(6 * detail)))
          .scale(1, 1, 0.4)
          .translate(point.x, point.y, point.z),
      );
    }
  }
  return mergeGeometries(dots, false);
});

/** The starfish's smile, laid over the dome just below its eyes. */
const starfishSmile = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, index) => {
  const angle = Math.PI * (1.18 + (index / 8) * 0.64);
  const x = Math.cos(angle) * 0.17;
  const y = -0.06 + Math.sin(angle) * 0.13;
  return new THREE.Vector3(x, y, starHeight(Math.hypot(x, y) / starValleyRadius, Math.atan2(y, x)) + 0.006);
}));

function StarfishModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  const dotColor = useMemo(() => new THREE.Color(colors.body).lerp(new THREE.Color("#FFF4E6"), 0.55).getStyle(), [colors.body]);
  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="bob">
      {/* A starfish's whole star is its body. */}
      <BodyProportions>
        <mesh name="Starfish body" geometry={starfishBodyGeometry}>
          <PatternedToonMaterial color={colors.body} repeat={[1.2, 1.2]} wraps={false} />
        </mesh>
        <mesh name="Starfish dots" geometry={starfishDotGeometry}>
          <meshToonMaterial color={dotColor} />
        </mesh>
        <mesh name="Starfish smile">
          <tubeGeometry args={[starfishSmile, 20, 0.016, 6, false]} />
          <meshBasicMaterial color={colors.dark} />
        </mesh>
      </BodyProportions>
      <BodyAttachment anchor={[0, 0.1, starPuff]}>
        <group position={[0, 0.12, starPuff - 0.02]} scale={1.15}>
          {PairOfEyes({ x: 0.13, y: 0, z: 0, animated: props.animated })}
        </group>
      </BodyAttachment>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="starfish" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

/** Belly ribs lie on whichever is outermost there: the pale belly or the body behind it, slightly sunk in. */
function seahorseRibZ(x: number, y: number) {
  const body = ellipsoidSkinZ([-0.02, 0.02, 0], [0.58 * 0.82, 0.86 * 0.82, 0.36 * 0.82], x, y, -0.12) ?? 0;
  const belly = ellipsoidSkinZ([0.22, 0.16, 0.03], [0.42 * 0.76, 0.65 * 0.76, 0.31 * 0.76], x, y, -0.18) ?? 0;
  return Math.max(body, belly) - 0.01;
}

function SeahorseModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  const neck = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, 1.18, 0),
    new THREE.Vector3(-0.25, 1.02, 0),
    new THREE.Vector3(-0.38, 0.72, 0),
    new THREE.Vector3(-0.25, 0.42, 0),
  ]), []);
  const tail = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.1, -0.65, 0),
    new THREE.Vector3(-0.28, -1.02, 0),
    new THREE.Vector3(-0.22, -1.38, 0),
    new THREE.Vector3(0.08, -1.58, 0),
    new THREE.Vector3(0.43, -1.49, 0),
    new THREE.Vector3(0.52, -1.2, 0),
    new THREE.Vector3(0.33, -1.03, 0),
    new THREE.Vector3(0.13, -1.12, 0),
    new THREE.Vector3(0.14, -1.3, 0),
    new THREE.Vector3(0.28, -1.34, 0),
  ]), []);
  const dorsalFin = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.5);
    shape.bezierCurveTo(-0.42, -0.35, -0.5, 0.25, -0.05, 0.55);
    shape.quadraticCurveTo(0.08, 0.08, 0, -0.5);
    return shape;
  }, []);
  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="bob">
      <mesh><tubeGeometry args={[neck, 28, 0.23, 10, false]} /><PatternedToonMaterial color={colors.body} repeat={[3, 2]} wraps="v" /></mesh>
      <BodyProportions origin={[-0.02, 0.02, 0]}>
        <mesh position={[-0.02, 0.02, 0]} rotation={[0, 0, -0.12]} scale={[0.58, 0.86, 0.36]}>
          <sphereGeometry args={[0.82, 20, 14]} />
          <PatternedToonMaterial color={colors.body} />
        </mesh>
        <mesh position={[0.22, 0.16, 0.03]} rotation={[0, 0, -0.18]} scale={[0.42, 0.65, 0.31]}>
          <sphereGeometry args={[0.76, 20, 14]} />
          <meshToonMaterial color={colors.light} />
        </mesh>
      </BodyProportions>
      <mesh><tubeGeometry args={[tail, 48, 0.105, 9, false]} /><meshToonMaterial color={colors.accent} /></mesh>
      <mesh name="Seahorse head" position={[0.1, 1.27, 0]} rotation={[0, 0, -0.08]} scale={[0.48, 0.4, 0.34]}>
        <sphereGeometry args={[0.72, 20, 14]} />
        <PatternedToonMaterial color={colors.body} />
      </mesh>
      <mesh position={[0.57, 1.15, 0]} rotation={[0, 0, -Math.PI / 2 + 0.1]} scale={[0.13, 0.52, 0.13]}>
        <coneGeometry args={[1, 1, 10]} />
        <meshToonMaterial color={colors.accent} />
      </mesh>
      {/* The trumpet mouth sits on the tip of the snout. */}
      <mesh position={[0.82, 1.175, 0]} scale={[0.1, 0.12, 0.1]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshToonMaterial color={colors.dark} />
      </mesh>
      {[-1, 1].map((side) => (
        <group name={`Seahorse ${side > 0 ? "near" : "far"} eye`} key={`eye-${side}`} position={[0.2, 1.35, side * 0.22]}>
          <mesh scale={[0.085, 0.085, 0.045]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshToonMaterial color="#F3F0E8" />
          </mesh>
          <MovingPupil
            position={[0.015, 0, side * 0.04]}
            scale={[0.042, 0.045, 0.022]}
            animated={props.animated}
            phase={side * 0.2}
            range={[0.022, 0.02]}
          />
        </group>
      ))}
      <BodyAttachment anchor={[-0.42, 0.03, 0]} origin={[-0.02, 0.02, 0]}>
        <mesh position={[-0.48, 0.03, -0.03]} rotation={[0, 0, -0.08]} scale={[1, 1, 0.7]}>
          <shapeGeometry args={[dorsalFin, 8]} />
          <meshToonMaterial color={colors.accent} side={THREE.DoubleSide} />
        </mesh>
      </BodyAttachment>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = 0.55 + index * 0.31;
        return (
        <mesh key={index} position={[-0.34 - Math.sin(angle) * 0.14, 1.12 - index * 0.23, -0.01]} rotation={[0, 0, -0.68 + index * 0.07]} scale={[0.09, 0.22 - index * 0.009, 0.055]}>
          <coneGeometry args={[1, 1, 8]} />
          <meshToonMaterial color={colors.dark} />
        </mesh>
        );
      })}
      <BodyProportions origin={[-0.02, 0.02, 0]}>
        {Array.from({ length: 6 }, (_, index) => (
          <mesh key={`rib-${index}`} position={[0.17, 0.52 - index * 0.18, seahorseRibZ(0.17, 0.52 - index * 0.18)]} rotation={[0, 0, 0.16]} scale={[0.3, 0.035, 0.035]}>
            <capsuleGeometry args={[0.5, 0.5, 4, 8]} />
            <meshToonMaterial color={colors.accent} />
          </mesh>
        ))}
      </BodyProportions>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="seahorse" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

function ArticulatedSealTail({
  animated,
  colors,
}: {
  animated?: boolean;
  colors: ReturnType<typeof aquaticPalette>;
}) {
  const connectorRef = useRef<THREE.Group>(null);
  const finsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (animated === false) return;
    const swim = clock.elapsedTime * 1.5;
    if (connectorRef.current) connectorRef.current.rotation.z = Math.sin(swim) * 0.16;
    if (finsRef.current) finsRef.current.rotation.z = Math.sin(swim - 0.7) * 0.12;
  });

  return (
    <group ref={connectorRef} position={[-1.05, 0, 0]}>
      <mesh
        name="Seal tail connector"
        position={[-0.32, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.14, 0.64, 0.16]}
      >
        <cylinderGeometry args={[0.5, 1, 1, 14]} />
        <PatternedToonMaterial color={colors.body} repeat={[2, 1]} />
      </mesh>
      <group ref={finsRef} position={[-0.64, 0, 0]}>
        {[-1, 1].map((side) => (
          <mesh
            name={`Seal tail fin ${side < 0 ? "lower" : "upper"}`}
            key={side}
            position={[-0.24, side * 0.2, 0]}
            rotation={[0, 0, side * -0.5]}
            scale={[0.5, 0.18, 0.1]}
          >
            <sphereGeometry args={[1, 16, 10]} />
            <meshToonMaterial color={colors.dark} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SealModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  return (
    <LivingGroup animated={props.animated} scale={props.scale}>
      <BodyProportions>
        <mesh scale={[1.38, 0.66, 0.46]}>
          <sphereGeometry args={[0.9, 20, 14]} />
          <PatternedToonMaterial color={colors.body} />
        </mesh>
      </BodyProportions>
      <mesh position={[1.12, 0.2, 0]} scale={[0.62, 0.54, 0.5]}>
        <sphereGeometry args={[0.72, 20, 14]} />
        <meshToonMaterial color={colors.light} />
      </mesh>
      <mesh position={[1.5, 0.03, 0.33]} scale={[0.24, 0.16, 0.12]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshToonMaterial color={colors.dark} />
      </mesh>
      {[-1, 1].map((side) => (
        <PivotedPart key={side} center={[0.25, side * 0.55, -0.02]} pivot={[0, side * 0.55, -0.02]} angle={side * -0.46} animated={props.animated} phase={side} amount={0.11} speed={1.5}>
          <mesh scale={[0.62, 0.2, 0.1]}><sphereGeometry args={[1, 18, 12]} /><meshToonMaterial color={colors.accent} /></mesh>
        </PivotedPart>
      ))}
      <BodyProportions>
        <ArticulatedSealTail animated={props.animated} colors={colors} />
      </BodyProportions>
      <group position={[1.12, 0, 0]}>
        {PairOfEyes({ x: 0.22, y: 0.36, z: 0.4, animated: props.animated })}
      </group>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="seal" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

/** A shrimp's walking leg, from a hip inside the body down to its knee and foot. */
const shrimpLeg = { hip: [0, 0.06, 0] as Point3, knee: [0.1, -0.3, 0] as Point3, foot: [0.3, -0.56, 0] as Point3 };

/** A tapering limb segment stretched between two points in the xy plane. */
function LegSegment({ from, to, radius, tip = 0.8, color }: { from: Point3; to: Point3; radius: number; tip?: number; color: string }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return (
    <mesh
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]}
      rotation={[0, 0, Math.atan2(-dx, dy)]}
      scale={[radius, Math.hypot(dx, dy), radius]}
    >
      <cylinderGeometry args={[tip, 1, 1, 7]} />
      <meshToonMaterial color={color} />
    </mesh>
  );
}

function ShrimpModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  const abdomen = [
    { position: [0.62, 0.14, 0] as const, rotation: -0.04, scale: [0.43, 0.48, 0.34] as const },
    { position: [0.25, 0.12, 0] as const, rotation: -0.08, scale: [0.42, 0.46, 0.33] as const },
    { position: [-0.12, 0.03, 0] as const, rotation: -0.2, scale: [0.4, 0.43, 0.31] as const },
    { position: [-0.45, -0.13, 0] as const, rotation: -0.38, scale: [0.36, 0.4, 0.28] as const },
    { position: [-0.72, -0.38, 0] as const, rotation: -0.62, scale: [0.31, 0.36, 0.24] as const },
    { position: [-0.87, -0.68, 0] as const, rotation: -0.9, scale: [0.25, 0.31, 0.2] as const },
  ];
  const antennae = useMemo(() => [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.22, 0.27, 0.08),
      new THREE.Vector3(1.7, 0.57, 0.06),
      new THREE.Vector3(2.28, 0.67, 0.03),
      new THREE.Vector3(2.82, 0.42, 0),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.24, 0.2, 0.02),
      new THREE.Vector3(1.78, 0.34, 0),
      new THREE.Vector3(2.42, 0.2, -0.02),
    ]),
  ], []);
  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="coil">
      <BodyProportions>
        {abdomen.map((segment, index) => (
          <mesh key={`segment-${index}`} position={segment.position} rotation={[0, 0, segment.rotation]} scale={segment.scale}>
            <sphereGeometry args={[1, 18, 14]} />
            <PatternedToonMaterial color={index % 2 ? colors.body : colors.light} repeat={[2, 1]} />
          </mesh>
        ))}
      </BodyProportions>
      <mesh position={[1.02, 0.2, 0]} rotation={[0, 0, 0.06]} scale={[0.58, 0.43, 0.36]}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshToonMaterial color={colors.accent} />
      </mesh>
      <mesh position={[1.5, 0.2, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.22, 0.42, 0.2]}>
        <coneGeometry args={[1, 1, 12]} />
        <meshToonMaterial color={colors.light} />
      </mesh>
      {antennae.map((curve, index) => (
        <mesh key={`antenna-${index}`}>
          <tubeGeometry args={[curve, 28, index === 0 ? 0.018 : 0.014, 6, false]} />
          <meshToonMaterial color={colors.light} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <MovingPupil key={`eye-${side}`} position={[1.25, 0.42, side * 0.31]} scale={[0.085, 0.09, 0.055]} animated={props.animated} phase={side * 0.2} />
      ))}
      <BodyProportions>
      {Array.from({ length: 5 }, (_, index) => [-1, 1].map((depth) => (
        // Each leg swings from its own hip, tucked up inside the body, so it never comes loose.
        <group key={`leg-${index}-${depth}`} position={[0.68 - index * 0.28, -0.18 - index * 0.035, depth * 0.13]}>
          <MovingPart animated={props.animated} phase={index * 0.55 + depth} base={-0.06 + index * 0.02} amount={0.13} speed={2.1}>
            <LegSegment from={shrimpLeg.hip} to={shrimpLeg.knee} radius={0.025} color={colors.dark} />
            <mesh position={shrimpLeg.knee}><sphereGeometry args={[0.024, 8, 6]} /><meshToonMaterial color={colors.dark} /></mesh>
            <LegSegment from={shrimpLeg.knee} to={shrimpLeg.foot} radius={0.02} tip={0.6} color={colors.dark} />
          </MovingPart>
        </group>
      )))}
      </BodyProportions>
      {/* The tail fan continues the curl of the last abdomen segment and spreads out from its tip. */}
      <BodyProportions>
      <group position={[-0.93, -0.8, 0]} rotation={[0, 0, -0.47]}>
        {[-1, 0, 1].map((fan) => (
          <group key={`tail-${fan}`} rotation={[0, 0, fan * 0.42]}>
            <mesh position={[0, -0.32, fan * 0.04]} scale={[0.18, 0.4, 0.09]}>
              <sphereGeometry args={[1, 14, 10]} />
              <meshToonMaterial color={fan === 0 ? colors.dark : colors.accent} />
            </mesh>
          </group>
        ))}
      </group>
      </BodyProportions>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="shrimp" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

/** A side-view outline that answers where its top and bottom edges are at any x. */
type Outline = { minX: number; maxX: number; span: (x: number) => [number, number] | null };

function outlineOf(shape: THREE.Shape): Outline {
  const points = shape.getPoints(24);
  const xs = points.map((point) => point.x);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    span(x) {
      let bottom = Infinity;
      let top = -Infinity;
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) continue;
        const y = a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
        bottom = Math.min(bottom, y);
        top = Math.max(top, y);
      }
      return top > bottom ? [bottom, top] : null;
    },
  };
}

/**
 * Turns a side-view outline into a rounded, stretched sphere: every cross-section is an ellipse
 * as tall as the outline there and `widthRatio` as wide. With `cover`, only the part of the
 * surface below that second outline is built, so a belly can be laid over the body.
 */
function roundedBody(shape: THREE.Shape, widthRatio: number, cover?: THREE.Shape, inflate = 1) {
  const outline = outlineOf(shape);
  const covered = cover ? outlineOf(cover) : null;
  return withDetailRecipe(32, (detail) => {
    const stations = Math.max(10, Math.round(48 * detail));
    const around = Math.max(8, Math.round(32 * detail));
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const inset = (outline.maxX - outline.minX) * 0.002;
    for (let station = 0; station <= stations; station += 1) {
      // Cosine spacing packs more rings into the rounded nose and tail.
      const t = (1 - Math.cos((station / stations) * Math.PI)) / 2;
      const x = THREE.MathUtils.clamp(outline.minX + (outline.maxX - outline.minX) * t, outline.minX + inset, outline.maxX - inset);
      const [bottom, top] = outline.span(x) ?? [0, 0];
      const atEnd = station === 0 || station === stations;
      const center = (top + bottom) / 2;
      const radiusY = atEnd ? 0 : ((top - bottom) / 2) * inflate;
      const radiusZ = radiusY * widthRatio;
      // A belly runs from its top edge on the near side, under the body, to the same height on the far side.
      let from = Math.PI / 2;
      let to = -1.5 * Math.PI;
      if (covered) {
        const coverSpan = x >= covered.minX && x <= covered.maxX ? covered.span(x) : null;
        const reach = coverSpan && radiusY > 0 ? THREE.MathUtils.clamp((coverSpan[1] - center) / radiusY, -1, 1) : -1;
        from = Math.asin(reach);
        to = -Math.PI - from;
      }
      for (let step = 0; step <= around; step += 1) {
        const angle = from + (to - from) * (step / around);
        const y = center + radiusY * Math.sin(angle);
        positions.push(x, y, radiusZ * Math.cos(angle));
        uvs.push(x, y);
      }
    }
    for (let station = 0; station < stations; station += 1) {
      for (let step = 0; step < around; step += 1) {
        const a = station * (around + 1) + step;
        const b = a + around + 1;
        // Rings run toward +x and steps run down the near side, so this order faces the triangles outward.
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  });
}

/** How far out of the side of a `roundedBody` the skin sits at a given height, so marks can lie on it. */
function roundedSurfaceZ(outline: Outline, widthRatio: number, x: number, y: number, lift = 0.006) {
  const span = outline.span(THREE.MathUtils.clamp(x, outline.minX, outline.maxX));
  if (!span) return 0;
  const center = (span[0] + span[1]) / 2;
  const radiusY = (span[1] - span[0]) / 2;
  const height = THREE.MathUtils.clamp((y - center) / radiusY, -1, 1);
  return radiusY * widthRatio * Math.sqrt(1 - height * height) + lift;
}

/** Moves each point of a side-view line onto the near (or far) skin of a `roundedBody`. */
function onRoundedSurface(outline: Outline, widthRatio: number, points: Array<[number, number]>, side = 1) {
  return new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, side * roundedSurfaceZ(outline, widthRatio, x, y))));
}

/** How deep inside the skin each pectoral fin is rooted, and how far its blade tilts out from the body. */
const finRootDepth = 0.07;
const finSplay = 0.38;

const fleshyFinThickness = 0.012;
/** How far the rounded edge swells out of each face; the fin is about 0.03 thick in all. */
const fleshyFinEdge = 0.009;

/**
 * A fin with one of the fish's Bézier outlines, but solid and fleshy like a marine mammal's:
 * opaque, slightly thick with rounded edges, and without rays.
 */
function FleshyFin({ shape, color, name }: { shape: THREE.Shape; color: string; name?: string }) {
  return (
    <mesh name={name} position={[0, 0, -fleshyFinThickness / 2]}>
      <extrudeGeometry args={[shape, { depth: fleshyFinThickness, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.012, bevelThickness: fleshyFinEdge, curveSegments: 16 }]} />
      <meshToonMaterial color={color} />
    </mesh>
  );
}

/**
 * A pair of fleshy pectoral fins with outlines from the fish's Bézier fin collection, rooted on the skin at `root`
 * (`skin` is how far out of each side the skin sits there) and paddling slowly.
 */
function BezierFlippers({
  name,
  signature,
  root,
  skin,
  farSkin = skin,
  size,
  colors,
  animated,
  speed,
  amount,
}: {
  name: string;
  signature: string;
  root: [number, number];
  /** How far out of the near side the skin sits at the root; `farSkin` for the far side when it differs. */
  skin: number;
  farSkin?: number;
  size: number;
  colors: ReturnType<typeof aquaticPalette>;
  animated?: boolean;
  speed: number;
  amount: number;
}) {
  const style = pectoralFinStyleFor(signature);
  const [x, y] = root;
  return (
    <>
      {[1, -1].map((side) => {
        const surface = side * (side > 0 ? skin : farSkin);
        // The root sits well inside the body and the blade tilts out of it, so the fin's base
        // always cuts into the skin, however the body is stretched or the fin paddles.
        const z = surface - side * finRootDepth;
        return (
        <BodyAttachment key={side} anchor={[x, y, surface]}>
        <group name={`${name} ${side > 0 ? "near" : "far"} flipper`} position={[x, y, z]} rotation={[-side * finSplay, 0, 0]}>
          <MovingPart animated={animated} phase={side > 0 ? 0 : 0.6} base={side > 0 ? 0.03 : -0.05} amount={amount} speed={speed}>
            <group scale={[style.width * size, style.height * size, 1]}>
              <FleshyFin shape={style.shape} color={colors.accent} />
            </group>
          </MovingPart>
        </group>
        </BodyAttachment>
        );
      })}
    </>
  );
}

const whaleWidthRatio = 0.72;
const dolphinWidthRatio = 0.74;
/** How large the dolphin's dorsal fin is drawn, relative to the fish fin outline it uses. */
const dolphinDorsalSize = 0.85;
/** Where along the back the dorsal fin stands: on the crest, a little ahead of the middle. */
const dolphinDorsalX = 0.12;

function ArticulatedMammalTail({
  animated,
  colors,
}: {
  animated?: boolean;
  colors: ReturnType<typeof aquaticPalette>;
}) {
  const stemRef = useRef<THREE.Group>(null);
  const flukesRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (animated === false) return;
    const swim = clock.elapsedTime * 1.65;
    if (stemRef.current) stemRef.current.rotation.z = Math.sin(swim) * 0.2;
    if (flukesRef.current) flukesRef.current.rotation.z = Math.sin(swim - 0.72) * 0.18;
  });

  const stemLength = 0.88;
  return (
    <group ref={stemRef}>
      <mesh position={[-stemLength * 0.48, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.085, stemLength, 0.11]}>
        <cylinderGeometry args={[0.42, 1, 1, 14]} />
        <PatternedToonMaterial color={colors.body} repeat={[2, 1]} />
      </mesh>
      <group ref={flukesRef} position={[-stemLength, 0, 0]}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[-0.22, side * 0.23, 0]} rotation={[0, 0, side * -0.52]} scale={[0.57, 0.18, 0.085]}>
            <sphereGeometry args={[1, 18, 12]} />
            <meshToonMaterial color={colors.dark} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function BlueWhaleTail({
  animated,
  colors,
}: {
  animated?: boolean;
  colors: ReturnType<typeof aquaticPalette>;
}) {
  const stemRef = useRef<THREE.Group>(null);
  const flukesRef = useRef<THREE.Group>(null);
  const stem = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.08, 0.14);
    shape.bezierCurveTo(-0.26, 0.12, -0.62, 0.07, -0.9, 0.025);
    shape.bezierCurveTo(-0.94, 0, -0.94, -0.025, -0.9, -0.05);
    shape.bezierCurveTo(-0.6, -0.09, -0.24, -0.13, 0.08, -0.16);
    shape.closePath();
    return roundedBody(shape, 1);
  }, []);
  useFrame(({ clock }) => {
    if (animated === false) return;
    const swim = clock.elapsedTime * 1.08;
    if (stemRef.current) stemRef.current.rotation.z = Math.sin(swim) * 0.12;
    if (flukesRef.current) flukesRef.current.rotation.z = Math.sin(swim - 0.62) * 0.1;
  });

  return (
    <group ref={stemRef} position={[-1.62, 0.08, 0]}>
      <mesh name="Blue whale tail stock" geometry={stem}>
        <PatternedToonMaterial color={colors.body} repeat={[0.8, 0.8]} wraps={false} />
      </mesh>
      <group ref={flukesRef} position={[-0.87, 0, 0]} rotation={[0.52, 0, 0]}>
        {[-1, 1].map((side) => (
          <mesh
            name={`Blue whale ${side > 0 ? "right" : "left"} fluke`}
            key={side}
            position={[-0.28, 0, side * 0.32]}
            rotation={[0, side * 0.48, 0]}
            scale={[0.56, 0.1, 0.32]}
          >
            <sphereGeometry args={[1, 16, 8]} />
            <meshToonMaterial color={colors.dark} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function BlueWhaleModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  const body = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(1.78, 0.12);
    shape.bezierCurveTo(1.7, 0.38, 1.25, 0.57, 0.72, 0.62);
    shape.bezierCurveTo(0.12, 0.69, -0.7, 0.56, -1.18, 0.34);
    shape.bezierCurveTo(-1.4, 0.25, -1.55, 0.17, -1.68, 0.13);
    shape.bezierCurveTo(-1.73, 0.06, -1.73, 0, -1.66, -0.06);
    shape.bezierCurveTo(-1.25, -0.23, -0.68, -0.36, -0.05, -0.41);
    shape.bezierCurveTo(0.68, -0.47, 1.37, -0.34, 1.7, -0.14);
    shape.bezierCurveTo(1.82, -0.06, 1.85, 0.04, 1.78, 0.12);
    shape.closePath();
    return shape;
  }, []);
  const belly = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(1.73, -0.03);
    shape.bezierCurveTo(1.38, -0.13, 0.88, -0.18, 0.38, -0.19);
    shape.bezierCurveTo(-0.12, -0.2, -0.58, -0.28, -0.98, -0.31);
    shape.bezierCurveTo(-0.45, -0.43, 0.58, -0.49, 1.36, -0.3);
    shape.bezierCurveTo(1.6, -0.24, 1.72, -0.13, 1.73, -0.03);
    shape.closePath();
    return shape;
  }, []);
  const dorsalFin = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.52, 0);
    shape.lineTo(0.28, 0);
    shape.bezierCurveTo(0.22, 0.08, 0.08, 0.27, -0.08, 0.34);
    shape.bezierCurveTo(-0.24, 0.38, -0.27, 0.13, -0.52, 0);
    shape.closePath();
    return shape;
  }, []);
  const bodyGeometry = useMemo(() => roundedBody(body, whaleWidthRatio), [body]);
  const bellyGeometry = useMemo(() => roundedBody(body, whaleWidthRatio, belly, 1.012), [body, belly]);
  const outline = useMemo(() => outlineOf(body), [body]);
  const mouth = useMemo(() => onRoundedSurface(outline, whaleWidthRatio, [[1.73, -0.02], [1.25, -0.11], [0.7, -0.17], [0.18, -0.18]]), [outline]);
  const eyeZ = useMemo(() => roundedSurfaceZ(outline, whaleWidthRatio, 1.25, 0.09, 0), [outline]);

  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="glide">
      <BodyProportions>
        <BlueWhaleTail animated={props.animated} colors={colors} />
      </BodyProportions>
      {/* The body is a stretched sphere following the side outline; the pale belly wraps under it. */}
      <BodyProportions>
        <mesh name="Blue whale body" geometry={bodyGeometry}>
          <PatternedToonMaterial color={colors.body} repeat={[0.8, 0.8]} wraps={false} />
        </mesh>
        <mesh name="Blue whale belly" geometry={bellyGeometry}>
          <meshToonMaterial color={colors.light} />
        </mesh>
      </BodyProportions>
      <BodyAttachment anchor={[0, 0.57, 0]}>
        <mesh name="Blue whale dorsal fin" position={[0, 0.57, -0.09]}>
          <extrudeGeometry args={[dorsalFin, { depth: 0.18, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.04, bevelThickness: 0.04, curveSegments: 10 }]} />
          <meshToonMaterial color={colors.dark} side={THREE.DoubleSide} />
        </mesh>
      </BodyAttachment>
      <BezierFlippers
        name="Blue whale"
        signature={props.baseSeed ?? props.pieces[0]?.artifactId ?? "new"}
        root={[0.5, -0.12]}
        skin={roundedSurfaceZ(outline, whaleWidthRatio, 0.5, -0.12, 0)}
        size={1.4}
        colors={colors}
        animated={props.animated}
        speed={1.05}
        amount={0.08}
      />
      <BodyProportions>
        <mesh name="Blue whale mouth">
          <tubeGeometry args={[mouth, 28, 0.014, 7, false]} />
          <meshBasicMaterial color={colors.dark} />
        </mesh>
      </BodyProportions>
      {[-1, 1].map((side) => (
        <BodyAttachment key={`eye-${side}`} anchor={[1.25, 0.09, side * eyeZ]}>
        <group name={`Blue whale ${side > 0 ? "near" : "far"} eye`} position={[1.25, 0.09, side * eyeZ]}>
          <mesh scale={[0.075, 0.07, 0.035]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshToonMaterial color="#F3F0E8" />
          </mesh>
          <mesh position={[0.012, -0.004, side * 0.034]} scale={[0.031, 0.034, 0.018]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial color="#071015" />
          </mesh>
        </group>
        </BodyAttachment>
      ))}
      <BodyAttachment anchor={[0.93, 0.6, 0]}>
        {[-0.035, 0.035].map((z) => (
          <mesh name="Blue whale blowhole" key={z} position={[0.93, 0.6, z]} rotation={[Math.PI / 2, 0, -0.1]} scale={[0.055, 0.023, 0.018]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color={colors.dark} />
          </mesh>
        ))}
      </BodyAttachment>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="whale" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

function DolphinTail({
  animated,
  colors,
}: {
  animated?: boolean;
  colors: ReturnType<typeof aquaticPalette>;
}) {
  const stemRef = useRef<THREE.Group>(null);
  const flukesRef = useRef<THREE.Group>(null);
  const stem = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.06, 0.12);
    shape.bezierCurveTo(-0.28, 0.1, -0.58, 0.04, -0.76, 0.015);
    shape.bezierCurveTo(-0.8, 0, -0.8, -0.025, -0.75, -0.045);
    shape.bezierCurveTo(-0.5, -0.08, -0.2, -0.11, 0.06, -0.14);
    shape.closePath();
    return roundedBody(shape, 1);
  }, []);
  useFrame(({ clock }) => {
    if (animated === false) return;
    const swim = clock.elapsedTime * 1.55;
    if (stemRef.current) stemRef.current.rotation.z = Math.sin(swim) * 0.17;
    if (flukesRef.current) flukesRef.current.rotation.z = Math.sin(swim - 0.65) * 0.13;
  });

  return (
    <group ref={stemRef} position={[-1.2, 0.05, 0]}>
      <mesh name="Dolphin tail stock" geometry={stem}>
        <PatternedToonMaterial color={colors.body} repeat={[0.8, 0.8]} wraps={false} />
      </mesh>
      <group ref={flukesRef} position={[-0.73, 0, 0]} rotation={[0.54, 0, 0]}>
        {[-1, 1].map((side) => (
          <mesh
            name={`Dolphin ${side > 0 ? "right" : "left"} fluke`}
            key={side}
            position={[-0.23, 0, side * 0.26]}
            rotation={[0, side * 0.5, 0]}
            scale={[0.46, 0.08, 0.27]}
          >
            <sphereGeometry args={[1, 18, 10]} />
            <meshToonMaterial color={colors.dark} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function DolphinModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  const body = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(1.32, 0.12);
    shape.bezierCurveTo(1.17, 0.37, 0.84, 0.51, 0.4, 0.53);
    shape.bezierCurveTo(-0.15, 0.57, -0.77, 0.39, -1.18, 0.16);
    shape.bezierCurveTo(-1.29, 0.09, -1.31, 0.01, -1.2, -0.05);
    shape.bezierCurveTo(-0.78, -0.24, -0.22, -0.36, 0.35, -0.34);
    shape.bezierCurveTo(0.86, -0.32, 1.2, -0.15, 1.32, 0.02);
    shape.bezierCurveTo(1.35, 0.06, 1.35, 0.09, 1.32, 0.12);
    shape.closePath();
    return shape;
  }, []);
  const belly = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(1.27, -0.02);
    shape.bezierCurveTo(0.9, -0.11, 0.52, -0.14, 0.08, -0.14);
    shape.bezierCurveTo(-0.35, -0.16, -0.72, -0.23, -0.97, -0.25);
    shape.bezierCurveTo(-0.55, -0.34, 0.08, -0.39, 0.55, -0.3);
    shape.bezierCurveTo(0.94, -0.23, 1.19, -0.12, 1.27, -0.02);
    shape.closePath();
    return shape;
  }, []);
  const bodyGeometry = useMemo(() => roundedBody(body, dolphinWidthRatio), [body]);
  const bellyGeometry = useMemo(() => roundedBody(body, dolphinWidthRatio, belly, 1.012), [body, belly]);
  const outline = useMemo(() => outlineOf(body), [body]);
  const eyeZ = useMemo(() => roundedSurfaceZ(outline, dolphinWidthRatio, 1.17, 0.13, 0), [outline]);
  // A dorsal fin from the fish's Bézier collection, standing on the crest of the back. Its base is
  // sunk just below the back along the middle of its length, so it grows out of the body.
  const dorsal = useMemo(() => {
    const style = dorsalFinStyleFor(props.baseSeed ?? props.pieces[0]?.artifactId ?? "new");
    const points = style.shape.getPoints(12);
    const reach = Math.max(...points.map((point) => Math.abs(point.x))) * style.width * dolphinDorsalSize * 0.6;
    const back = Math.min(...Array.from({ length: 7 }, (_, index) => outline.span(dolphinDorsalX - reach + (index / 6) * reach * 2)?.[1] ?? Infinity));
    return { style, base: back - 0.035 };
  }, [outline, props.baseSeed, props.pieces]);
  // The mouth line runs along the side of the beak and onto the body, lying on whichever skin is outermost.
  const mouth = useMemo(() => new THREE.CatmullRomCurve3([[1.75, -0.045], [1.55, -0.055], [1.34, -0.07], [1.16, -0.085]].map(([x, y]) => {
    const beakRadius = THREE.MathUtils.lerp(0.13, 0.02, THREE.MathUtils.clamp((x - 1.12) / 0.66, 0, 1));
    const beak = 0.72 * Math.sqrt(Math.max(0, beakRadius ** 2 - (y + 0.035) ** 2));
    const body = x <= outline.maxX ? roundedSurfaceZ(outline, dolphinWidthRatio, x, y, 0) : 0;
    return new THREE.Vector3(x, y, Math.max(beak, body) + 0.004);
  })), [outline]);

  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="glide">
      <BodyProportions>
        <DolphinTail animated={props.animated} colors={colors} />
        <mesh name="Dolphin body" geometry={bodyGeometry}>
          <PatternedToonMaterial color={colors.body} repeat={[0.8, 0.8]} wraps={false} />
        </mesh>
        <mesh name="Dolphin belly" geometry={bellyGeometry}>
          <meshToonMaterial color={colors.light} />
        </mesh>
      </BodyProportions>
      <BodyAttachment anchor={[1.2, -0.035, 0]}>
      <mesh name="Dolphin beak" position={[1.45, -0.035, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[0.02, 0.13, 0.66, 14, 1, false]} />
        <meshToonMaterial color={colors.body} />
      </mesh>
      <mesh name="Dolphin beak tip" position={[1.78, -0.035, 0]} scale={[0.035, 0.024, 0.019]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshToonMaterial color={colors.body} />
      </mesh>
      </BodyAttachment>
      <BodyAttachment anchor={[dolphinDorsalX, dorsal.base, 0]}>
        <group position={[dolphinDorsalX, dorsal.base, 0]} scale={[dorsal.style.width * dolphinDorsalSize, dorsal.style.height * dolphinDorsalSize, 1]}>
          <FleshyFin name="Dolphin dorsal fin" shape={dorsal.style.shape} color={colors.dark} />
        </group>
      </BodyAttachment>
      <BezierFlippers
        name="Dolphin"
        signature={props.baseSeed ?? props.pieces[0]?.artifactId ?? "new"}
        root={[0.62, -0.1]}
        skin={roundedSurfaceZ(outline, dolphinWidthRatio, 0.62, -0.1, 0)}
        // Short, stubby flippers suit the dolphin's compact body.
        size={0.72}
        colors={colors}
        animated={props.animated}
        speed={1.35}
        amount={0.11}
      />
      <BodyProportions>
        <mesh name="Dolphin mouth">
          <tubeGeometry args={[mouth, 20, 0.011, 6, false]} />
          <meshBasicMaterial color={colors.dark} />
        </mesh>
      </BodyProportions>
      {[-1, 1].map((side) => (
        <BodyAttachment key={`eye-${side}`} anchor={[1.17, 0.13, side * eyeZ]}>
        <group name={`Dolphin ${side > 0 ? "near" : "far"} eye`} position={[1.17, 0.13, side * eyeZ]}>
          <mesh scale={[0.058, 0.055, 0.028]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <MovingPupil
            position={[0.01, -0.003, side * 0.027]}
            scale={[0.024, 0.027, 0.014]}
            animated={props.animated}
            phase={side * 0.2}
            range={[0.018, 0.016]}
          />
        </group>
        </BodyAttachment>
      ))}
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="dolphin" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

function NarwhalModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  const bodyLength = 1.46;
  const bodyHeight = 0.58;
  const bodyDepth = 0.48;
  const bellyCenter: [number, number, number] = [0.42, -bodyHeight * 0.42, 0.28];
  const bellyRadii: [number, number, number] = [bodyLength * 0.7, bodyHeight * 0.42, 0.3];
  const flipperRoot: [number, number] = [0.55, -0.16];
  // The fins grow from whichever skin is outermost there: the body, or the pale belly bulging over it.
  const ellipsoidSkin = (center: [number, number, number], radii: [number, number, number]) => {
    const inside = 1 - ((flipperRoot[0] - center[0]) / radii[0]) ** 2 - ((flipperRoot[1] - center[1]) / radii[1]) ** 2;
    return inside > 0 ? center[2] + radii[2] * Math.sqrt(inside) : 0;
  };
  const bodySkin = ellipsoidSkin([0, 0, 0], [bodyLength, bodyHeight, bodyDepth]);
  // The eyes are dark beads half sunk into the head's skin.
  const eyeSkin = ellipsoidSkinZ([0, 0, 0], [bodyLength, bodyHeight, bodyDepth], bodyLength * 0.67, 0.17) ?? 0;
  // The belly only bulges out of the near side, so the far fin sits on the body itself.
  const flipperSkin = Math.max(bodySkin, ellipsoidSkin(bellyCenter, bellyRadii));
  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="glide">
      <BodyProportions>
        <mesh scale={[bodyLength, bodyHeight, bodyDepth]}><sphereGeometry args={[1, 20, 14]} /><PatternedToonMaterial color={colors.body} /></mesh>
        <mesh position={bellyCenter} scale={bellyRadii}><sphereGeometry args={[1, 20, 14]} /><meshToonMaterial color={colors.light} /></mesh>
      </BodyProportions>
      <BodyAttachment anchor={[bodyLength * 0.92, 0.03, 0]}>
        <mesh position={[bodyLength * 0.92, 0.03, 0]} scale={[0.42, 0.26, 0.28]}><sphereGeometry args={[1, 20, 14]} /><meshToonMaterial color={colors.light} /></mesh>
      </BodyAttachment>
      <BodyAttachment anchor={[0.05, bodyHeight * 0.92, 0]}>
        <mesh position={[0.05, bodyHeight * 0.92, -0.03]} rotation={[0, 0, -0.22]} scale={[0.34, 0.46, 0.09]}><coneGeometry args={[1, 1, 12]} /><meshToonMaterial color={colors.dark} /></mesh>
      </BodyAttachment>
      <BezierFlippers
        name="Narwhal"
        signature={props.baseSeed ?? props.pieces[0]?.artifactId ?? "new"}
        root={flipperRoot}
        skin={flipperSkin}
        farSkin={bodySkin}
        size={1.05}
        colors={colors}
        animated={props.animated}
        speed={1.2}
        amount={0.12}
      />
      <BodyAttachment anchor={[-bodyLength * 0.93, 0, 0]}>
        <group position={[-bodyLength * 0.93, 0, 0]}>
          <ArticulatedMammalTail animated={props.animated} colors={colors} />
        </group>
      </BodyAttachment>
      {[-1, 1].map((side) => (
        <BodyAttachment key={`eye-${side}`} anchor={[bodyLength * 0.67, 0.17, side * eyeSkin]}>
          <MovingPupil position={[bodyLength * 0.67, 0.17, side * (eyeSkin + 0.035)]} scale={0.075} animated={props.animated} phase={side * 0.2} />
        </BodyAttachment>
      ))}
      <BodyAttachment anchor={[bodyLength * 0.92, 0.03, 0]}>
        <mesh position={[bodyLength * 1.28, 0.13, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.11, 1.05, 0.11]}><coneGeometry args={[1, 1, 12]} /><meshToonMaterial color="#F3F0E8" /></mesh>
      </BodyAttachment>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="narwhal" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

/** Ribs running across each shell valve, following its curve so they lie on it all the way. */
const clamRidges = [-0.72, -0.36, 0, 0.36, 0.72].map((x) => new THREE.CatmullRomCurve3(
  Array.from({ length: 7 }, (_, index) => {
    const y = -0.21 + (index / 6) * 0.42;
    return new THREE.Vector3(x, y, (ellipsoidSkinZ([0, 0, 0], [1.22 * 0.88, 0.58 * 0.88, 0.28 * 0.88], x, y) ?? 0) - 0.008);
  }),
));

function ClamModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="pulse" grounded={props.grounded}>
      {[-1, 1].map((side) => (
        <MovingPart key={side} animated={props.animated} phase={side} base={side * -0.2} amount={0.08} speed={0.9}>
        <BodyProportions>
        <group position={[0, side * 0.28, 0]}>
          <mesh scale={[1.22, 0.58, 0.28]}>
            <sphereGeometry args={[0.88, 20, 14]} />
            <PatternedToonMaterial color={side > 0 ? colors.body : colors.dark} />
          </mesh>
          {clamRidges.map((ridge, index) => (
            <mesh key={index}>
              <tubeGeometry args={[ridge, 12, 0.035, 7, false]} />
              <meshToonMaterial color={colors.light} />
            </mesh>
          ))}
        </group>
        </BodyProportions>
        </MovingPart>
      ))}
      <mesh position={[0, 0, 0.36]} scale={0.24}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshStandardMaterial color="#F4EAF3" emissive={colors.accent} emissiveIntensity={0.36} roughness={0.12} />
      </mesh>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="clam" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

function ArticulatedPufferfishTail({
  animated,
  colors,
}: {
  animated?: boolean;
  colors: ReturnType<typeof aquaticPalette>;
}) {
  const connectorRef = useRef<THREE.Group>(null);
  const finsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (animated === false) return;
    const swim = clock.elapsedTime * 1.75;
    if (connectorRef.current) connectorRef.current.rotation.z = Math.sin(swim) * 0.18;
    if (finsRef.current) finsRef.current.rotation.z = Math.sin(swim - 0.68) * 0.14;
  });

  return (
    <group ref={connectorRef} position={[-0.98, 0, -0.02]}>
      <mesh
        name="Pufferfish tail connector"
        position={[-0.3, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[0.13, 0.6, 0.14]}
      >
        <cylinderGeometry args={[0.48, 1, 1, 14]} />
        <PatternedToonMaterial color={colors.body} repeat={[2, 1]} />
      </mesh>
      <group ref={finsRef} position={[-0.6, 0, 0]}>
        {[-1, 1].map((side) => (
          <mesh
            name={`Pufferfish tail fin ${side < 0 ? "lower" : "upper"}`}
            key={side}
            position={[-0.22, side * 0.22, 0]}
            rotation={[0, 0, side * -0.54]}
            scale={[0.52, 0.24, 0.09]}
          >
            <sphereGeometry args={[1, 18, 12]} />
            <meshToonMaterial color={colors.accent} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** The pouting mouth sits on the round snout, turned to lie flat against it. */
const pufferfishMouth = (() => {
  const radii: Point3 = [1.16, 0.82, 0.62];
  const [x, y] = [1.0, -0.1];
  const z = ellipsoidSkinZ([0, 0, 0], radii, x, y) ?? 0;
  return { position: [x, y, z] as Point3, turn: Math.atan2(x / radii[0] ** 2, z / radii[2] ** 2) };
})();

function PufferfishModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="pulse">
      <BodyProportions>
      <mesh scale={[1.16, 0.82, 0.62]}>
        <sphereGeometry args={[1, 20, 14]} />
        <PatternedToonMaterial color={colors.body} />
      </mesh>
      {Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 1.15, Math.sin(angle) * 0.82, 0]} rotation={[0, 0, angle - Math.PI / 2]} scale={[0.085, 0.25 + (index % 3) * 0.045, 0.085]}>
            <coneGeometry args={[1, 1, 8]} />
            <meshToonMaterial color={index % 2 ? colors.light : colors.accent} />
          </mesh>
        );
      })}
      <ArticulatedPufferfishTail animated={props.animated} colors={colors} />
      </BodyProportions>
      <BodyAttachment anchor={[-0.2, 0.8, 0]}>
        <mesh position={[-0.2, 0.82, -0.04]} rotation={[0, 0, -0.16]} scale={[0.34, 0.38, 0.08]}>
          <coneGeometry args={[1, 1, 12]} />
          <meshToonMaterial color={colors.dark} />
        </mesh>
      </BodyAttachment>
      <BodyAttachment anchor={[0.05, -0.8, 0]}>
        <mesh position={[0.05, -0.74, -0.02]} rotation={[0, 0, Math.PI + 0.18]} scale={[0.28, 0.34, 0.08]}>
          <coneGeometry args={[1, 1, 12]} />
          <meshToonMaterial color={colors.dark} />
        </mesh>
      </BodyAttachment>
      <BodyProportions>
        <mesh position={[0.08, -0.08, 0.62]} rotation={[0.18, 0, -0.18]} scale={[0.38, 0.18, 0.07]}>
          <sphereGeometry args={[1, 16, 10]} />
          <meshToonMaterial color={colors.light} />
        </mesh>
      </BodyProportions>
      {[-1, 1].map((side) => (
        <BodyAttachment key={`eye-${side}`} anchor={[0.62, 0.25, side * 0.5]}>
        <group position={[0.62, 0.25, side * 0.58]}>
          <mesh scale={[0.15, 0.17, 0.09]}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshToonMaterial color="#F3F0E8" />
          </mesh>
          <MovingPupil position={[0.035, 0, side * 0.085]} scale={[0.06, 0.075, 0.035]} animated={props.animated} phase={side * 0.2} />
        </group>
        </BodyAttachment>
      ))}
      <BodyAttachment anchor={pufferfishMouth.position}>
        <mesh position={pufferfishMouth.position} rotation={[0, pufferfishMouth.turn, 0]} scale={[0.12, 0.12, 0.05]}>
          <torusGeometry args={[1, 0.22, 7, 16]} />
          <meshToonMaterial color={colors.dark} />
        </mesh>
      </BodyAttachment>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="pufferfish" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

export function AdditionalAquaticModel({ form, ...props }: AquaticModelProps & { form: AdditionalForm }) {
  if (form === "turtle") return <TurtleModel {...props} />;
  if (form === "ray") return <RayModel {...props} />;
  if (form === "starfish") return <StarfishModel {...props} />;
  if (form === "seahorse") return <SeahorseModel {...props} />;
  if (form === "seal") return <SealModel {...props} />;
  if (form === "shrimp") return <ShrimpModel {...props} />;
  if (form === "whale") return <BlueWhaleModel {...props} />;
  if (form === "dolphin") return <DolphinModel {...props} />;
  if (form === "narwhal") return <NarwhalModel {...props} />;
  if (form === "clam") return <ClamModel {...props} />;
  return <PufferfishModel {...props} />;
}
