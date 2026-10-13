"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { artifacts } from "@/data/artifacts";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resetJourney } from "@/store/journeySlice";
import { selectDiscoveryCount } from "@/store/selectors";

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
  const discoveryCount = useAppSelector(selectDiscoveryCount);
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

  return (
    <aside className="safe-bottom absolute inset-x-3 bottom-3 z-30 rounded-[1.5rem] bg-[#101010]/92 p-3 text-white shadow-2xl backdrop-blur-xl" aria-label="AR simulator controls">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-sm text-white/70">
          Exhibition simulator
        </p>
        {onClose && (
          <button type="button" onClick={onClose} className="min-h-8 px-2 text-xs text-white/55">
            Hide
          </button>
        )}
      </div>
      {syntheticAvailable && (
        <div className="mb-3 flex items-center justify-between gap-4 border-y border-white/12 px-1 py-3">
          <div>
            <p className="text-sm text-white/85">Synthetic exhibition day</p>
            <p className="mt-1 text-xs leading-5 text-white/50" aria-live="polite">
              {syntheticActive
                ? `${syntheticCount} test journeys and poems are flowing through the collective screen.`
                : "Add timed visitor pathways and poems to test the aquarium and activity map."}
            </p>
            {syntheticError && <p className="mt-1 text-xs text-[#ff9e86]" role="alert">{syntheticError}</p>}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={syntheticActive}
            aria-label="Use synthetic exhibition activity"
            disabled={syntheticBusy}
            onClick={() => void toggleSyntheticDataset()}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:cursor-wait disabled:opacity-50 ${syntheticActive ? "bg-[var(--phosphor)]" : "bg-white/18"}`}
          >
            <span className={`absolute left-1 top-1 size-6 rounded-full bg-white shadow transition-transform ${syntheticActive ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
      )}
      <div className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto overscroll-contain pr-1">
        {artifacts.map((artifact, index) => (
          <button
            key={artifact.id}
            type="button"
            onClick={() => onArtifactDetected(artifact.id)}
            className="min-h-11 rounded-full bg-white/[0.08] px-2 text-[11px] transition-colors hover:bg-white/[0.14]"
          >
            {index + 1}. {artifact.title}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => dispatch(resetJourney())}
          className="min-h-10 rounded-full px-3 text-[11px] text-white/50 transition-colors hover:text-white"
        >
          Reset journey
        </button>
        <button
          type="button"
          // The ending page is where the creature is released, once it has enough encounters.
          onClick={() => router.push("/journey")}
          disabled={discoveryCount === 0}
          className="min-h-10 rounded-full bg-white px-3 text-[11px] text-black transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Open the ending
        </button>
      </div>
    </aside>
  );
}
