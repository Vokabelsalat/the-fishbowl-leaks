"use client";

import { useRef, useState } from "react";
import type { ExhibitionArtifact } from "@/types/exhibition";
import { ScrollNotice } from "@/components/ui/ScrollNotice";
import { ArtworkFeedback } from "@/components/exhibition/ArtworkFeedback";

type ArtifactContentProps = {
  artifact: ExhibitionArtifact;
  onContinue: () => void;
  mini?: boolean;
};

export function ArtifactContent({ artifact, onContinue, mini = false }: ArtifactContentProps) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <article
      className="resolve-in tank-panel safe-bottom absolute inset-x-0 bottom-0 z-20 px-5 pb-4 pt-3"
      aria-labelledby="artifact-title"
    >
      <ScrollNotice
        containerRef={contentRef}
        label="Artwork details and feedback below"
      />

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mx-auto mb-4 flex min-h-11 items-center gap-3 border border-white/30 bg-[var(--abyss)] px-4 text-sm text-white transition-colors hover:border-white/65"
      >
        <span>{expanded ? "Show less" : "Enlarge the artwork details"}</span>
        <span aria-hidden="true">{expanded ? "↓" : "↑"}</span>
      </button>

      <div ref={contentRef} className={`mx-auto w-full max-w-xl overflow-y-auto overscroll-contain ${expanded ? "max-h-[62dvh]" : mini ? "max-h-[36dvh]" : "max-h-[48dvh]"}`}>
        <h2 id="artifact-title" className="font-display max-w-lg text-[clamp(2rem,9vw,3.3rem)] leading-[0.94] tracking-[-0.055em]">
          {artifact.title}
        </h2>
        <p className="mt-2 text-sm text-white/58">{artifact.artist}</p>
        <p className="mt-1 text-sm text-white/58">{[...artifact.workType, artifact.year].join(" · ")}</p>

        <p className="mt-5 max-w-lg font-display text-xl italic leading-7 text-[var(--phosphor)]">
          {artifact.storylet}
          <span className="mt-2 block text-white/88">{artifact.choice.prompt}</span>
        </p>

        <div className="mt-6 border-t border-white/15 pt-5">
          <p className="text-sm text-white/50">Tank classification: {artifact.classification}</p>
          {artifact.description.split("\n\n").map((paragraph) => (
            <p key={paragraph} className="mt-4 text-base leading-7 text-white/78">{paragraph}</p>
          ))}
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm leading-6">
            {artifact.platforms.length > 0 && (
              <>
                <dt className="text-white/50">Platforms</dt>
                <dd className="text-white/78">{artifact.platforms.join(", ")}</dd>
              </>
            )}
            {artifact.technicalDetails && (
              <>
                <dt className="text-white/50">Technical details</dt>
                <dd className="text-white/78">{artifact.technicalDetails}</dd>
              </>
            )}
            {artifact.links.length > 0 && (
              <>
                <dt className="text-white/50">{artifact.links.length > 1 ? "Links" : "Link"}</dt>
                <dd className="min-w-0">
                  {artifact.links.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block wrap-break-word text-white/78 underline underline-offset-4 transition-colors hover:text-white"
                    >
                      {new URL(link).hostname.replace(/^www\./, "")}
                    </a>
                  ))}
                </dd>
              </>
            )}
          </dl>
          <p className="mt-5 text-sm text-white/50">Traits carried forward: {artifact.visualTraits.join(" · ")}</p>
        </div>

        <ArtworkFeedback artifactId={artifact.id} />
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mx-auto mt-5 flex min-h-14 w-full max-w-xl items-center justify-between bg-[var(--phosphor)] px-6 text-base text-[#031015] shadow-[0_0_2rem_rgba(184,255,69,0.16)] transition-transform active:scale-[0.99]"
      >
        <span>{mini ? "Return to the tank" : "Continue through the exhibition"}</span>
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}
