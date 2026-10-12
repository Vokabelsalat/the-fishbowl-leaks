"use client";

import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  creaturePiecesFromArtifactIds,
  type CreaturePiece,
} from "@/components/creature/CreatureModel";
import type { CreaturePartId } from "@/types/exhibition";

function hashUnit(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function PartMaterial({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.48}
      metalness={0.08}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
}

function AbstractPart({ piece }: { piece: CreaturePiece }) {
  const material = <PartMaterial color={piece.color} />;

  switch (piece.partId) {
    case "memory-crown":
      return (
        <group position={[0, 1.72, -0.08]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.68, 0.055, 10, 40]} /><PartMaterial color={piece.color} opacity={0.82} /></mesh>
          {[-0.55, -0.27, 0, 0.27, 0.55].map((x, index) => (
            <mesh key={x} position={[x, 0.2 + Math.cos(x * 3) * 0.13, 0]} scale={0.75 + index * 0.05}><sphereGeometry args={[0.09, 12, 12]} />{material}</mesh>
          ))}
        </group>
      );
    case "archive-ears":
      return (
        <group position={[0, 1.12, 0]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.67, 0.08, 0]} rotation={[0, 0, side * -0.62]} scale={[0.72, 1.15, 0.36]}><coneGeometry args={[0.32, 0.72, 5]} />{material}</mesh>
          ))}
        </group>
      );
    case "route-tail":
      return (
        <group position={[0.62, -0.38, -0.2]} rotation={[0.1, 0, -0.42]}>
          {[0, 1, 2, 3].map((index) => (
            <mesh key={index} position={[0.28 + index * 0.28, -index * 0.04, -index * 0.05]} scale={1 - index * 0.14}><sphereGeometry args={[0.21, 14, 14]} />{material}</mesh>
          ))}
        </group>
      );
    case "signal-antenna":
      return (
        <group position={[0.05, 1.72, 0]} rotation={[0, 0, -0.12]}>
          <mesh position={[0, 0.24, 0]}><cylinderGeometry args={[0.025, 0.035, 0.52, 8]} />{material}</mesh>
          <mesh position={[0, 0.55, 0]}><octahedronGeometry args={[0.14, 0]} /><meshStandardMaterial color={piece.color} emissive={piece.color} emissiveIntensity={1.4} /></mesh>
        </group>
      );
    case "cockatoo-beak":
      return <mesh position={[0, 1.02, 0.56]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.35, 0.82]}><coneGeometry args={[0.28, 0.62, 5]} />{material}</mesh>;
    case "glass-wings":
      return (
        <group position={[0, 0.15, -0.04]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.78, 0.05, -0.12]} rotation={[0.15, side * 0.22, side * -0.42]} scale={[0.48, 1.25, 0.16]}><sphereGeometry args={[0.52, 18, 18]} /><PartMaterial color={piece.color} opacity={0.36} /></mesh>
          ))}
        </group>
      );
    case "page-fins":
      return (
        <group position={[0, 0.1, -0.45]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.53, 0.18, 0]} rotation={[0.08, side * -0.18, side * 0.3]}><boxGeometry args={[0.58, 1.18, 0.055]} />{material}</mesh>
          ))}
        </group>
      );
    case "surfer-feet":
      return (
        <group position={[0, -1.14, 0.12]}>
          {[-0.34, 0.34].map((x) => (
            <mesh key={x} position={[x, 0, 0.12]} rotation={[0.08, 0, x * -0.28]} scale={[1.6, 0.38, 0.65]}><sphereGeometry args={[0.28, 14, 14]} />{material}</mesh>
          ))}
        </group>
      );
    case "inner-eye":
      return (
        <group position={[0, 1.38, 0.58]}>
          <mesh scale={[1.35, 0.74, 0.28]}><sphereGeometry args={[0.16, 18, 18]} />{material}</mesh>
          <mesh position={[0, 0, 0.06]}><sphereGeometry args={[0.065, 14, 14]} /><meshStandardMaterial color="#111016" /></mesh>
        </group>
      );
    case "orbit-ring":
      return <mesh rotation={[1.1, 0.15, 0.25]}><torusGeometry args={[1.02, 0.045, 10, 52]} /><meshStandardMaterial color={piece.color} emissive={piece.color} emissiveIntensity={0.45} /></mesh>;
    case "heart-plume":
      return (
        <group position={[0, 0.1, 0.68]} scale={0.72}>
          <mesh position={[-0.13, 0.12, 0]}><sphereGeometry args={[0.23, 16, 16]} />{material}</mesh>
          <mesh position={[0.13, 0.12, 0]}><sphereGeometry args={[0.23, 16, 16]} />{material}</mesh>
          <mesh position={[0, -0.16, 0]} rotation={[0, 0, Math.PI]} scale={[1, 1.4, 0.75]}><coneGeometry args={[0.31, 0.62, 4]} />{material}</mesh>
        </group>
      );
    case "helping-arms":
      return (
        <group position={[0, 0.05, 0.05]}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.72, 0.12, 0]} rotation={[0, 0, side * -0.82]}>
              <mesh position={[0, -0.42, 0]}><capsuleGeometry args={[0.12, 0.68, 6, 12]} />{material}</mesh>
              <mesh position={[0, -0.88, 0]}><sphereGeometry args={[0.18, 14, 14]} />{material}</mesh>
            </group>
          ))}
        </group>
      );
    case "goliath-horns":
      return (
        <group position={[0, 1.62, 0.02]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.38, 0.26, 0]} rotation={[0, 0, side * -0.28]}><coneGeometry args={[0.14, 0.68, 6]} />{material}</mesh>
          ))}
        </group>
      );
    case "crystal-spines":
      return (
        <group position={[0, 1.68, -0.04]}>
          {[-0.48, -0.16, 0.16, 0.48].map((x, index) => (
            <mesh
              key={x}
              position={[x, index % 2 === 0 ? 0 : 0.14, 0]}
              scale={[0.16, 0.36 + index * 0.04, 0.14]}
            >
              <octahedronGeometry args={[1, 0]} />
              <PartMaterial color={piece.color} opacity={0.84} />
            </mesh>
          ))}
        </group>
      );
    case "sand-hourglass":
      return (
        <group position={[0, 0.18, 0.72]} scale={0.8}>
          <mesh position={[0, 0.22, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.32, 0.44, 12]} />
            <PartMaterial color={piece.color} opacity={0.7} />
          </mesh>
          <mesh position={[0, -0.22, 0]}>
            <coneGeometry args={[0.32, 0.44, 12]} />
            <PartMaterial color={piece.color} opacity={0.7} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.08, 12, 12]} />
            {material}
          </mesh>
        </group>
      );
    case "barcode-fin":
      return (
        <group position={[0, 0.2, -0.58]}>
          {[[-0.3, 0.06], [-0.18, 0.03], [-0.08, 0.09], [0.06, 0.03], [0.15, 0.06], [0.28, 0.03]].map(([x, width]) => (
            <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[width, 0.9, 0.05]} />{material}</mesh>
          ))}
        </group>
      );
    case "fortune-cards":
      return (
        <group position={[-0.36, 1.42, 0.04]}>
          {[-0.42, 0, 0.42].map((angle) => (
            <group key={angle} rotation={[0, 0, angle]}>
              <mesh position={[0, 0.3, angle * 0.05]}><boxGeometry args={[0.28, 0.46, 0.04]} />{material}</mesh>
            </group>
          ))}
        </group>
      );
    case "spark-plume":
      return (
        <group position={[0.36, 1.5, 0.08]}>
          {[0, 1, 2, 3, 4].map((index) => {
            const angle = index * 1.35;
            return (
              <mesh
                key={index}
                position={[
                  Math.cos(angle) * (0.1 + index * 0.05),
                  index * 0.18,
                  Math.sin(angle) * 0.06,
                ]}
                scale={0.14 - index * 0.012}
              >
                <octahedronGeometry args={[1, 0]} />
                <meshStandardMaterial
                  color={piece.color}
                  emissive={piece.color}
                  emissiveIntensity={0.9}
                />
              </mesh>
            );
          })}
        </group>
      );
  }
}

export function AbstractCreatureModel({
  pieces,
  highlightedPart,
  scale = 1,
}: {
  pieces: CreaturePiece[];
  highlightedPart?: CreaturePartId;
  scale?: number;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const eyeRefs = useRef<Array<THREE.Group | null>>([]);
  const partRefs = useRef(new Map<string, THREE.Group>());
  const signature = pieces.map((piece) => piece.artifactId).join(":") || "new";
  const proportions = useMemo(() => ({
    width: 0.92 + hashUnit(`${signature}:w`) * 0.18,
    height: 0.94 + hashUnit(`${signature}:h`) * 0.15,
    tilt: (hashUnit(`${signature}:t`) - 0.5) * 0.12,
    winkEvery: 4.2 + hashUnit(`${signature}:wink-speed`) * 3.8,
    winkOffset: hashUnit(`${signature}:wink-offset`) * 7,
  }), [signature]);
  const baseColor = pieces[0]?.color ?? "#8C86A8";

  useFrame(({ clock }) => {
    if (!rootRef.current) return;
    const elapsed = clock.elapsedTime;
    rootRef.current.position.y = Math.sin(elapsed * 1.15 + hashUnit(signature) * 5) * 0.06;
    rootRef.current.rotation.y = Math.sin(elapsed * 0.42) * 0.16 + proportions.tilt;
    const winkProgress = ((elapsed + proportions.winkOffset) % proportions.winkEvery) / 0.18;
    eyeRefs.current.forEach((eye) => {
      if (!eye) return;
      const closure = winkProgress < 1 ? Math.sin(winkProgress * Math.PI) : 0;
      eye.scale.y = Math.max(0.08, 1 - closure * 0.92);
    });
    pieces.forEach((piece) => {
      const part = partRefs.current.get(piece.artifactId);
      if (!part) return;
      const time = elapsed + hashUnit(piece.artifactId) * Math.PI * 2;
      const emphasis = piece.partId === highlightedPart ? 1.75 : 1;
      part.rotation.z = Math.sin(time * 1.35) * 0.045 * emphasis;
      part.scale.setScalar(1 + Math.sin(time * 2.1) * 0.025 * emphasis);
    });
  });

  return (
    <group ref={rootRef} scale={scale} rotation={[0, proportions.tilt, 0]}>
      <mesh position={[0, -0.03, 0]} scale={[proportions.width, proportions.height, 0.88]}><sphereGeometry args={[0.84, 28, 28]} /><meshStandardMaterial color="#25222E" roughness={0.78} /></mesh>
      <mesh position={[0, 1.02, 0.03]} scale={[0.76, 0.68, 0.72]}><sphereGeometry args={[0.74, 26, 26]} /><meshStandardMaterial color="#34303E" roughness={0.72} /></mesh>
      <mesh position={[0, -0.02, 0.66]} scale={[0.68, 0.82, 0.13]}><sphereGeometry args={[0.72, 22, 22]} /><PartMaterial color={baseColor} opacity={0.22} /></mesh>
      {[-0.25, 0.25].map((x, index) => (
        <group ref={(node) => { eyeRefs.current[index] = node; }} key={x} position={[x, 1.08, 0.53]}>
          <mesh><sphereGeometry args={[0.105, 16, 16]} /><meshStandardMaterial color="#F3F0E8" /></mesh>
          <mesh position={[x * 0.08, 0, 0.083]}><sphereGeometry args={[0.047, 12, 12]} /><meshStandardMaterial color="#08080B" /></mesh>
        </group>
      ))}
      {pieces.map((piece) => (
        <group
          ref={(node) => {
            if (node) partRefs.current.set(piece.artifactId, node);
            else partRefs.current.delete(piece.artifactId);
          }}
          key={piece.artifactId}
        >
          <AbstractPart piece={piece} />
        </group>
      ))}
    </group>
  );
}

export function AbstractCreatureCanvas({
  artifactIds,
  highlightedPart,
  compact = false,
  label,
}: {
  artifactIds: string[];
  highlightedPart?: CreaturePartId;
  compact?: boolean;
  label?: string;
}) {
  const pieces = creaturePiecesFromArtifactIds(artifactIds);
  return (
    <div className="relative size-full" role="img" aria-label={label ?? `Creature with ${pieces.length} collected parts`}>
      <Canvas camera={{ position: [0, 0.15, compact ? 5.4 : 5], fov: compact ? 48 : 44, near: 0.1, far: 30 }} dpr={[1, compact ? 1.25 : 1.6]} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 5, 6]} intensity={2.6} color="#FFF4DF" />
        <pointLight position={[-3, 0, 4]} intensity={2} color="#58D6FF" />
        <pointLight position={[3, -2, 3]} intensity={1.4} color="#FF7557" />
        <AbstractCreatureModel pieces={pieces} highlightedPart={highlightedPart} scale={compact ? 0.86 : 1} />
        <AdaptiveDpr pixelated />
      </Canvas>
    </div>
  );
}
