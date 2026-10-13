"use client";

import Image from "next/image";
import { useState } from "react";
import { artifacts } from "@/data/artifacts";
import type { ExhibitionArtifact } from "@/types/exhibition";
import { useAppDispatch } from "@/store/hooks";
import { startJourney } from "@/store/journeySlice";
import { BiomeBackdrop } from "@/components/visualization/BiomeBackdrop";
import { ScrollNotice } from "@/components/ui/ScrollNotice";

/** The works in exhibition order, as the catalogue lists them. */
const worksInExhibitionOrder = artifacts.slice().sort((a, b) => a.exhibitionId - b.exhibitionId);

/** A work in the list: its title, artists and themes, unfolding to its picture and description. */
function WorkEntry({ work }: { work: ExhibitionArtifact }) {
  const [open, setOpen] = useState(false);
  const detailsId = `work-${work.id}-details`;

  return (
    <li className="border-t border-white/15">
      {/* The heading holds the button, so screen readers can jump from work to work. */}
      <h3>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 py-4 text-left"
        >
          <span className="relative block aspect-square w-full overflow-hidden bg-white/[0.035]">
            {work.image && (
              <Image src={encodeURI(work.image.src)} alt="" fill sizes="4.5rem" className="object-cover" />
            )}
          </span>
          <span className="min-w-0">
            <span className="font-display block text-xl leading-tight tracking-[-0.02em]">{work.title}</span>
            <span className={`mt-1 block text-sm text-white/58 ${open ? "" : "truncate"}`}>{work.artist}</span>
            <span className="mt-1 block text-sm text-[var(--phosphor)]">{work.exhibitionThemes.join(" · ")}</span>
          </span>
          <span aria-hidden="true" className="text-base text-white/70">{open ? "↑" : "↓"}</span>
        </button>
      </h3>
      <div id={detailsId} hidden={!open} className="pb-6">
        {work.image && (
          <Image
            src={encodeURI(work.image.src)}
            alt={`${work.title} by ${work.artist}`}
            width={work.image.width}
            height={work.image.height}
            sizes="(min-width: 48rem) 30rem, 100vw"
            className="mb-4 block h-auto max-h-[45dvh] w-full object-contain"
          />
        )}
        <p className="text-sm text-white/58">{[...work.workType, work.year].join(" · ")}</p>
        {work.description.split("\n\n").map((paragraph) => (
          <p key={paragraph} className="mt-3 text-base leading-7 text-white/78">{paragraph}</p>
        ))}
        {work.links.length > 0 && (
          <p className="mt-4 text-sm">
            {work.links.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="block wrap-break-word text-white/78 underline underline-offset-4 transition-colors hover:text-white"
              >
                {link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}

export function IntroScreen() {
  const dispatch = useAppDispatch();

  return (
    <main className="biome-field biome-screen film-grain relative min-h-dvh overflow-x-hidden bg-[var(--abyss)] px-5 text-[var(--foam)]">
      <BiomeBackdrop progress={0.26} quiet />
      <div className="safe-top relative z-10 mx-auto flex h-dvh w-full max-w-5xl flex-col">
        {/* Inside this screen rather than directly in main, where the biome screen would make it scroll along. */}
        <ScrollNotice label="The works in the exhibition are below" />

        <section className="grid min-h-0 flex-1 items-center gap-4 py-4 md:grid-cols-[1.1fr_.9fr] md:gap-6 md:py-8" aria-labelledby="intro-title">
          <div className="relative z-10">
            <h1 id="intro-title" className="font-display max-w-3xl text-[clamp(3.2rem,13vw,9rem)] leading-[0.73] tracking-[-0.075em]">
              The Fishbowl
              <span className="block translate-x-[8vw] italic text-[var(--phosphor)] md:translate-x-20">Leaks</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-6 text-white/74 md:mt-8 md:text-lg md:leading-7">
              This aquarium is trying to classify the exhibition. Scan the markers, gather fragments of a story, and grow a creature it cannot fully contain.
            </p>
          </div>

          <div className="porthole mx-auto aspect-square w-[min(48vw,25rem)] max-md:max-h-[28dvh] max-md:max-w-[28dvh]" aria-hidden="true">
            <div className="porthole-glass">
              <span className="radar-range radar-range-outer" />
              <span className="radar-range radar-range-middle" />
              <span className="radar-range radar-range-inner" />
              <span className="radar-axis radar-axis-horizontal" />
              <span className="radar-axis radar-axis-vertical" />
              <span className="radar-sweep" />
              <span className="radar-vessel" />
              <span className="radar-contact radar-contact-one" />
              <span className="radar-contact radar-contact-two" />
              <span className="radar-contact radar-contact-three" />
              <span className="radar-contact radar-contact-four" />
              <span className="theme-echo theme-echo-memory">Memory and afterlives</span>
              <span className="theme-echo theme-echo-systems">Synthetic systems and constructed authority</span>
              <span className="theme-echo theme-echo-language">Language across materials</span>
              <span className="theme-echo theme-echo-dreams">Dreams and simulated worlds</span>
              <span className="theme-echo theme-echo-embodiment">Embodiment, care, and resistance</span>
            </div>
          </div>
        </section>

        <div className="safe-bottom relative z-10 grid items-end gap-4 border-t border-white/20 pt-4 md:grid-cols-[1fr_auto]">
          <p className="max-w-lg text-sm align-middle text-white/58">
            Camera access is requested when you enter the tank.
          </p>
          <button
            type="button"
            onClick={() => dispatch(startJourney())}
            className="flex min-h-16 w-full items-center justify-between border border-[var(--phosphor)] bg-[var(--phosphor)] px-6 text-base text-[#031015] shadow-[0_0_2rem_rgba(184,255,69,0.2)] transition-transform active:scale-[0.99] md:w-80"
          >
            <span>Scan an artwork marker</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <section className="safe-bottom relative z-10 mx-auto w-full max-w-5xl pb-10 pt-12" aria-labelledby="works-title">
        <h2 id="works-title" className="font-display text-[clamp(2rem,7vw,3.3rem)] leading-[0.94] tracking-[-0.055em]">
          The works in the exhibition
        </h2>
        <p className="mt-3 max-w-lg text-base leading-6 text-white/74">
          Each one has a marker. Find them in the space, scan them, and let them shape your creature.
        </p>
        {/* One column, so an unfolded work does not stretch an empty neighbour beside it. */}
        <ul className="mt-8 max-w-2xl">
          {worksInExhibitionOrder.map((work) => <WorkEntry key={work.id} work={work} />)}
        </ul>
      </section>
    </main>
  );
}
