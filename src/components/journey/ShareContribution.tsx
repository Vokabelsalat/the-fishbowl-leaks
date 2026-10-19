"use client";

import { useEffect, useRef, useState } from "react";
import { activeVisualizationCopy } from "@/config/visualization";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import type { CreatureColorPalette } from "@/lib/creature/colorPalettes";
import type { CreaturePattern } from "@/lib/creature/patterns";
import type { CreatureProportions } from "@/lib/creature/proportions";
import type { Discovery } from "@/store/journeySlice";

type ShareState = "idle" | "sharing" | "shared" | "error";

/** How many artworks a visitor has to encounter before their creature may be released. */
export const RELEASE_MINIMUM_ENCOUNTERS = 1;

export function ShareContribution({
  sessionId,
  released,
  onReleased,
  discoveries,
  creatureForm,
  creaturePalette,
  creaturePattern,
  creatureProportions,
}: {
  sessionId: string | null;
  /** Already released, on this visit or an earlier one. */
  released: boolean;
  /** Called once the shared tank has accepted the creature, with the moment it was sent. */
  onReleased: (completedAt: number) => void;
  discoveries: Discovery[];
  creatureForm: AquaticForm | null;
  creaturePalette: CreatureColorPalette | null;
  creaturePattern: CreaturePattern | null;
  creatureProportions: CreatureProportions | null;
}) {
  const [sendState, setState] = useState<ShareState>("idle");
  const state: ShareState = released ? "shared" : sendState;
  const encountersNeeded = Math.max(0, RELEASE_MINIMUM_ENCOUNTERS - discoveries.length);
  const blockRef = useRef<HTMLDivElement>(null);
  const [blockVisible, setBlockVisible] = useState(true);

  // The floating release bar stands in for this block while it is scrolled out of view.
  useEffect(() => {
    const block = blockRef.current;
    if (!block) return;
    const observer = new IntersectionObserver(([entry]) => setBlockVisible(entry.isIntersecting));
    observer.observe(block);
    return () => observer.disconnect();
  }, []);

  async function share() {
    if (!sessionId || encountersNeeded > 0 || state === "sharing" || state === "shared") return;
    // The journey ends when the creature is sent, not when the visitor first looks at their story.
    const completedAt = Date.now();
    setState("sharing");
    try {
      const response = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, completedAt, discoveries, creatureForm, creaturePalette, creaturePattern, creatureProportions }),
      });
      if (!response.ok) throw new Error("Share failed");
      setState("shared");
      onReleased(completedAt);
    } catch {
      setState("error");
    }
  }

  const releaseButton = (
    <button
      type="button"
      onClick={share}
      disabled={!sessionId || encountersNeeded > 0 || state === "sharing" || state === "shared"}
      className="flex min-h-16 w-full items-center justify-between bg-[var(--phosphor)] px-6 text-base text-[#031015] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>
        {state === "sharing" && `Releasing your ${activeVisualizationCopy.singular}…`}
        {state === "shared" && `Your ${activeVisualizationCopy.singular} crossed the glass`}
        {state === "error" && "Try sharing again"}
        {state === "idle" && "Release into the shared tank"}
      </span>
    </button>
  );

  // Until enough works are encountered there is nothing to press, so the block only says what is missing.
  if (state !== "shared" && encountersNeeded > 0) {
    return (
      <div className="border-t border-white/20 pt-6">
        <p className="text-base leading-6">
          Scan {encountersNeeded} more {encountersNeeded === 1 ? "artwork" : "artworks"} to release your {activeVisualizationCopy.singular} into
          the shared tank. It needs at least {RELEASE_MINIMUM_ENCOUNTERS} {RELEASE_MINIMUM_ENCOUNTERS === 1 ? "encounter" : "encounters"} to hold together outside the glass.
        </p>
      </div>
    );
  }

  return (
    <div ref={blockRef} className="border-t border-white/20 pt-6">
      {releaseButton}
      {!blockVisible && state !== "shared" && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex justify-center bg-[var(--abyss)] px-4 pt-3 shadow-[0_-1rem_2rem_rgba(3,16,21,0.9)]">
          <div className="w-full max-w-xl">
            {releaseButton}
            <p className="mt-2 text-center text-sm leading-5 text-white/80">
              {state === "error"
                ? "The screen could not be reached. Your story is still safe on this device."
                : "Anonymous and final. Any artwork ratings you gave are included."}
            </p>
          </div>
        </div>
      )}
      <p className="mt-3 px-3 text-center text-sm leading-5 text-white/74" role="status" aria-live="polite">
        {state === "shared"
          ? `Your ${activeVisualizationCopy.singular} is now swimming on the shared screen.`
          : state === "error"
            ? "The screen could not be reached. Your story is still safe on this device."
            : `Its body and story will appear anonymously in the shared aquarium. Any artwork ratings you gave will also be submitted for exhibition evaluation. Once released, your ${activeVisualizationCopy.singular} is final.`}
      </p>
    </div>
  );
}
