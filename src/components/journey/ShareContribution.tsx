"use client";

import { useState } from "react";
import { activeVisualizationCopy } from "@/config/visualization";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import type { CreatureColorPalette } from "@/lib/creature/colorPalettes";
import type { CreaturePattern } from "@/lib/creature/patterns";
import type { CreatureProportions } from "@/lib/creature/proportions";
import type { Discovery } from "@/store/journeySlice";

type ShareState = "idle" | "sharing" | "shared" | "error";

/** How many artworks a visitor has to encounter before their creature may be released. */
export const RELEASE_MINIMUM_ENCOUNTERS = 3;

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

  return (
    <div className="border-t border-white/20 pt-6">
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
          {state === "idle" && (encountersNeeded > 0
            ? `${encountersNeeded} more ${encountersNeeded === 1 ? "encounter" : "encounters"} before release`
            : "Release into the shared tank")}
        </span>
      </button>
      <p className="mt-3 px-3 text-center text-sm leading-5 text-white/45" role="status" aria-live="polite">
        {state === "shared"
          ? `Your ${activeVisualizationCopy.singular} is now swimming on the shared screen.`
          : state === "error"
            ? "The screen could not be reached. Your story is still safe on this device."
            : `Its body and story will appear anonymously in the shared aquarium. Any artwork ratings you gave will also be submitted for exhibition evaluation. Once released, your ${activeVisualizationCopy.singular} is final.`}
      </p>
    </div>
  );
}
