"use client";

import { useState } from "react";
import { activeVisualizationCopy } from "@/config/visualization";
import type { AquaticForm } from "@/lib/creature/aquaticForms";
import type { CreatureColorPalette } from "@/lib/creature/colorPalettes";
import type { CreaturePattern } from "@/lib/creature/patterns";
import type { CreatureProportions } from "@/lib/creature/proportions";
import type { Discovery } from "@/store/journeySlice";

type ShareState = "idle" | "sharing" | "shared" | "error";

export function ShareContribution({
  sessionId,
  completedAt,
  discoveries,
  creatureForm,
  creaturePalette,
  creaturePattern,
  creatureProportions,
}: {
  sessionId: string | null;
  completedAt: number | null;
  discoveries: Discovery[];
  creatureForm: AquaticForm | null;
  creaturePalette: CreatureColorPalette | null;
  creaturePattern: CreaturePattern | null;
  creatureProportions: CreatureProportions | null;
}) {
  const [state, setState] = useState<ShareState>("idle");

  async function share() {
    if (!sessionId || !completedAt || discoveries.length === 0 || state === "sharing") return;
    setState("sharing");
    try {
      const response = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, completedAt, discoveries, creatureForm, creaturePalette, creaturePattern, creatureProportions }),
      });
      if (!response.ok) throw new Error("Share failed");
      setState("shared");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="border-t border-white/20 pt-6">
      <button
        type="button"
        onClick={share}
        disabled={!sessionId || !completedAt || discoveries.length === 0 || state === "sharing" || state === "shared"}
        className="flex min-h-16 w-full items-center justify-between bg-[var(--phosphor)] px-6 text-base text-[#031015] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>
          {state === "sharing" && `Releasing your ${activeVisualizationCopy.singular}…`}
          {state === "shared" && `Your ${activeVisualizationCopy.singular} crossed the glass`}
          {state === "error" && "Try sharing again"}
          {state === "idle" && "Release into the shared tank"}
        </span>
      </button>
      <p className="mt-3 px-3 text-center text-sm leading-5 text-white/45" role="status" aria-live="polite">
        {state === "shared"
          ? `Your ${activeVisualizationCopy.singular} is now swimming on the shared screen.`
          : state === "error"
            ? "The screen could not be reached. Your story is still safe on this device."
            : `Its body and story will appear anonymously in the shared aquarium. Any artwork ratings you gave will also be submitted for exhibition evaluation.`}
      </p>
    </div>
  );
}
