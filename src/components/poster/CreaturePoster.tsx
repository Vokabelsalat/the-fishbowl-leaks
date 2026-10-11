"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AquaticCreatureModel } from "@/components/creature/AquaticCreatureModel";
import type { CreaturePiece } from "@/components/creature/CreatureModel";
import { BiomeBackdrop } from "@/components/visualization/BiomeBackdrop";
import { artifacts } from "@/data/artifacts";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import { creaturePattern, patternForTraitCount } from "@/lib/creature/patterns";

/** One creature in the ensemble: where it stands, how large it is and which way it looks. */
type Role = { form: AquaticForm; position: [number, number, number]; scale: number; turn: number; tilt?: number; traits: [number, number] };

// The billing order of a movie poster: a looming antagonist above, the hero in the middle,
// supporting cast around it and an army along the bottom.
// Turning by -π/2 brings a creature's head (+x) round to face the camera, like a cast lined up for its portrait.
const facing = -Math.PI / 2;

const cast: Role[] = [
  { form: "whale", position: [1.5, 4.3, -10], scale: 2.6, turn: facing - 0.4, traits: [3, 5] },
  { form: "octopus", position: [-2.45, 3.1, -4], scale: 1, turn: 0.2, tilt: -0.1, traits: [3, 5] },
  { form: "narwhal", position: [2.5, 1.7, -2], scale: 0.72, turn: facing - 0.5, traits: [2, 4] },
  { form: "jellyfish", position: [-2.55, 0.45, -1], scale: 0.6, turn: 0.2, traits: [2, 3] },
  { form: "fish", position: [-0.05, 0.45, 1.5], scale: 1.6, turn: facing + 0.42, traits: [4, 6] },
  { form: "seal", position: [2.3, -0.65, 0], scale: 0.62, turn: facing - 0.4, traits: [2, 3] },
  { form: "seahorse", position: [-2.05, -1.05, 1], scale: 0.5, turn: facing + 0.55, traits: [2, 3] },
  { form: "pufferfish", position: [-0.75, -1.6, 2.2], scale: 0.38, turn: facing + 0.3, traits: [2, 3] },
  { form: "dolphin", position: [1.05, -1.6, 1.6], scale: 0.48, turn: facing - 0.5, traits: [2, 3] },
  { form: "crab", position: [-1.95, -2.08, 1.8], scale: 0.42, turn: 0.3, traits: [2, 3] },
  { form: "starfish", position: [2.2, -2.05, 1.6], scale: 0.3, turn: 0, tilt: 0.9, traits: [1, 2] },
];

function seededRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    return hash / 4294967296;
  };
}

function randomPieces(random: () => number, [fewest, most]: [number, number]): CreaturePiece[] {
  const count = fewest + Math.floor(random() * (most - fewest + 1));
  const shuffled = [...artifacts].sort(() => random() - 0.5);
  return shuffled.slice(0, count).map((artifact) => ({ artifactId: artifact.id, partId: artifact.creaturePart.id, color: artifact.color }));
}

function Ensemble({ seed }: { seed: string }) {
  const members = useMemo(() => {
    const random = seededRandom(seed);
    const leads = cast.map((role, index) => ({ ...role, key: `${role.form}-${index}`, creatureSeed: `${seed}:${role.form}:${index}`, pieces: randomPieces(random, role.traits) }));
    // A school of small fish marching in from the dark, like the army at the foot of the poster.
    const school = Array.from({ length: 22 }, (_, index) => {
      const row = index % 2;
      const x = -4.6 + (index / 21) * 9.2 + (random() - 0.5) * 0.3;
      return {
        form: "fish" as AquaticForm,
        position: [x, -2.85 - row * 0.28 + (random() - 0.5) * 0.1, -2.5 - row * 1.2] as [number, number, number],
        scale: 0.17 + random() * 0.03,
        turn: facing + (x < 0 ? 0.55 : -0.55),
        tilt: 0,
        key: `school-${index}`,
        creatureSeed: `${seed}:school:${index}`,
        pieces: randomPieces(random, [0, 1]),
      };
    });
    return [...school, ...leads];
  }, [seed]);

  return (
    <>
      {members.map((member) => (
        <group key={member.key} position={member.position} rotation={[0, member.turn, member.tilt ?? 0]}>
          <AquaticCreatureModel
            form={member.form}
            pieces={member.pieces}
            baseSeed={member.creatureSeed}
            pattern={patternForTraitCount(creaturePattern(member.creatureSeed), member.pieces.length)}
            scale={member.scale}
            animated={false}
          />
        </group>
      ))}
    </>
  );
}

/** Marine snow drifting through the scene, standing in for the stars of a space poster. */
function MarineSnow({ seed }: { seed: string }) {
  const geometry = useMemo(() => {
    const random = seededRandom(`${seed}:snow`);
    const positions = new Float32Array(900 * 3);
    for (let index = 0; index < 900; index += 1) {
      positions[index * 3] = (random() - 0.5) * 22;
      positions[index * 3 + 1] = (random() - 0.5) * 26;
      positions[index * 3 + 2] = -14 + random() * 12;
    }
    const snow = new THREE.BufferGeometry();
    snow.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return snow;
  }, [seed]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#cfeee6" size={0.045} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

/** `width` fixes the poster's size in pixels for exports; without it the poster fits the window. */
export function CreaturePoster({ seed, width }: { seed: string; width?: number }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", seed);
    console.info(`Poster seed: ${seed}\nRecreate it at ${url.href}`);
  }, [seed]);

  return (
    <main className="grid min-h-dvh place-items-center bg-black">
      {/* Keeps the development badge out of poster captures. */}
      <style>{"nextjs-portal { display: none; }"}</style>
      <article
        className={`creature-poster film-grain relative aspect-[2/3] ${width ? "" : "h-[min(100dvh,150vw)]"} overflow-hidden bg-[var(--abyss)] text-[var(--foam)]`}
        style={width ? { width, height: width * 1.5 } : undefined}
        aria-label="The Fishbowl Leaks poster"
      >
        <BiomeBackdrop progress={0.82} quiet />
        <div className="creature-poster-light absolute inset-0" aria-hidden="true" />
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0.4, 13], fov: 42, near: 0.1, far: 60 }}
            dpr={[1, 2]}
            resize={{ debounce: 0 }}
            gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
          >
            <fog attach="fog" args={["#031015", 14, 26]} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[1, 4, 9]} intensity={1.8} color="#FFF4DF" />
            {/* A hot rim from the left and a cold one from the right split the cast into two camps. */}
            <directionalLight position={[-8, 2, -2]} intensity={3.4} color="#FF7557" />
            <directionalLight position={[8, 1, -2]} intensity={3.2} color="#58D6FF" />
            <pointLight position={[0, 1.4, 5]} intensity={6} distance={9} color="#B9FFDC" />
            <MarineSnow seed={seed} />
            <Ensemble seed={seed} />
          </Canvas>
        </div>
        <div className="creature-poster-fade absolute inset-x-0 bottom-0 h-[34%]" aria-hidden="true" />
        <header className="creature-poster-title absolute inset-x-0 bottom-[6.5%] text-center">
          <p className="mb-[0.9em] text-[0.17em] tracking-[0.02em] text-white/80">It was built to classify. It could not contain them.</p>
          <h1 className="font-display leading-[0.78] tracking-[-0.075em]">
            The Fishbowl
            <span className="block italic text-[var(--phosphor)]">Leaks</span>
          </h1>
        </header>
      </article>
    </main>
  );
}
