"use client";

import Image from "next/image";
import { useState } from "react";
import type { ExhibitionArtifact } from "@/types/exhibition";
import { ArtworkFeedback } from "@/components/exhibition/ArtworkFeedback";
import { ArtworkImageViewer } from "@/components/exhibition/ArtworkImageViewer";

/** A link as readers would type it: host and path, without the scheme, "www." or a trailing slash. */
function linkLabel(link: string) {
  const url = new URL(link);
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
}

type ArtifactContentProps = {
  artifact: ExhibitionArtifact;
  onContinue: () => void;
  mini?: boolean;
  /** Called when the visitor enlarges the panel or shrinks it again, so the creature can make room. */
  onEnlargedChange?: (enlarged: boolean) => void;
};

export function ArtifactContent({ artifact, onContinue, mini = false, onEnlargedChange }: ArtifactContentProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewingImage, setViewingImage] = useState(false);
  // The artists' bios are long, so they start folded away behind their heading.
  const [biosOpen, setBiosOpen] = useState(false);
  const imageAlt = `${artifact.title} by ${artifact.artist}`;

  const toggleExpanded = () => {
    setExpanded(!expanded);
    onEnlargedChange?.(!expanded);
  };

  return (
    <article
      className="resolve-in tank-panel safe-bottom absolute inset-x-0 bottom-0 z-20 px-5 pb-4 pt-3"
      aria-labelledby="artifact-title"
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="mx-auto mb-4 flex min-h-11 items-center gap-3 border border-white/30 bg-[var(--abyss)] px-4 text-sm text-white transition-colors hover:border-white/65"
      >
        <span>{expanded ? "Show less" : "Enlarge the artwork details"}</span>
        <span aria-hidden="true">{expanded ? "↓" : "↑"}</span>
      </button>

      <div className="relative mx-auto w-full max-w-xl">
        <div className={`w-full overflow-y-auto overscroll-contain ${expanded ? "max-h-[62dvh]" : mini ? "max-h-[36dvh]" : "max-h-[48dvh]"}`}>
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
            {artifact.image && (
              // Spans the panel; tall pictures are capped in height so the text stays in reach. A tap opens it full screen.
              <button type="button" onClick={() => setViewingImage(true)} className="mb-5 block w-full cursor-zoom-in" aria-label={`Open the picture of ${artifact.title} full screen`}>
                <Image
                  src={encodeURI(artifact.image.src)}
                  alt={imageAlt}
                  width={artifact.image.width}
                  height={artifact.image.height}
                  sizes="(min-width: 36rem) 36rem, 100vw"
                  className="block h-auto max-h-[55dvh] w-full object-contain"
                />
              </button>
            )}
            {artifact.image && viewingImage && (
              <ArtworkImageViewer image={artifact.image} alt={imageAlt} onClose={() => setViewingImage(false)} />
            )}
            <p className="text-sm text-white/50">Tank classification: {artifact.classification}</p>
            {artifact.description.split("\n\n").map((paragraph) => (
              <p key={paragraph} className="mt-4 text-base leading-7 text-white/78">{paragraph}</p>
            ))}
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm leading-6">
              {artifact.platforms.length > 0 && (
                <>
                  <dt className="text-white/50">Platforms</dt>
                  {/* Groups that list several tools themselves, like one per edition, are set apart with semicolons. */}
                  <dd className="text-white/78">{artifact.platforms.join(artifact.platforms.some((platform) => platform.includes(",")) ? "; " : ", ")}</dd>
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
                        {linkLabel(link)}
                      </a>
                    ))}
                  </dd>
                </>
              )}
              {artifact.contacts.length > 0 && (
                <>
                  <dt className="text-white/50">Contact</dt>
                  <dd className="min-w-0">
                    {artifact.contacts.map((contact) => (
                      <a
                        key={contact}
                        href={`mailto:${contact}`}
                        className="block wrap-break-word text-white/78 underline underline-offset-4 transition-colors hover:text-white"
                      >
                        {contact}
                      </a>
                    ))}
                  </dd>
                </>
              )}
            </dl>
            {artifact.bios.length > 0 && (
              <section className="mt-6 border-t border-white/15 pt-5" aria-labelledby="artifact-bios">
                <h3 id="artifact-bios" className="font-display text-xl text-white/85">
                  <button
                    type="button"
                    onClick={() => setBiosOpen(!biosOpen)}
                    aria-expanded={biosOpen}
                    aria-controls="artifact-bios-text"
                    className="flex min-h-11 w-full items-center justify-between gap-3 text-left transition-colors hover:text-white"
                  >
                    <span>{artifact.bios.length > 1 ? "About the artists" : "About the artist"}</span>
                    <span aria-hidden="true" className="font-sans text-base">{biosOpen ? "↑" : "↓"}</span>
                  </button>
                </h3>
                <div id="artifact-bios-text" hidden={!biosOpen}>
                  {artifact.bios.map((bio) => (
                    <div key={bio} className="mt-4">
                      {bio.split("\n\n").map((paragraph, index) => (
                        <p key={paragraph} className={`${index > 0 ? "mt-3 " : ""}text-base leading-7 text-white/78`}>{paragraph}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <ArtworkFeedback key={artifact.id} artifactId={artifact.id} />
        </div>
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
