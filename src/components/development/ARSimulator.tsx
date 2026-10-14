"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { artifacts } from "@/data/artifacts";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resetJourney } from "@/store/journeySlice";
import { selectDiscoveries } from "@/store/selectors";

/** The works in exhibition order, as the catalogue and the title screen list them. */
const worksInExhibitionOrder = artifacts.slice().sort((a, b) => a.exhibitionId - b.exhibitionId);

type ARSimulatorProps = {
  onArtifactDetected: (artifactId: string) => void;
  onClose?: () => void;
};

export function ARSimulator({
  onArtifactDetected,
  onClose,
}: ARSimulatorProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const discoveries = useAppSelector(selectDiscoveries);
  const discoveredIds = new Set(discoveries.map((discovery) => discovery.artifactId));
  const [syntheticActive, setSyntheticActive] = useState(false);
  const [syntheticCount, setSyntheticCount] = useState(0);
  const [syntheticBusy, setSyntheticBusy] = useState(false);
  const [syntheticAvailable, setSyntheticAvailable] = useState(false);
  const [syntheticError, setSyntheticError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/development/synthetic", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Synthetic data is unavailable.");
        return response.json() as Promise<{ active: boolean; count: number }>;
      })
      .then((data) => {
        if (cancelled) return;
        setSyntheticAvailable(true);
        setSyntheticActive(data.active);
        setSyntheticCount(data.count);
      })
      .catch(() => {
        if (!cancelled) setSyntheticAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleSyntheticDataset() {
    setSyntheticBusy(true);
    setSyntheticError("");
    try {
      const response = await fetch("/api/development/synthetic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !syntheticActive }),
      });
      if (!response.ok) throw new Error("The test day could not be changed.");
      const data = (await response.json()) as { active: boolean; count: number };
      setSyntheticActive(data.active);
      setSyntheticCount(data.count);
    } catch (error) {
      setSyntheticError(error instanceof Error ? error.message : "The test day could not be changed.");
    } finally {
      setSyntheticBusy(false);
    }
  }

  const pillClass =
    "min-h-11 border border-white/35 px-3 text-sm transition-colors hover:border-white disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <aside className="safe-bottom absolute inset-x-0 bottom-0 z-30 border-t border-white/25 bg-[var(--abyss)] px-4 pt-4 text-white" aria-labelledby="simulator-title">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="simulator-title" className="font-display text-2xl leading-tight tracking-[-0.03em]">Choose an artwork</h2>
            <p className="mt-1 text-sm leading-5 text-white/74">Without a camera, pick the work you are standing in front of.</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className={`${pillClass} flex shrink-0 items-center gap-3`}>
              <span>Close</span>
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <ul className="mt-4 grid max-h-[40dvh] grid-cols-2 gap-2 overflow-y-auto overscroll-contain">
          {worksInExhibitionOrder.map((artifact) => {
            const found = discoveredIds.has(artifact.id);
            return (
              <li key={artifact.id}>
                <button
                  type="button"
                  onClick={() => onArtifactDetected(artifact.id)}
                  className={`${pillClass} flex w-full items-center justify-between gap-2 py-2 text-left leading-5`}
                >
                  <span>{artifact.title}</span>
                  {found && <span aria-label="already found">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Test tools for development servers only; the synthetic route answers there and nowhere else. */}
        {syntheticAvailable && (
          <div className="mt-4 border-t border-white/20 pt-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm leading-5 text-white/74" aria-live="polite">
                {syntheticActive
                  ? `Synthetic day on: ${syntheticCount} test journeys in the collective screen.`
                  : "Synthetic day off: add test journeys to the collective screen."}
              </p>
              <button
                type="button"
                aria-pressed={syntheticActive}
                disabled={syntheticBusy}
                onClick={() => void toggleSyntheticDataset()}
                className={`${pillClass} shrink-0 ${syntheticActive ? "border-[var(--phosphor)] bg-[var(--phosphor)] text-[var(--abyss)]" : ""}`}
              >
                {syntheticActive ? "Turn off" : "Turn on"}
              </button>
            </div>
            {syntheticError && <p className="mt-1 text-sm text-[#ff9e86]" role="alert">{syntheticError}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => dispatch(resetJourney())} className={pillClass}>
                Reset journey
              </button>
              <button
                type="button"
                // The ending page is where the creature is released, once it has enough encounters.
                onClick={() => router.push("/journey")}
                disabled={discoveries.length === 0}
                className={pillClass}
              >
                Open the ending
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
