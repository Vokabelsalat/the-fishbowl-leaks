"use client";

import { useCallback } from "react";
import { artifactById } from "@/data/artifacts";
import { revealAssemblesConstellation, useRevealMachine } from "@/lib/animation/revealMachine";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  artifactCollected,
  setActiveArtifact,
  setExperiencePhase,
} from "@/store/journeySlice";
import { selectActiveArtifactId } from "@/store/selectors";
import { ArtifactContent } from "@/components/exhibition/ArtifactContent";
import type { ExhibitionArtifact } from "@/types/exhibition";
import { ConstellationAssembly } from "@/components/particles/ConstellationAssembly";
import { ParticleNarrative } from "@/components/particles/ParticleNarrative";
import { PathVisualization } from "@/components/visualization/PathVisualization";
import { activeVisualizationCopy, visualizationDesign } from "@/config/visualization";
import { selectCreatureForm, selectCreaturePalette, selectCreaturePattern, selectCreatureProportions, selectCreatureSeed, selectDiscoveries } from "@/store/selectors";

type RevealPresentation = "tracked-ar" | "simulated";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ArtifactRevealSequence({
  artifact,
  isRevisit,
  onContinue,
}: {
  artifact: ExhibitionArtifact;
  isRevisit: boolean;
  onContinue?: (artifact: ExhibitionArtifact) => void;
}) {
  const dispatch = useAppDispatch();
  const discoveries = useAppSelector(selectDiscoveries);
  const creatureForm = useAppSelector(selectCreatureForm);
  const creatureSeed = useAppSelector(selectCreatureSeed);
  const creaturePalette = useAppSelector(selectCreaturePalette);
  const creaturePattern = useAppSelector(selectCreaturePattern);
  const creatureProportions = useAppSelector(selectCreatureProportions);
  const handleContentReady = useCallback(() => {
    dispatch(artifactCollected(artifact.id));
  }, [artifact.id, dispatch]);
  const phase = useRevealMachine(
    artifact.id,
    handleContentReady,
    isRevisit,
    revealAssemblesConstellation,
  );

  const contentVisible = phase === "content-reveal" || phase === "complete";
  const creatureVisible = !isRevisit && visualizationDesign !== "constellation";
  const isGrowing = phase === "formation";
  // The first scan gives the visitor their specimen rather than changing an existing one.
  const isFirstSpecimen = discoveries.length === 1 && discoveries[0].artifactId === artifact.id;
  // The creature shows its previous state until the formation phase, when the new trait grows in.
  const traitEmerged = isGrowing || contentVisible;
  const creatureArtifactIds = discoveries.map((item) => item.artifactId);

  return (
    <section className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-live="polite">
      {!isRevisit && visualizationDesign === "constellation" && phase !== "complete" && (
        <ParticleNarrative artifact={artifact} phase={phase} mode="ar-release" quality="low" />
      )}
      {creatureVisible && (phase === "assembling" || phase === "attached") && (
        // Centred on the creature stage below (top 7vh, height 58vh).
        <ConstellationAssembly
          artifact={artifact}
          collapsing={phase === "attached"}
          centerY={0.14}
          fit={0.58}
        />
      )}
      {creatureVisible && (
        <div
          className="creature-reveal-stage absolute inset-x-0 top-[7vh] h-[58vh]"
          data-phase={phase}
        >
          <div className="creature-reveal-halo" aria-hidden="true" />
          <div className="creature-reveal-model pointer-events-auto">
            <PathVisualization
              artifactIds={creatureArtifactIds}
              creatureForm={creatureForm}
              creatureSeed={creatureSeed}
              creaturePalette={creaturePalette ?? undefined}
              creaturePattern={creaturePattern ?? undefined}
              creatureProportions={creatureProportions ?? undefined}
              fitToView
              fitScale={1.14}
              interactive
              highlightedPart={isGrowing ? artifact.creaturePart.id : undefined}
              emergingArtifactId={artifact.id}
              emerging={traitEmerged}
              label={`${artifact.marineType} altering your ${activeVisualizationCopy.singular}`}
            />
          </div>
          <div className="creature-reveal-rings" aria-hidden="true"><i /><i /><i /></div>
        </div>
      )}
      {!contentVisible && (
        <p key={phase} className="creature-reveal-status absolute inset-x-6 bottom-[10vh] text-center text-sm text-white/80">
          {phase === "assembling" && "Signal located"}
          {phase === "attached" && (visualizationDesign === "constellation"
            ? "Signal located"
            : isFirstSpecimen ? "A specimen gathers around the signal" : "Your creature recognizes something new")}
          {phase === "release" && (visualizationDesign === "constellation"
            ? "Releasing language"
            : isFirstSpecimen ? `${capitalize(artifact.marineType)} is forming your specimen` : `${artifact.marineType} is joining it`)}
          {phase === "formation" && (visualizationDesign === "constellation" ? "Classification unstable" : `${artifact.creaturePart.label} is taking shape`)}
        </p>
      )}
      {contentVisible && (
        <div className="pointer-events-auto">
          <ArtifactContent
            mini={isRevisit}
            artifact={artifact}
            onContinue={() => {
              onContinue?.(artifact);
              dispatch(setActiveArtifact(null));
              dispatch(setExperiencePhase("scanning"));
            }}
          />
        </div>
      )}
    </section>
  );
}

export function ArtifactReveal({
  presentation,
  isRevisit,
  onContinue,
}: {
  presentation: RevealPresentation;
  isRevisit: boolean;
  onContinue?: (artifact: ExhibitionArtifact) => void;
}) {
  const activeArtifactId = useAppSelector(selectActiveArtifactId);
  const artifact = activeArtifactId
    ? artifactById.get(activeArtifactId) ?? null
    : null;

  if (!artifact) return null;
  return (
    <ArtifactRevealSequence
      key={`${artifact.id}:${isRevisit ? "revisit" : "reveal"}`}
      artifact={artifact}
      isRevisit={isRevisit}
      onContinue={presentation === "tracked-ar" ? onContinue : undefined}
    />
  );
}
