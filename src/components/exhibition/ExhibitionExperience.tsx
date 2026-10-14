"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { artifactByTargetIndex } from "@/data/artifacts";
import {
  ARScanner,
  type ARScannerHandle,
} from "@/components/ar/ARScanner";
import type { TargetDetectionResult } from "@/components/ar/MindARAdapter";
import { ARSimulator } from "@/components/development/ARSimulator";
import { ArtifactReveal } from "@/components/exhibition/ArtifactReveal";
import { ExhibitionNavigation } from "@/components/exhibition/ExhibitionNavigation";
import { IntroScreen } from "@/components/exhibition/IntroScreen";
import { RELEASE_MINIMUM_ENCOUNTERS } from "@/components/journey/ShareContribution";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  artifactDetected,
  artifactRevisited,
  openSeaChanged,
} from "@/store/journeySlice";
import {
  selectDiscoveries,
  selectExperiencePhase,
  selectJourney,
} from "@/store/selectors";

export function ExhibitionExperience() {
  const dispatch = useAppDispatch();
  const scannerRef = useRef<ARScannerHandle>(null);
  const phase = useAppSelector(selectExperiencePhase);
  const discoveries = useAppSelector(selectDiscoveries);
  const released = useAppSelector(selectJourney).released;
  const router = useRouter();
  const [simulatorVisible, setSimulatorVisible] = useState(false);
  const [alreadyDiscovered, setAlreadyDiscovered] = useState<string | null>(null);
  const [revealPresentation, setRevealPresentation] = useState<
    "tracked-ar" | "simulated"
  >("tracked-ar");
  const [revealIsRevisit, setRevealIsRevisit] = useState(false);
  const discoveredIds = useMemo(
    () => new Set(discoveries.map((discovery) => discovery.artifactId)),
    [discoveries],
  );

  // Open-sea forms like whales may only be drawn once the shared tank's walls are gone. Unless the
  // server says so, the visitor's specimen comes from the aquarium's forms.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/tank", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ openSea?: boolean }>) : null))
      .then((tank) => {
        if (!cancelled && tank?.openSea) dispatch(openSeaChanged(true));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // A released creature is final, so returning visitors go straight to its ending.
  useEffect(() => {
    if (released) router.replace("/journey");
  }, [released, router]);

  useEffect(() => {
    if (!alreadyDiscovered) return;
    const timer = window.setTimeout(() => setAlreadyDiscovered(null), 1800);
    return () => window.clearTimeout(timer);
  }, [alreadyDiscovered]);

  const handleArtifactDetected = useCallback(
    (artifactId: string): TargetDetectionResult => {
      if (phase !== "scanning") return "ignore";
      if (discoveredIds.has(artifactId)) {
        setAlreadyDiscovered(artifactId);
        setRevealIsRevisit(true);
        dispatch(artifactRevisited(artifactId));
        return "revisit";
      }
      setRevealIsRevisit(false);
      dispatch(artifactDetected(artifactId));
      return "reveal";
    },
    [dispatch, discoveredIds, phase],
  );

  const handleTargetFound = useCallback(
    (targetIndex: number): TargetDetectionResult => {
      const artifact = artifactByTargetIndex.get(targetIndex);
      if (artifact) {
        setRevealPresentation("tracked-ar");
        return handleArtifactDetected(artifact.id);
      }
      return "ignore";
    },
    [handleArtifactDetected],
  );

  if (phase === "intro") return <IntroScreen />;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--abyss)] text-white">
      <ARScanner
        ref={scannerRef}
        autoStart
        onTargetFound={handleTargetFound}
        onTargetLost={() => undefined}
        onUseSimulator={() => setSimulatorVisible(true)}
        simulatorVisible={simulatorVisible}
        showTargetHint={discoveries.length === 0}
      />
      <ExhibitionNavigation />

      {/* Once the creature may be released, the way to the ending stays in reach below the camera. */}
      {phase === "scanning" && discoveries.length >= RELEASE_MINIMUM_ENCOUNTERS && !simulatorVisible && (
        <div className="safe-bottom absolute inset-x-0 bottom-0 z-20 flex justify-center px-4">
          <button
            type="button"
            onClick={() => router.push("/journey")}
            className="flex min-h-14 w-full max-w-sm items-center justify-between gap-4 border border-white/45 bg-[var(--abyss)] px-5 text-left text-base text-white shadow-[0_0_1.5rem_rgba(0,0,0,0.35)] transition-colors hover:border-white"
          >
            <span>Before you leave, set your creature free</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {alreadyDiscovered && (
        <div className="absolute top-28 left-1/2 z-30 -translate-x-1/2 border border-white/25 bg-[var(--abyss)] px-5 py-3 text-center text-sm text-white/70" role="status">
          Already registered. Classification unchanged.
        </div>
      )}

      {simulatorVisible && phase === "scanning" && (
        <ARSimulator
          onArtifactDetected={(artifactId) => {
            setRevealPresentation("simulated");
            handleArtifactDetected(artifactId);
          }}
          onClose={() => setSimulatorVisible(false)}
        />
      )}

      <ArtifactReveal
        presentation={revealPresentation}
        isRevisit={revealIsRevisit}
        onContinue={(artifact) => {
          scannerRef.current?.dismissArtifact(artifact.targetIndex);
        }}
      />
    </main>
  );
}
