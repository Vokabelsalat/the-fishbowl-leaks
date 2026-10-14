"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { artifacts, artifactById } from "@/data/artifacts";
import { generateJourneyNarrative } from "@/lib/narrative/generateJourneyNarrative";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { journeyReleased, resetJourney, setExperiencePhase } from "@/store/journeySlice";
import { clearJourney } from "@/store/persistence";
import { selectDiscoveries, selectJourney } from "@/store/selectors";
import { RELEASE_MINIMUM_ENCOUNTERS, ShareContribution } from "@/components/journey/ShareContribution";
import { PathVisualization } from "@/components/visualization/PathVisualization";
import { activeVisualizationCopy } from "@/config/visualization";
import dynamic from "next/dynamic";
import { BiomeBackdrop } from "@/components/visualization/BiomeBackdrop";

const GeneratedNarrative = dynamic(() =>
  import("@/components/journey/GeneratedNarrative").then(
    (module) => module.GeneratedNarrative,
  ),
);

export function JourneyFinal() {
  const dispatch = useAppDispatch();
  const discoveries = useAppSelector(selectDiscoveries);
  const journey = useAppSelector(selectJourney);
  const lines = useMemo(
    () => generateJourneyNarrative(discoveries, artifacts, { seed: journey.sessionId }),
    [discoveries, journey.sessionId],
  );
  const worksInOrder = discoveries.flatMap((discovery) => {
    const artifact = artifactById.get(discovery.artifactId);
    return artifact ? [artifact] : [];
  });

  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const releaseBlocked = !journey.released && discoveries.length < RELEASE_MINIMUM_ENCOUNTERS;

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
      <header className="relative z-10">
        <Link href="/" className="text-lg leading-none tracking-[-0.04em] transition-colors hover:text-[var(--phosphor)]">
          The Fishbowl Leaks
        </Link>
      </header>

      <section className="relative mt-6" aria-labelledby="reading-title">
        <h1 id="reading-title" className="relative z-10 text-center font-display text-[clamp(2rem,9vw,3.3rem)] leading-[0.94] tracking-[-0.055em]">
          {journey.released ? "Your specimen, released" : "Your specimen"}
        </h1>
        <div className="relative left-1/2 h-[40dvh] min-h-72 w-screen -translate-x-1/2">
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
        </div>
        {/* Each dot is the colour an artwork left on the creature, so the works name them. */}
        <ul className="relative z-10 mx-auto flex max-w-xl flex-wrap justify-center gap-x-4 gap-y-1" aria-label="The artworks it carries">
          {worksInOrder.map((artifact, index) => (
            <li key={`${artifact.id}-${index}`} className="flex items-center gap-2 text-sm text-white/74">
              <span className="size-2 rounded-full" style={{ backgroundColor: artifact.color }} aria-hidden="true" />
              {artifact.title}
            </li>
          ))}
        </ul>
      </section>

      <section className="relative z-10 mx-auto max-w-xl pb-8 pt-10">
        <h2 className="mb-4 text-base leading-6 text-white/74">The aquarium, remembered from inside</h2>
        <GeneratedNarrative lines={lines} />

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

        <div className="mt-8 border-t border-white/20 pt-6">
          {/* Until the creature is released, the visitor can always go back and gather more. While
              release is still out of reach, that is the page's main action. */}
          {!journey.released && (
            <Link
              href="/"
              onClick={() => dispatch(setExperiencePhase("scanning"))}
              className={`mb-3 flex min-h-14 items-center justify-between px-5 text-base transition-colors ${
                releaseBlocked
                  ? "bg-[var(--phosphor)] text-[#031015] hover:opacity-85"
                  : "border border-white/45 text-white hover:border-white"
              }`}
            >
              <span>Continue this journey</span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
          {/* Starting again erases this device's journey, so it asks once before doing so. */}
          {confirmingRestart ? (
            <div className="border border-white/45 p-4" role="alertdialog" aria-labelledby="restart-question">
              <p id="restart-question" className="text-base leading-6">
                {journey.released
                  ? "Your released creature stays in the shared tank. This phone forgets it and starts a new journey."
                  : "This erases your creature and its story from this phone. It cannot be undone."}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmingRestart(false)}
                  className="min-h-12 border border-white/45 px-4 text-sm transition-colors hover:border-white"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={startAgain}
                  className="min-h-12 bg-white px-4 text-sm text-[#031015] transition-opacity hover:opacity-85"
                >
                  {journey.released ? "Start again" : "Erase it"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRestart(true)}
              className="flex min-h-14 w-full items-center justify-between border border-white/45 px-5 text-sm text-white transition-colors hover:border-white"
            >
              <span>Start again</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
