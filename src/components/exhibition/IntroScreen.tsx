"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { artifacts } from "@/data/artifacts";
import type { ExhibitionArtifact } from "@/types/exhibition";
import { useAppDispatch } from "@/store/hooks";
import { startJourney } from "@/store/journeySlice";
import { BiomeBackdrop } from "@/components/visualization/BiomeBackdrop";
import { ScrollNotice } from "@/components/ui/ScrollNotice";
import { exampleTarget, radarGlowSrc } from "@/components/exhibition/targetExample";

/** The works in exhibition order, as the catalogue lists them. */
const worksInExhibitionOrder = artifacts.slice().sort((a, b) => a.exhibitionId - b.exhibitionId);

/** The exhibition's themes in the order they first appear, for filtering the works list. */
const exhibitionThemes = Array.from(new Set(worksInExhibitionOrder.flatMap((work) => work.exhibitionThemes)));

const filterClass = (selected: boolean) =>
  `min-h-11 border px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--phosphor)] ${
    selected ? "border-[var(--phosphor)] bg-[var(--phosphor)] text-[var(--abyss)]" : "border-white/40 text-white hover:border-white/70"
  }`;

/** The radar's markers: the tutorial example first, then the other works in exhibition order. */
const radarTargetIds = [
  exampleTarget.artifactId,
  ...worksInExhibitionOrder.map((work) => work.id).filter((id) => id !== exampleTarget.artifactId),
];

/**
 * A fifth contact that slowly resolves into a marker and condenses back, showing visitors what to look for.
 * Each cycle of the CSS animation brings the next work's constellation, swapped while it is invisible.
 */
function RadarTarget() {
  const [index, setIndex] = useState(0);
  const next = radarTargetIds[(index + 1) % radarTargetIds.length];

  // Load the next marker ahead of time, so it is ready when the swap happens.
  useEffect(() => {
    new window.Image().src = radarGlowSrc(next);
  }, [next]);

  return (
    <>
      <span className="radar-target-blip" />
      <span className="radar-target" onAnimationIteration={() => setIndex((current) => (current + 1) % radarTargetIds.length)}>
        <Image
          src={radarGlowSrc(radarTargetIds[index])}
          alt=""
          width={exampleTarget.width}
          height={exampleTarget.height}
          unoptimized
          className="h-auto w-full"
        />
      </span>
    </>
  );
}

/** The works list with the exhibition's themes as filters above it. */
function WorksList() {
  const [theme, setTheme] = useState<string | null>(null);
  const works = theme ? worksInExhibitionOrder.filter((work) => work.exhibitionThemes.includes(theme)) : worksInExhibitionOrder;

  return (
    <>
      <div role="group" aria-label="Filter the artworks by theme" className="mt-5 flex max-w-2xl flex-wrap gap-2">
        <button type="button" aria-pressed={theme === null} onClick={() => setTheme(null)} className={filterClass(theme === null)}>
          All works
        </button>
        {exhibitionThemes.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={theme === option}
            onClick={() => setTheme(theme === option ? null : option)}
            className={filterClass(theme === option)}
          >
            {option}
          </button>
        ))}
      </div>
      <p className="mt-4 text-base leading-6 text-white/74" role="status">
        {theme ? `${works.length} works on ${theme.toLowerCase()}` : `All ${works.length} works`}
      </p>
      {/* One column, so an unfolded work does not stretch an empty neighbour beside it. */}
      <ul className="mt-4 max-w-2xl">
        {works.map((work) => <WorkEntry key={work.id} work={work} />)}
      </ul>
    </>
  );
}

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
          // Once unfolded, the full picture below replaces the thumbnail.
          className={`grid w-full items-center gap-4 py-4 text-left ${open ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[4.5rem_minmax(0,1fr)_auto]"}`}
        >
          {!open && (
            <span className="relative block aspect-square w-full overflow-hidden bg-white/[0.035]">
              {work.image && (
                <Image src={encodeURI(work.image.src)} alt="" fill sizes="4.5rem" className="object-cover" />
              )}
            </span>
          )}
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
      <div className="safe-top relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col">

        {/* On phones the title sits at the top and the porthole floats in the space left below it. */}
        <section className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-4 pb-4 pt-1 md:grid-cols-[1.25fr_.75fr] md:grid-rows-1 md:items-center md:gap-6 lg:grid-cols-[1.1fr_.9fr] md:py-8" aria-labelledby="intro-title">
          <div className="relative z-10">
            <h1 id="intro-title" className="font-display max-w-3xl text-[clamp(3.2rem,13vw,9rem)] leading-[0.73] tracking-[-0.075em]">
              The Fishbowl
              <span className="flex translate-x-[8vw] items-end gap-3 md:translate-x-20 md:gap-5">
                <span className="italic text-[var(--phosphor)]">Leaks</span>
                <span className="font-body whitespace-nowrap text-base leading-5 tracking-normal text-white/74 md:text-lg md:leading-6">
                  by Jakob Kusnick
                </span>
              </span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-6 text-white/74 md:mt-8 md:text-lg md:leading-7">
              This aquarium is trying to classify the exhibition. Scan the markers, gather fragments of a story, and grow a creature it cannot fully contain.
            </p>
            <div className="mt-5">
              <ScrollNotice label="The exhibition's artworks are below" placement="inline" targetId="works-title" />
            </div>
          </div>

          <div className="porthole-well">
            <div className="porthole" aria-hidden="true">
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
                <RadarTarget />
                <span className="theme-echo theme-echo-memory">Memory and afterlives</span>
                <span className="theme-echo theme-echo-systems">Synthetic systems and constructed authority</span>
                <span className="theme-echo theme-echo-language">Language across materials</span>
                <span className="theme-echo theme-echo-dreams">Dreams and simulated worlds</span>
                <span className="theme-echo theme-echo-embodiment">Embodiment, care, and resistance</span>
              </div>
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
          The exhibition&apos;s artworks
        </h2>
        <p className="mt-3 max-w-lg text-base leading-6 text-white/74">
          Each one has a marker. Find them in the space, scan them, and let them shape your creature.
        </p>
        <WorksList />
      </section>

    </main>
  );
}
