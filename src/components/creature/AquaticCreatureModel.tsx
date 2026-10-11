"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CreatureModel, type CreaturePiece } from "@/components/creature/CreatureModel";
import { AdditionalAquaticModel } from "@/components/creature/AdditionalAquaticModels";
import { aquaticPalette, TraitMarks } from "@/components/creature/AquaticModelShared";
import { Claw } from "@/components/creature/parts/Claw";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import { applyCreatureModelOverrides } from "@/lib/creature/modelOverrides";
import type { CreaturePartId } from "@/types/exhibition";
import { creatureColorPalette, type CreatureColorPalette } from "@/lib/creature/colorPalettes";
import { creaturePattern, type CreaturePattern } from "@/lib/creature/patterns";
import { PatternedToonMaterial } from "@/components/creature/CreaturePatternMaterial";
import { BodyAttachment, BodyProportions, CreatureLookContext } from "@/components/creature/CreatureLook";
import { creatureProportions, type CreatureProportions } from "@/lib/creature/proportions";

function CrabModel({
  pieces,
  baseSeed,
  animated,
  grounded,
  highlightedPart,
  scale,
  colorPalette,
}: AquaticModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const legs = useRef<Array<THREE.Group | null>>([]);
  const lowerLegs = useRef<Array<THREE.Mesh | null>>([]);
  const pupils = useRef<Array<THREE.Mesh | null>>([]);
  const colors = aquaticPalette(pieces, baseSeed, colorPalette);

  useFrame(({ clock }) => {
    if (animated === false || !groupRef.current) return;
    const wave = clock.elapsedTime;
    const stride = wave * 3.1;
    groupRef.current.position.y = grounded ? Math.abs(Math.sin(stride)) * 0.04 : Math.sin(wave * 1.3) * 0.045;
    groupRef.current.rotation.z = Math.sin(wave * 0.8) * 0.025;
    legs.current.forEach((leg, index) => {
      if (!leg) return;
      const side = index < 3 ? -1 : 1;
      const legIndex = index % 3;
      const alternatingPhase = (legIndex + (side > 0 ? 1 : 0)) % 2 === 0 ? 0 : Math.PI;
      const step = Math.sin(stride + alternatingPhase);
      leg.rotation.z = side * (0.72 + legIndex * 0.17 + step * 0.24);
      leg.rotation.x = Math.max(0, step) * side * 0.22;
      const lowerLeg = lowerLegs.current[index];
      if (lowerLeg) lowerLeg.rotation.z = side * (0.42 - step * 0.34);
    });
    pupils.current.forEach((pupil, index) => {
      if (!pupil) return;
      pupil.position.x = Math.sin(wave * 0.72 + index * 0.4) * 0.035;
      pupil.position.y = 0.21 + Math.cos(wave * 0.55 + index * 0.3) * 0.025;
    });
  });

  return (
    <group ref={groupRef} scale={scale}>
      <BodyProportions>
        <mesh scale={[1.28, 0.68, 0.42]}>
          <sphereGeometry args={[0.82, 20, 14]} />
          <PatternedToonMaterial color={colors.body} />
        </mesh>
        <mesh position={[0, -0.24, 0.3]} scale={[1.02, 0.34, 0.12]}>
          <sphereGeometry args={[0.78, 20, 14]} />
          <meshToonMaterial color={colors.light} />
        </mesh>
      </BodyProportions>
      {[-1, 1].map((side, index) => (
        <BodyAttachment key={`eye-${side}`} anchor={[side * 0.44, 0.44, 0.22]}>
        <group position={[side * 0.44, 0.57, 0.22]}>
          <mesh scale={[0.08, 0.26, 0.08]}>
            <cylinderGeometry args={[1, 1, 1, 10]} />
            <meshToonMaterial color={colors.dark} />
          </mesh>
          <mesh position={[0, 0.2, 0]} scale={0.13}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshToonMaterial color="#F3F0E8" />
          </mesh>
          <mesh ref={(node) => { pupils.current[index] = node; }} position={[0, 0.21, 0.11]} scale={0.052}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial color="#071015" />
          </mesh>
        </group>
        </BodyAttachment>
      ))}
      {/* Legs and claws move with the stretched shell, so they stay rooted in it whatever its proportions. */}
      {[-1, 1].flatMap((side, sideIndex) => [0, 1, 2].map((leg) => (
        <BodyAttachment key={`leg-${side}-${leg}`} anchor={[side * (0.72 + leg * 0.09), 0.08 - leg * 0.22, 0]}>
        <group ref={(node) => { legs.current[sideIndex * 3 + leg] = node; }} position={[side * (0.72 + leg * 0.09), 0.08 - leg * 0.22, 0]} rotation={[0, 0, side * (0.72 + leg * 0.17)]}>
          <mesh position={[0, -0.34, 0]} scale={[0.075, 0.46, 0.075]}>
            <cylinderGeometry args={[1, 0.78, 1, 8]} />
            <meshToonMaterial color={colors.dark} />
          </mesh>
          <mesh ref={(node) => { lowerLegs.current[sideIndex * 3 + leg] = node; }} position={[side * 0.11, -0.72, 0]} rotation={[0, 0, side * 0.42]} scale={[0.06, 0.38, 0.06]}>
            <cylinderGeometry args={[1, 0.7, 1, 8]} />
            <meshToonMaterial color={colors.body} />
          </mesh>
        </group>
        </BodyAttachment>
      )))}
      {([-1, 1] as const).map((side) => (
        <BodyAttachment key={`claw-${side}`} anchor={[side * 0.88, 0.18, 0.14]}>
          <Claw
            side={side}
            position={[side * 0.88, 0.18, 0.14]}
            phase={side > 0 ? 0.37 : 0}
            scale={0.9}
            pose={{ yaw: -0.35 }}
            color={colors.body}
            animated={animated !== false}
          />
        </BodyAttachment>
      ))}
      <TraitMarks pieces={pieces} baseSeed={baseSeed} form="crab" highlightedPart={highlightedPart} />
    </group>
  );
}

function makeTentacleCurve(index: number, spread = 1) {
  const x = (index - 3) * 0.2 * spread;
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(x * 0.55, -0.22, 0),
    new THREE.Vector3(x, -0.78, Math.sin(index) * 0.08),
    new THREE.Vector3(x * 0.68 + Math.sin(index * 1.7) * 0.2, -1.42, 0),
    new THREE.Vector3(x + Math.cos(index) * 0.18, -2.02 + (index % 2) * 0.18, 0),
  ]);
}

function JellyfishModel({
  pieces,
  baseSeed,
  animated,
  highlightedPart,
  scale,
  colorPalette,
}: AquaticModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tentacles = useRef<Array<THREE.Mesh | null>>([]);
  const colors = aquaticPalette(pieces, baseSeed, colorPalette);
  const curves = useMemo(() => Array.from({ length: 7 }, (_, index) => makeTentacleCurve(index)), []);

  useFrame(({ clock }) => {
    if (animated === false || !groupRef.current) return;
    const pulse = Math.sin(clock.elapsedTime * 1.65);
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.86) * 0.09;
    groupRef.current.scale.set(scale * (1 + pulse * 0.025), scale * (1 - pulse * 0.035), scale);
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.56) * 0.055;
    tentacles.current.forEach((tentacle, index) => {
      if (tentacle) tentacle.rotation.z = Math.sin(clock.elapsedTime * 0.95 + index * 0.7) * 0.075;
    });
  });

  return (
    <group ref={groupRef} scale={scale} position={[0, 0.48, 0]}>
      <BodyProportions>
        <mesh scale={[1.05, 0.92, 0.64]}>
          <sphereGeometry args={[1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <PatternedToonMaterial color={colors.body} transparent opacity={0.76} depthWrite={false} />
        </mesh>
        {/* The rim disc fills the bell's mouth right up to its edge. */}
        <mesh position={[0, -0.03, 0]} scale={[1.08, 0.18, 0.67]}>
          <sphereGeometry args={[1, 20, 12]} />
          <meshToonMaterial color={colors.light} transparent opacity={0.62} depthWrite={false} />
        </mesh>
      </BodyProportions>
      {curves.map((curve, index) => (
        <mesh ref={(node) => { tentacles.current[index] = node; }} key={index}>
          <tubeGeometry args={[curve, 22, index % 2 ? 0.035 : 0.052, 7, false]} />
          <meshToonMaterial color={index % 3 === 0 ? colors.accent : colors.body} transparent opacity={0.68} />
        </mesh>
      ))}
      <TraitMarks pieces={pieces} baseSeed={baseSeed} form="jellyfish" highlightedPart={highlightedPart} />
    </group>
  );
}

function makeOctopusArm(index: number) {
  const angle = (index / 8) * Math.PI * 2;
  const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(direction.x * 0.28, -0.38 + direction.y * 0.12, 0),
    new THREE.Vector3(direction.x * 0.72, -0.78 + direction.y * 0.3, -0.05),
    new THREE.Vector3(direction.x * 1.05 + Math.sin(index) * 0.12, -1.16 + direction.y * 0.38, 0),
    new THREE.Vector3(direction.x * 1.28 + Math.cos(index) * 0.2, -1.42 + direction.y * 0.34, 0.06),
  ]);
}

function OctopusModel({
  pieces,
  baseSeed,
  animated,
  highlightedPart,
  scale,
  colorPalette,
}: AquaticModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const armRefs = useRef<Array<THREE.Mesh | null>>([]);
  const pupilRefs = useRef<Array<THREE.Mesh | null>>([]);
  const colors = aquaticPalette(pieces, baseSeed, colorPalette);
  const arms = useMemo(() => Array.from({ length: 8 }, (_, index) => makeOctopusArm(index)), []);

  useFrame(({ clock }) => {
    if (animated === false || !groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 1.05) * 0.065;
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.72) * 0.04;
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.42) * 0.12;
    armRefs.current.forEach((arm, index) => {
      if (arm) arm.rotation.z = Math.sin(index * 2.1) * 0.08 + Math.sin(clock.elapsedTime * 1.1 + index * 0.8) * 0.09;
    });
    pupilRefs.current.forEach((pupil, index) => {
      if (!pupil) return;
      pupil.position.x = Math.sin(clock.elapsedTime * 0.68 + index * 0.35) * 0.035;
      pupil.position.y = -0.01 + Math.cos(clock.elapsedTime * 0.51 + index * 0.25) * 0.025;
    });
  });

  return (
    <group ref={groupRef} scale={scale} position={[0, 0.38, 0]}>
      {arms.map((curve, index) => (
        <mesh ref={(node) => { armRefs.current[index] = node; }} key={index} rotation={[0, 0, Math.sin(index * 2.1) * 0.08]}>
          <tubeGeometry args={[curve, 24, 0.085 - index * 0.003, 8, false]} />
          <meshToonMaterial color={index % 3 === 0 ? colors.accent : colors.dark} />
        </mesh>
      ))}
      <BodyProportions origin={[0, 0.18, 0]}>
        <mesh position={[0, 0.18, 0]} scale={[0.78, 0.94, 0.58]}>
          <sphereGeometry args={[0.9, 20, 14]} />
          <PatternedToonMaterial color={colors.body} />
        </mesh>
      </BodyProportions>
      <mesh position={[0, -0.34, 0.02]} scale={[0.94, 0.52, 0.62]}>
        <sphereGeometry args={[0.82, 20, 14]} />
        <meshToonMaterial color={colors.light} />
      </mesh>
      {[-1, 1].map((side, index) => (
        <BodyAttachment key={side} anchor={[side * 0.28, 0.2, 0.5]} origin={[0, 0.18, 0]}>
        <group position={[side * 0.28, 0.2, 0.5]}>
          <mesh scale={[0.15, 0.2, 0.1]}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshToonMaterial color="#F3F0E8" />
          </mesh>
          <mesh ref={(node) => { pupilRefs.current[index] = node; }} position={[0, -0.01, 0.09]} scale={[0.055, 0.1, 0.04]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial color="#071015" />
          </mesh>
        </group>
        </BodyAttachment>
      ))}
      <TraitMarks pieces={pieces} baseSeed={baseSeed} form="octopus" highlightedPart={highlightedPart} />
    </group>
  );
}

export type AquaticModelProps = {
  pieces: CreaturePiece[];
  baseSeed?: string;
  animated?: boolean;
  highlightedPart?: CreaturePartId;
  scale: number;
  grounded?: boolean;
  colorPalette?: CreatureColorPalette;
};

export function AquaticCreatureModel({
  form,
  pieces,
  baseSeed,
  animated = true,
  highlightedPart,
  scale = 1,
  grounded = false,
  colorPalette,
  pattern,
  proportions,
}: AquaticModelProps & {
  form: AquaticForm;
  /** The skin pattern; previews without a stored one draw it from the creature's seed. */
  pattern?: CreaturePattern;
  /** How the main body is stretched; previews without stored ones draw them from the seed. */
  proportions?: CreatureProportions;
}) {
  const editorRootRef = useRef<THREE.Group>(null);
  const signature = baseSeed ?? pieces[0]?.artifactId ?? "new";
  const look = useMemo(
    () => ({
      pattern: pattern ?? creaturePattern(signature),
      markingColor: (colorPalette ?? creatureColorPalette(signature)).marking,
      proportions: proportions ?? creatureProportions(signature),
    }),
    [colorPalette, pattern, proportions, signature],
  );

  useLayoutEffect(() => {
    if (editorRootRef.current) applyCreatureModelOverrides(editorRootRef.current, form);
  }, [form, pieces]);

  let model;
  if (form === "crab") {
    model = <CrabModel pieces={pieces} baseSeed={baseSeed} animated={animated} grounded={grounded} highlightedPart={highlightedPart} scale={scale} colorPalette={colorPalette} />;
  } else if (form === "jellyfish") {
    model = <JellyfishModel pieces={pieces} baseSeed={baseSeed} animated={animated} highlightedPart={highlightedPart} scale={scale} colorPalette={colorPalette} />;
  } else if (form === "octopus") {
    model = <OctopusModel pieces={pieces} baseSeed={baseSeed} animated={animated} highlightedPart={highlightedPart} scale={scale} colorPalette={colorPalette} />;
  } else if (form !== "fish") {
    model = <AdditionalAquaticModel form={form} pieces={pieces} baseSeed={baseSeed} animated={animated} grounded={grounded} highlightedPart={highlightedPart} scale={scale} colorPalette={colorPalette} />;
  } else {
    model = <CreatureModel pieces={pieces} baseSeed={baseSeed} animated={animated} highlightedPart={highlightedPart} scale={scale} colorPalette={colorPalette} />;
  }
  return (
    <CreatureLookContext.Provider value={look}>
      <group ref={editorRootRef}>{model}</group>
    </CreatureLookContext.Provider>
  );
}
