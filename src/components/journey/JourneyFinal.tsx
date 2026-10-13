"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { artifacts, artifactById } from "@/data/artifacts";
import { generateJourneyNarrative } from "@/lib/narrative/generateJourneyNarrative";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { journeyReleased, resetJourney, setExperiencePhase } from "@/store/journeySlice";
import { clearJourney } from "@/store/persistence";
import { selectDiscoveredArtifacts, selectDiscoveries, selectJourney } from "@/store/selectors";
import { ShareContribution } from "@/components/journey/ShareContribution";
import { themes } from "@/data/themes";
import { PathVisualization } from "@/components/visualization/PathVisualization";
import { activeVisualizationCopy, visualizationDesign } from "@/config/visualization";
import dynamic from "next/dynamic";
import { BiomeBackdrop } from "@/components/visualization/BiomeBackdrop";
import { ScrollNotice } from "@/components/ui/ScrollNotice";

const GeneratedNarrative = dynamic(() =>
  import("@/components/journey/GeneratedNarrative").then(
    (module) => module.GeneratedNarrative,
  ),
);

export function JourneyFinal() {
  const dispatch = useAppDispatch();
  const discoveries = useAppSelector(selectDiscoveries);
  const journey = useAppSelector(selectJourney);
  const discoveredArtifacts = useAppSelector(selectDiscoveredArtifacts);
  // The traits gathered so far are a long list, so they start folded away.
  const [traitsOpen, setTraitsOpen] = useState(false);
  const lines = useMemo(
    () => generateJourneyNarrative(discoveries, artifacts),
    [discoveries],
  );
  const themesInOrder = discoveries.flatMap((discovery) => {
    const artifact = artifactById.get(discovery.artifactId);
    return artifact ? [artifact] : [];
  });

  const startAgain = () => {
    dispatch(resetJourney());
    try {
      clearJourney(window.localStorage);
    } catch {
      // Storage can be unavailable; the reload still starts from the intro.
    }
    // A full reload also resets the camera, AR tracking and any screen state.
    window.location.replace("/");
  };

  return (
    <main className="biome-field biome-screen film-grain safe-top safe-bottom relative min-h-dvh overflow-x-hidden bg-[var(--abyss)] px-5">
      <BiomeBackdrop progress={0.88} />
      <ScrollNotice label="Your ending and release controls are below" />
      <header className="relative z-10 flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-[-0.04em]">
          The Fishbowl Leaks
        </Link>
        <p className="text-sm text-white/60">
          Release chamber
        </p>
      </header>

      <section className="relative left-1/2 mt-1 h-[46dvh] min-h-80 w-screen -translate-x-1/2 overflow-visible" aria-labelledby="reading-title">
        <h1 id="reading-title" className="absolute inset-x-0 top-6 z-10 text-center text-[10px] tracking-[0.32em] text-white/48">
          {journey.released ? "Specimen released" : "Specimen pending release"}
        </h1>
        <PathVisualization
          artifactIds={discoveries.map((item) => item.artifactId)}
          creatureForm={journey.creatureForm}
          creaturePalette={journey.creaturePalette ?? undefined}
          creaturePattern={journey.creaturePattern ?? undefined}
          creatureProportions={journey.creatureProportions ?? undefined}
          creatureSeed={journey.sessionId ?? undefined}
          fitToView
          label={`Your finished exhibition ${activeVisualizationCopy.singular}`}
        />
        <div className="absolute inset-x-0 bottom-5 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {themesInOrder.map((artifact, index) => (
            <span key={`${artifact.id}-${index}`} className="flex items-center gap-1.5 text-[9px] tracking-[0.14em] text-white/48">
              <span className="size-1 rounded-full" style={{ backgroundColor: artifact.color }} aria-hidden="true" />
              {themes[artifact.theme].label}
            </span>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-xl pb-8">
        <p className="mb-6 text-sm text-white/45">The aquarium, remembered from inside</p>
        <GeneratedNarrative lines={lines} />

        <section className="mt-10 border-t border-white/15 pt-5" aria-labelledby="journey-traits">
          <h2 id="journey-traits" className="font-display text-xl text-white/85">
            <button
              type="button"
              onClick={() => setTraitsOpen(!traitsOpen)}
              aria-expanded={traitsOpen}
              aria-controls="journey-traits-list"
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left transition-colors hover:text-white"
            >
              <span>{visualizationDesign === "constellation" ? "Signals, in encounter order" : "Traits crossing the glass"}</span>
              <span aria-hidden="true" className="font-sans text-base">{traitsOpen ? "↑" : "↓"}</span>
            </button>
          </h2>
          <ol id="journey-traits-list" className="mt-4 space-y-3" hidden={!traitsOpen}>
            {discoveredArtifacts.map(({ artifact, sequence }) => (
              <li key={artifact.id} className="flex items-baseline gap-4">
                <span className="text-sm text-white/30">{String(sequence).padStart(2, "0")}</span>
                {visualizationDesign === "constellation" ? (
                  <span className="font-display text-xl">{artifact.title}</span>
                ) : (
                  <span>
                    <span className="font-display block text-xl">{artifact.creaturePart.label}</span>
                    <span className="mt-0.5 block text-sm text-white/45">{artifact.marineType} · from {artifact.title}</span>
                  </span>
                )}
                <span className="ml-auto text-xs" style={{ color: artifact.color }}>
                  {themes[artifact.theme].label.toLowerCase()}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10">
          <ShareContribution
            sessionId={journey.sessionId}
            released={journey.released}
            onReleased={(completedAt) => dispatch(journeyReleased(completedAt))}
            discoveries={discoveries}
            creatureForm={journey.creatureForm}
            creaturePalette={journey.creaturePalette}
            creaturePattern={journey.creaturePattern}
            creatureProportions={journey.creatureProportions}
          />
        </div>

        <div className="mt-8 border-t border-white/12 pt-6">
          {/* Until the creature is released, the visitor can always go back and gather more. */}
          {!journey.released && (
            <Link
              href="/"
              onClick={() => dispatch(setExperiencePhase("scanning"))}
              className="mb-3 flex min-h-14 items-center justify-between border border-white/35 px-5 text-sm text-white transition-colors hover:border-white"
            >
              <span>Continue this journey</span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
          <button
            type="button"
            onClick={startAgain}
            className="flex min-h-14 w-full items-center justify-between bg-white px-5 text-sm text-[#031015] transition-opacity hover:opacity-85"
          >
            <span>Start again</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  );
}
