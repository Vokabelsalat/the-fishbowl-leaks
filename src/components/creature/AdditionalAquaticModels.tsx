"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { aquaticPalette, TraitMarks } from "@/components/creature/AquaticModelShared";
import type { AquaticModelProps } from "@/components/creature/AquaticCreatureModel";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import { PatternedToonMaterial } from "@/components/creature/CreaturePatternMaterial";
import { BodyAttachment, BodyProportions } from "@/components/creature/CreatureLook";
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

function MovingPupil({ position, scale, animated, phase = 0, range = [0.035, 0.025] }: { position: [number, number, number]; scale: number | [number, number, number]; animated?: boolean; phase?: number; range?: [number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (animated === false || !ref.current) return;
    ref.current.position.x = position[0] + Math.sin(clock.elapsedTime * 0.65 + phase) * range[0];
    ref.current.position.y = position[1] + Math.cos(clock.elapsedTime * 0.52 + phase) * range[1];
  });
  return <mesh ref={ref} position={position} scale={scale}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#071015" /></mesh>;
}

function PairOfEyes({ x = 0.34, y = 0.25, z = 0.55, animated }: { x?: number; y?: number; z?: number; animated?: boolean }) {
  return [-1, 1].map((side) => (
    <group key={side} position={[side * x, y, z]}>
      <mesh scale={[0.12, 0.15, 0.08]}>
        <sphereGeometry args={[1, 14, 12]} />
        <meshToonMaterial color="#F3F0E8" />
      </mesh>
      <MovingPupil position={[0, 0, 0.075]} scale={[0.045, 0.07, 0.03]} animated={animated} phase={side * 0.2} />
    </group>
  ));
}

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
          <mesh key={ring} position={[0, 0.03, 0.43]} scale={[ring * 1.18, ring * 0.78, 0.06]}>
            <torusGeometry args={[0.72, 0.035 + index * 0.01, 7, 24]} />
            <meshToonMaterial color={colors.light} />
          </mesh>
        ))}
      </BodyProportions>
      <mesh position={[1.12, 0.02, 0]} scale={[0.46, 0.38, 0.34]}>
        <sphereGeometry args={[0.75, 20, 14]} />
        <meshToonMaterial color={colors.light} />
      </mesh>
      <group position={[1.25, 0.12, 0.29]} scale={0.7}>{PairOfEyes({ x: 0.16, y: 0, z: 0.16, animated: props.animated })}</group>
      {[-1, 1].flatMap((side) => [-1, 1].map((front) => (
        <MovingPart key={`${side}-${front}`} animated={props.animated} phase={side * 0.8 + front} base={side * (front > 0 ? -0.58 : 0.58)} amount={0.12} speed={1.45}>
          <mesh position={[front * 0.62, side * 0.68, -0.02]} scale={[0.48, 0.2, 0.09]}><sphereGeometry args={[1, 18, 12]} /><meshToonMaterial color={colors.accent} /></mesh>
        </MovingPart>
      )))}
      <mesh position={[-1.15, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.2, 0.34, 0.12]}>
        <coneGeometry args={[1, 1, 12]} />
        <meshToonMaterial color={colors.light} />
      </mesh>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="turtle" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

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
        <BodyAttachment key={`eye-${side}`} anchor={[0.75, side * 0.24, 0.27]}>
        <group position={[0.75, side * 0.24, 0.31]}>
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
          position={[0.38 - index * 0.12, side * (0.24 + index * 0.055), 0.275]}
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

function StarfishModel(props: AquaticModelProps) {
  const colors = aquaticPalette(props.pieces, props.baseSeed, props.colorPalette);
  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="bob">
      {/* A starfish's whole star is its body. */}
      <BodyProportions>
      {Array.from({ length: 5 }, (_, index) => {
        const angle = index * Math.PI * 0.4;
        return (
          <mesh key={index} position={[Math.sin(angle) * 0.7, Math.cos(angle) * 0.7, 0]} rotation={[0, 0, -angle]} scale={[0.38, 0.92, 0.16]}>
            <capsuleGeometry args={[0.44, 0.92, 8, 14]} />
            <PatternedToonMaterial color={index % 2 ? colors.body : colors.accent} repeat={[2, 2]} />
          </mesh>
        );
      })}
      <mesh scale={[0.7, 0.7, 0.24]}>
        <sphereGeometry args={[0.72, 20, 14]} />
        <meshToonMaterial color={colors.light} />
      </mesh>
      </BodyProportions>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="starfish" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
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
      <mesh position={[1.05, 1.1, 0]} scale={[0.1, 0.12, 0.1]}>
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
          <mesh key={`rib-${index}`} position={[0.17, 0.52 - index * 0.18, 0.32]} rotation={[0, 0, 0.16]} scale={[0.3, 0.035, 0.035]}>
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
        <MovingPart key={side} animated={props.animated} phase={side} base={side * -0.46} amount={0.11} speed={1.5}>
          <mesh position={[0.25, side * 0.55, -0.02]} scale={[0.62, 0.2, 0.1]}><sphereGeometry args={[1, 18, 12]} /><meshToonMaterial color={colors.accent} /></mesh>
        </MovingPart>
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
        <MovingPart key={`leg-${index}-${depth}`} animated={props.animated} phase={index * 0.55 + depth} base={-0.18 + index * 0.035} amount={0.13} speed={2.1}>
          <group position={[0.68 - index * 0.28, -0.18 - index * 0.035, depth * 0.13]}>
            <mesh position={[0.08, -0.23, 0]} rotation={[0, 0, -0.38]} scale={[0.025, 0.28, 0.025]}>
              <cylinderGeometry args={[1, 0.7, 1, 7]} />
              <meshToonMaterial color={colors.dark} />
            </mesh>
            <mesh position={[0.22, -0.49, 0]} rotation={[0, 0, -0.68]} scale={[0.018, 0.25, 0.018]}>
              <cylinderGeometry args={[1, 0.6, 1, 7]} />
              <meshToonMaterial color={colors.dark} />
            </mesh>
          </group>
        </MovingPart>
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

const whaleWidthRatio = 0.72;
const dolphinWidthRatio = 0.74;

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
  const flipper = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.14, 0.08);
    shape.bezierCurveTo(-0.1, 0.02, -0.58, -0.2, -0.86, -0.48);
    shape.bezierCurveTo(-1, -0.68, -0.82, -0.82, -0.56, -0.75);
    shape.bezierCurveTo(-0.26, -0.61, 0.02, -0.28, 0.13, -0.11);
    shape.quadraticCurveTo(0.22, -0.01, 0.14, 0.08);
    shape.closePath();
    return shape;
  }, []);
  const bodyGeometry = useMemo(() => roundedBody(body, whaleWidthRatio), [body]);
  const bellyGeometry = useMemo(() => roundedBody(body, whaleWidthRatio, belly, 1.012), [body, belly]);
  const outline = useMemo(() => outlineOf(body), [body]);
  const mouth = useMemo(() => onRoundedSurface(outline, whaleWidthRatio, [[1.73, -0.02], [1.25, -0.11], [0.7, -0.17], [0.18, -0.18]]), [outline]);
  const throatGrooves = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const y = -0.22 - index * 0.034;
    const endX = 0.05 - index * 0.07;
    return onRoundedSurface(outline, whaleWidthRatio, [[1.52 - index * 0.025, y + 0.05], [1.08, y], [0.55, y - 0.015], [endX, y + 0.01]]);
  }), [outline]);
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
      <MovingPart animated={props.animated} phase={0.6} base={-0.06} amount={0.08} speed={1.05}>
        <mesh name="Blue whale far flipper" position={[0.3, -0.13, -0.3]} scale={[0.88, 0.88, 0.88]}>
          <extrudeGeometry args={[flipper, { depth: 0.1, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 12 }]} />
          <meshToonMaterial color={colors.dark} side={THREE.DoubleSide} />
        </mesh>
      </MovingPart>
      <MovingPart animated={props.animated} phase={0} base={0.03} amount={0.075} speed={1.05}>
        <mesh name="Blue whale near flipper" position={[0.43, -0.17, 0.22]}>
          <extrudeGeometry args={[flipper, { depth: 0.1, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 12 }]} />
          <meshToonMaterial color={colors.accent} side={THREE.DoubleSide} />
        </mesh>
      </MovingPart>
      <BodyProportions>
        <mesh name="Blue whale mouth">
          <tubeGeometry args={[mouth, 28, 0.014, 7, false]} />
          <meshBasicMaterial color={colors.dark} />
        </mesh>
        {throatGrooves.map((groove, index) => (
          <mesh name="Blue whale throat groove" key={index}>
            <tubeGeometry args={[groove, 20, 0.006, 5, false]} />
            <meshBasicMaterial color={colors.dark} transparent opacity={0.5} />
          </mesh>
        ))}
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
  const dorsalFin = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.48, 0);
    shape.lineTo(0.32, 0);
    shape.bezierCurveTo(0.23, 0.1, 0.08, 0.43, -0.08, 0.52);
    shape.bezierCurveTo(-0.24, 0.57, -0.29, 0.2, -0.48, 0);
    shape.closePath();
    return shape;
  }, []);
  const flipper = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.12, 0.08);
    shape.bezierCurveTo(-0.12, 0.02, -0.5, -0.18, -0.72, -0.4);
    shape.bezierCurveTo(-0.86, -0.56, -0.7, -0.7, -0.48, -0.65);
    shape.bezierCurveTo(-0.22, -0.5, 0.02, -0.26, 0.11, -0.1);
    shape.quadraticCurveTo(0.18, -0.01, 0.12, 0.08);
    shape.closePath();
    return shape;
  }, []);
  const bodyGeometry = useMemo(() => roundedBody(body, dolphinWidthRatio), [body]);
  const bellyGeometry = useMemo(() => roundedBody(body, dolphinWidthRatio, belly, 1.012), [body, belly]);
  const eyeZ = useMemo(() => roundedSurfaceZ(outlineOf(body), dolphinWidthRatio, 1.17, 0.13, 0), [body]);
  const mouth = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.75, -0.045, 0.095),
    new THREE.Vector3(1.55, -0.055, 0.12),
    new THREE.Vector3(1.34, -0.07, 0.15),
    new THREE.Vector3(1.16, -0.085, 0.19),
  ]), []);

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
      <BodyAttachment anchor={[0, 0.48, 0]}>
        <mesh name="Dolphin dorsal fin" position={[0, 0.48, -0.075]}>
          <extrudeGeometry args={[dorsalFin, { depth: 0.15, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 10 }]} />
          <meshToonMaterial color={colors.dark} side={THREE.DoubleSide} />
        </mesh>
      </BodyAttachment>
      <MovingPart animated={props.animated} phase={0.65} base={-0.04} amount={0.11} speed={1.35}>
        <mesh name="Dolphin far flipper" position={[0.48, -0.12, -0.26]} scale={[0.84, 0.84, 0.84]}>
          <extrudeGeometry args={[flipper, { depth: 0.09, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.032, bevelThickness: 0.032, curveSegments: 12 }]} />
          <meshToonMaterial color={colors.dark} side={THREE.DoubleSide} />
        </mesh>
      </MovingPart>
      <MovingPart animated={props.animated} phase={0} base={0.03} amount={0.11} speed={1.35}>
        <mesh name="Dolphin near flipper" position={[0.58, -0.15, 0.175]}>
          <extrudeGeometry args={[flipper, { depth: 0.09, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.032, bevelThickness: 0.032, curveSegments: 12 }]} />
          <meshToonMaterial color={colors.accent} side={THREE.DoubleSide} />
        </mesh>
      </MovingPart>
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
  return (
    <LivingGroup animated={props.animated} scale={props.scale} motion="glide">
      <BodyProportions>
        <mesh scale={[bodyLength, bodyHeight, 0.48]}><sphereGeometry args={[1, 20, 14]} /><PatternedToonMaterial color={colors.body} /></mesh>
        <mesh position={[0.42, -bodyHeight * 0.42, 0.28]} scale={[bodyLength * 0.7, bodyHeight * 0.42, 0.3]}><sphereGeometry args={[1, 20, 14]} /><meshToonMaterial color={colors.light} /></mesh>
      </BodyProportions>
      <BodyAttachment anchor={[bodyLength * 0.92, 0.03, 0]}>
        <mesh position={[bodyLength * 0.92, 0.03, 0]} scale={[0.42, 0.26, 0.28]}><sphereGeometry args={[1, 20, 14]} /><meshToonMaterial color={colors.light} /></mesh>
      </BodyAttachment>
      <BodyAttachment anchor={[0.05, bodyHeight * 0.92, 0]}>
        <mesh position={[0.05, bodyHeight * 0.92, -0.03]} rotation={[0, 0, -0.22]} scale={[0.34, 0.46, 0.09]}><coneGeometry args={[1, 1, 12]} /><meshToonMaterial color={colors.dark} /></mesh>
      </BodyAttachment>
      {[-1, 1].map((side) => (
        <MovingPart key={`flipper-${side}`} animated={props.animated} phase={side} base={side * -0.52} amount={0.12} speed={1.2}>
          <mesh position={[0.36, side * bodyHeight * 0.8, -0.06]} scale={[0.58, 0.14, 0.08]}><sphereGeometry args={[1, 18, 12]} /><meshToonMaterial color={colors.accent} /></mesh>
        </MovingPart>
      ))}
      <BodyAttachment anchor={[-bodyLength * 0.93, 0, 0]}>
        <group position={[-bodyLength * 0.93, 0, 0]}>
          <ArticulatedMammalTail animated={props.animated} colors={colors} />
        </group>
      </BodyAttachment>
      {[-1, 1].map((side) => (
        <BodyAttachment key={`eye-${side}`} anchor={[bodyLength * 0.67, 0.17, side * 0.43]}>
          <MovingPupil position={[bodyLength * 0.67, 0.17, side * 0.43]} scale={0.075} animated={props.animated} phase={side * 0.2} />
        </BodyAttachment>
      ))}
      <BodyAttachment anchor={[bodyLength * 0.92, 0.03, 0]}>
        <mesh position={[bodyLength * 1.28, 0.13, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.11, 1.05, 0.11]}><coneGeometry args={[1, 1, 12]} /><meshToonMaterial color="#F3F0E8" /></mesh>
      </BodyAttachment>
      <TraitMarks pieces={props.pieces} baseSeed={props.baseSeed} form="narwhal" highlightedPart={props.highlightedPart} />
    </LivingGroup>
  );
}

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
          {[-0.72, -0.36, 0, 0.36, 0.72].map((x) => (
            <mesh key={x} position={[x, 0, 0.25]} scale={[0.035, 0.42, 0.035]}>
              <cylinderGeometry args={[1, 1, 1, 7]} />
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
      <BodyAttachment anchor={[1.08, -0.08, 0.4]}>
        <mesh position={[1.08, -0.08, 0.48]} scale={[0.12, 0.12, 0.05]}>
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
