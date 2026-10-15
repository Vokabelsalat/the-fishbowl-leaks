"use client";

import { useEffect, useRef } from "react";
import type { ExhibitionContribution } from "@/types/contribution";
import { NarrativeLines } from "@/components/collective/NarrativeLine";

const osloDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  dateStyle: "medium",
  timeStyle: "short",
});

function speciesName(value: ExhibitionContribution["creatureForm"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDuration(dwellMs?: number) {
  if (dwellMs === undefined) return "Not recorded";
  if (dwellMs < 60_000) return `${Math.max(1, Math.round(dwellMs / 1_000))} sec`;
  return `${Math.round(dwellMs / 60_000)} min`;
}

export function SpecimenDialog({
  contribution,
  onClose,
}: {
  contribution: ExhibitionContribution;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="specimen-dialog-backdrop absolute inset-0 z-50 flex items-center justify-center p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="specimen-dialog max-h-[min(78vh,48rem)] w-[min(46rem,100%)] overflow-y-auto border border-white/25 bg-[var(--abyss)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="specimen-dialog-title"
      >
        <header className="flex items-start justify-between gap-8 border-b border-white/15 px-6 py-5 sm:px-8">
          <div>
            <p className="font-mono text-sm text-white/48">Specimen {String(contribution.id).padStart(3, "0")}</p>
            <h2 id="specimen-dialog-title" className="mt-1 font-display text-4xl tracking-[-0.035em] text-[var(--phosphor)]">
              {speciesName(contribution.creatureForm)}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 border border-white/20 text-2xl leading-none text-white/70 transition-colors hover:border-white/45 hover:text-white"
            aria-label="Close specimen details"
          >
            ×
          </button>
        </header>

        <div className="grid gap-7 px-6 py-6 sm:grid-cols-[minmax(0,1.1fr)_minmax(15rem,.9fr)] sm:px-8 sm:py-8">
          <div>
            <h3 className="font-display text-xl text-white/85">Story</h3>
            <div className="mt-3 font-display text-xl leading-[1.35] text-white/72">
              {contribution.narrative.length > 0
                ? <p><NarrativeLines lines={contribution.narrative} /></p>
                : <p>No story was recorded.</p>}
            </div>

            <h3 className="mt-8 font-display text-xl text-white/85">Exhibition encounters</h3>
            <ol className="mt-3 divide-y divide-white/12 border-y border-white/12">
              {[...contribution.parts]
                .sort((first, second) => first.sequence - second.sequence)
                .map((part) => (
                  <li key={`${part.sequence}-${part.artifactId}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3 text-sm">
                    <span className="font-mono text-white/35">{String(part.sequence + 1).padStart(2, "0")}</span>
                    <span className="text-white/75">{part.label}</span>
                    <span className="text-white/45">{formatDuration(part.dwellMs)}</span>
                  </li>
                ))}
            </ol>
          </div>

          <dl className="h-fit border-y border-white/15 text-sm">
            <div className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-white/12 py-3">
              <dt className="text-white/45">Species</dt>
              <dd className="text-white/80">{speciesName(contribution.creatureForm)}</dd>
            </div>
            <div className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-white/12 py-3">
              <dt className="text-white/45">Public ID</dt>
              <dd className="break-all font-mono text-xs text-white/70">{contribution.publicId}</dd>
            </div>
            <div className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-white/12 py-3">
              <dt className="text-white/45">Released</dt>
              <dd className="text-white/70">{osloDate.format(new Date(contribution.createdAt))}</dd>
            </div>
            <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-3">
              <dt className="text-white/45">Parts</dt>
              <dd className="text-white/70">{contribution.parts.length}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
