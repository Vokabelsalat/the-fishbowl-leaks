"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
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
// supporting cast around it and the bottom dwellers along the floor.
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
  { form: "clam", position: [0.2, -2.08, 2.0], scale: 0.44, turn: 0, traits: [1, 2] },
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

/** Extra rotation dragged onto a creature: `turn` around the vertical axis, `pitch` tipping it toward the viewer. */
export type Pose = { turn: number; pitch: number };

/** Poses travel in the URL as `key:turn:pitch` entries joined by `;`, for example `fish-4:0.35:-0.1`. */
export function parsePoses(value: string | undefined) {
  const poses: Record<string, Pose> = {};
  for (const entry of value?.split(";") ?? []) {
    const [key, turn, pitch] = entry.split(":");
    if (key && Number.isFinite(Number(turn)) && Number.isFinite(Number(pitch))) poses[key] = { turn: Number(turn), pitch: Number(pitch) };
  }
  return poses;
}

function formatPoses(poses: Record<string, Pose>) {
  return Object.entries(poses)
    .filter(([, pose]) => pose.turn !== 0 || pose.pitch !== 0)
    .map(([key, pose]) => `${key}:${pose.turn.toFixed(2)}:${pose.pitch.toFixed(2)}`)
    .join(";");
}

/** Writes the seed and poses into the address bar and the console, so the poster can be recreated from the link. */
function logPosterLink(seed: string, poses: Record<string, Pose>) {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", seed);
  const pose = formatPoses(poses);
  if (pose) url.searchParams.set("pose", pose);
  else url.searchParams.delete("pose");
  window.history.replaceState(null, "", url);
  console.info(`Poster seed: ${seed}\nRecreate it at ${url.href}`);
}

function setCursor(cursor: string) {
  document.body.style.cursor = cursor;
}

/** Radians a creature turns per pixel dragged. */
const dragTurnRate = 0.012;

function Ensemble({ seed, initialPoses }: { seed: string; initialPoses: Record<string, Pose> }) {
  const posesRef = useRef<Record<string, Pose>>(initialPoses);
  const dragRef = useRef<{ key: string; group: THREE.Group; base: [number, number, number]; x: number; y: number; start: Pose } | null>(null);

  useEffect(() => {
    logPosterLink(seed, posesRef.current);
  }, [seed]);

  const startDrag = (event: ThreeEvent<PointerEvent>, key: string, base: [number, number, number]) => {
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    const group = event.eventObject as THREE.Group;
    dragRef.current = { key, group, base, x: event.clientX, y: event.clientY, start: posesRef.current[key] ?? { turn: 0, pitch: 0 } };
    setCursor("grabbing");
  };

  const drag = (event: ThreeEvent<PointerEvent>) => {
    const current = dragRef.current;
    if (!current) return;
    const pose = {
      turn: current.start.turn + (event.clientX - current.x) * dragTurnRate,
      pitch: current.start.pitch + (event.clientY - current.y) * dragTurnRate,
    };
    posesRef.current = { ...posesRef.current, [current.key]: pose };
    current.group.rotation.set(current.base[0] + pose.pitch, current.base[1] + pose.turn, current.base[2]);
  };

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current) return;
    (event.target as Element).releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setCursor("grab");
    logPosterLink(seed, posesRef.current);
  };

  const members = useMemo(() => {
    const random = seededRandom(seed);
    const leads = cast.map((role, index) => ({ ...role, key: `${role.form}-${index}`, creatureSeed: `${seed}:${role.form}:${index}`, pieces: randomPieces(random, role.traits) }));
    return leads;
  }, [seed]);

  return (
    <>
      {members.map((member) => {
        const base: [number, number, number] = [0, member.turn, member.tilt ?? 0];
        // Later drags rotate the group directly; rendering only needs the poses from the link.
        const pose = initialPoses[member.key] ?? { turn: 0, pitch: 0 };
        return (
        <group
          key={member.key}
          position={member.position}
          rotation={[base[0] + pose.pitch, base[1] + pose.turn, base[2]]}
          onPointerDown={(event) => startDrag(event, member.key, base)}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerOver={(event) => {
            event.stopPropagation();
            if (!dragRef.current) setCursor("grab");
          }}
          onPointerOut={() => {
            if (!dragRef.current) setCursor("");
          }}
        >
          <AquaticCreatureModel
            form={member.form}
            pieces={member.pieces}
            baseSeed={member.creatureSeed}
            pattern={patternForTraitCount(creaturePattern(member.creatureSeed), member.pieces.length)}
            scale={member.scale}
            animated={false}
          />
        </group>
        );
      })}
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
export function CreaturePoster({ seed, width, pose }: { seed: string; width?: number; pose?: string }) {
  const initialPoses = useMemo(() => parsePoses(pose), [pose]);

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
            <Ensemble seed={seed} initialPoses={initialPoses} />
          </Canvas>
        </div>
        <div className="creature-poster-fade pointer-events-none absolute inset-x-0 bottom-0 h-[34%]" aria-hidden="true" />
        <header className="creature-poster-title pointer-events-none absolute inset-x-0 bottom-[6.5%] text-center">
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
