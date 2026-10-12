"use client";

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AquaticCreatureModel } from "@/components/creature/AquaticCreatureModel";
import type { CreaturePiece } from "@/components/creature/CreatureModel";
import { BiomeBackdrop } from "@/components/visualization/BiomeBackdrop";
import { artifacts } from "@/data/artifacts";
import { creaturePattern, patternForTraitCount } from "@/lib/creature/patterns";
import { cast } from "@/components/poster/posterCast";

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

/**
 * What was dragged onto a creature: `turn` around the vertical axis, `pitch` tipping it toward the
 * viewer, and `x` and `y` moving it across the poster from its place in the cast.
 */
export type Pose = { turn: number; pitch: number; x: number; y: number };

const restingPose: Pose = { turn: 0, pitch: 0, x: 0, y: 0 };

/**
 * Poses travel in the URL as `key:turn:pitch:x:y` entries joined by `;`, for example
 * `fish-4:0.35:-0.1:0.2:0`. Older links without `x` and `y` leave the creature in its place.
 */
export function parsePoses(value: string | undefined) {
  const poses: Record<string, Pose> = {};
  for (const entry of value?.split(";") ?? []) {
    const [key, ...numbers] = entry.split(":");
    const [turn, pitch, x = 0, y = 0] = numbers.map(Number);
    if (key && [turn, pitch, x, y].every(Number.isFinite)) poses[key] = { turn, pitch, x, y };
  }
  return poses;
}

function formatPoses(poses: Record<string, Pose>) {
  return Object.entries(poses)
    .filter(([, pose]) => pose.turn !== 0 || pose.pitch !== 0 || pose.x !== 0 || pose.y !== 0)
    .map(([key, pose]) => {
      const values = [pose.turn, pose.pitch, ...(pose.x !== 0 || pose.y !== 0 ? [pose.x, pose.y] : [])];
      return [key, ...values.map((value) => value.toFixed(2))].join(":");
    })
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
const cameraPosition: [number, number, number] = [0, 0.4, 13];
const cameraFov = 42;
/**
 * A landscape poster shows the same height of sea, only wider, so the cast spreads out sideways
 * by this much from its portrait places.
 */
const landscapeSpread = 2;

type Drag = { key: string; group: THREE.Group; base: [number, number, number]; place: [number, number, number]; moving: boolean; x: number; y: number; start: Pose };

function Ensemble({ seed, initialPoses, animated, landscape }: { seed: string; initialPoses: Record<string, Pose>; animated: boolean; landscape: boolean }) {
  const posesRef = useRef<Record<string, Pose>>(initialPoses);
  const dragRef = useRef<Drag | null>(null);
  const viewHeight = useThree((state) => state.size.height);

  useEffect(() => {
    logPosterLink(seed, posesRef.current);
  }, [seed]);

  // Dragging turns a creature; dragging with Shift held moves it across the poster instead.
  const startDrag = (event: ThreeEvent<PointerEvent>, key: string, base: [number, number, number], place: [number, number, number]) => {
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    const group = event.eventObject as THREE.Group;
    const moving = event.shiftKey;
    dragRef.current = { key, group, base, place, moving, x: event.clientX, y: event.clientY, start: posesRef.current[key] ?? restingPose };
    setCursor(moving ? "move" : "grabbing");
  };

  const drag = (event: ThreeEvent<PointerEvent>) => {
    const current = dragRef.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    let pose: Pose;
    if (current.moving) {
      // The creature follows the pointer at its own depth, so near and far ones keep up alike.
      const distance = cameraPosition[2] - current.place[2];
      const unitsPerPixel = (2 * distance * Math.tan(THREE.MathUtils.degToRad(cameraFov / 2))) / viewHeight;
      pose = { ...current.start, x: current.start.x + dx * unitsPerPixel, y: current.start.y - dy * unitsPerPixel };
      current.group.position.set(current.place[0] + pose.x, current.place[1] + pose.y, current.place[2]);
    } else {
      pose = { ...current.start, turn: current.start.turn + dx * dragTurnRate, pitch: current.start.pitch + dy * dragTurnRate };
      current.group.rotation.set(current.base[0] + pose.pitch, current.base[1] + pose.turn, current.base[2]);
    }
    posesRef.current = { ...posesRef.current, [current.key]: pose };
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
        const [x, y, z] = member.position;
        const place: [number, number, number] = landscape ? [x * landscapeSpread, y, z] : [x, y, z];
        // Later drags move and rotate the group directly; rendering only needs the poses from the link.
        const pose = initialPoses[member.key] ?? restingPose;
        return (
        <group
          key={member.key}
          position={[place[0] + pose.x, place[1] + pose.y, place[2]]}
          rotation={[base[0] + pose.pitch, base[1] + pose.turn, base[2]]}
          onPointerDown={(event) => startDrag(event, member.key, base, place)}
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
            animated={animated}
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

/**
 * The poster itself. `width` fixes its size in pixels for exports; without it the poster fits the window.
 * `landscape` lays it out 3:2 wide instead of 2:3 tall.
 */
export function PosterArtwork({ seed, width, pose, landscape = false, paused = false }: { seed: string; width?: number; pose?: string; landscape?: boolean; paused?: boolean }) {
  const initialPoses = useMemo(() => parsePoses(pose), [pose]);
  const ratio = landscape ? 2 / 3 : 3 / 2;
  const fitToWindow = landscape ? "w-[min(100vw,150dvh)]" : "h-[min(100dvh,150vw)]";
  // Fixed-size exports render at the capturing browser's full pixel density, so a 2× capture stays sharp.
  const exportPixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio;

  return (
    <article
      className={`creature-poster film-grain relative ${landscape ? "aspect-[3/2]" : "aspect-[2/3]"} ${width ? "" : fitToWindow} overflow-hidden bg-[var(--abyss)] text-[var(--foam)]`}
      style={width ? { width, height: width * ratio } : undefined}
      aria-label="The Fishbowl Leaks poster"
    >
      <BiomeBackdrop progress={0.82} quiet />
      <div className="creature-poster-light absolute inset-0" aria-hidden="true" />
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: cameraPosition, fov: cameraFov, near: 0.1, far: 60 }}
          dpr={width ? exportPixelRatio : [1, 2]}
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
          {/* The cast swims as it does in the collective tank, but holds still for fixed-size exports. */}
          <Ensemble seed={seed} initialPoses={initialPoses} animated={!width && !paused} landscape={landscape} />
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
  );
}

/** Exports go through a development route that captures the pages with a headless Chrome. */
const canExport = process.env.NODE_ENV !== "production";

/** The current poster's link parameters, kept in the address bar as creatures are posed. */
function exportHref(kind: "image" | "tutorial") {
  const params = new URLSearchParams(window.location.search);
  params.set("kind", kind);
  return `/api/development/poster-export?${params}`;
}

export function CreaturePoster({ seed, width, pose, landscape = false }: { seed: string; width?: number; pose?: string; landscape?: boolean }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [exporting, setExporting] = useState<"image" | "tutorial" | null>(null);

  const exportFile = async (kind: "image" | "tutorial") => {
    setExporting(kind);
    try {
      const response = await fetch(exportHref(kind));
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? response.statusText);
      const name = response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "poster";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await response.blob());
      link.download = name;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      window.alert(`The export failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      setExporting(null);
    }
  };

  const buttonClass = "flex min-h-12 items-center border border-white/40 bg-[var(--abyss)] px-5 text-base text-[var(--foam)] transition-colors hover:border-white disabled:opacity-60";

  return (
    <main className="grid min-h-dvh place-items-center bg-black">
      {/* Keeps the development badge out of poster captures. */}
      <style>{"nextjs-portal { display: none; }"}</style>
      <PosterArtwork seed={seed} width={width} pose={pose} landscape={landscape} paused={paused} />
      {/* Exports set a fixed width; the buttons stay out of those captures. */}
      {!width && (
        <div className="fixed right-6 bottom-6 z-10 flex gap-3">
          {canExport && (
            <>
              <button type="button" className={buttonClass} disabled={exporting !== null} onClick={() => exportFile("image")}>
                {exporting === "image" ? "Exporting image, about a minute…" : "Export image"}
              </button>
              <button type="button" className={buttonClass} disabled={exporting !== null} onClick={() => exportFile("tutorial")}>
                {exporting === "tutorial" ? "Exporting A4 tutorial, about a minute…" : "Export A4 tutorial"}
              </button>
            </>
          )}
          <button
            type="button"
            aria-pressed={paused}
            className={buttonClass}
            onClick={() => setPaused((current) => !current)}
          >
            {paused ? "Play animation" : "Stop animation"}
          </button>
          <button
            type="button"
            className={`${buttonClass} gap-4`}
            onClick={() => router.push(`/poster?seed=${crypto.randomUUID().slice(0, 8)}${landscape ? "&format=landscape" : ""}`)}
          >
            New poster
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </main>
  );
}
