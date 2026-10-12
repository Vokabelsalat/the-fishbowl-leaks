"use client";

import Image from "next/image";
import { PosterArtwork } from "@/components/poster/CreaturePoster";
import { ConstellationTargetImage } from "@/components/poster/ConstellationTargetImage";
import { artifactById } from "@/data/artifacts";

/** A4 is 210 mm wide; the poster spans it edge to edge, measured in CSS pixels at 96 per inch. */
const sheetWidthPixels = (210 / 25.4) * 96;
/** The poster carries the Fishbowl Leaks target on dark, so the example on the sheet can be scanned too. */
const exampleArtifact = artifactById.get("fishbowl-leaks")!;

/**
 * The A4 sheet that hangs in the exhibition: the poster across the top and the few steps it takes to
 * join in below, with the code to open the app and the Fishbowl Leaks constellation as an example of what to scan.
 */
export function PosterTutorialSheet({ seed, pose }: { seed: string; pose?: string }) {
  return (
    <main className="poster-tutorial-sheet flex flex-col overflow-hidden bg-[var(--abyss)] text-[var(--foam)]">
      <style>{"@page { size: A4; margin: 0; } nextjs-portal { display: none; }"}</style>
      <PosterArtwork seed={seed} pose={pose} width={sheetWidthPixels} landscape />

      <section className="flex flex-1 flex-col px-[14mm] pt-[8mm] pb-[12mm]" aria-labelledby="tutorial-title">
        <h2 id="tutorial-title" className="font-display text-[30pt] leading-none tracking-[-0.04em]">
          Grow your own story creature
        </h2>

        <ol className="mt-[9mm] grid grid-cols-2 gap-x-[10mm] gap-y-[8mm]">
          <li className="flex flex-col">
            <div className="flex h-[70mm] items-end">
              {/* The code's quiet zone (4 of 33 modules a side) overhangs, so the code itself lines up with the text. */}
              <Image src="/images/exhibition-qr.svg" alt="QR code linking to https://aar.kusnick.com" width={164} height={164} className="-mx-[7.4mm] -mb-[7.4mm] block h-[61mm] w-[61mm] max-w-none" unoptimized />
            </div>
            <p className="mt-[5mm] flex gap-[3mm] text-[11.5pt] leading-[1.35]">
              <span className="font-display text-[20pt] leading-none text-[var(--phosphor)]">1</span>
              <span>Scan the code to open the aquarium on your phone, or visit aar.kusnick.com.</span>
            </p>
          </li>
          <li className="flex flex-col">
            <div className="flex h-[70mm] items-end">
              <ConstellationTargetImage artifact={exampleArtifact} surface="dark" className="block h-[70mm] w-[52.5mm]" />
            </div>
            <p className="mt-[5mm] flex gap-[3mm] text-[11.5pt] leading-[1.35]">
              <span className="font-display text-[20pt] leading-none text-[var(--phosphor)]">2</span>
              <span>Look around the exhibition for constellations like this one and scan them. Every artwork changes your creature.</span>
            </p>
          </li>
          <li className="col-span-2">
            <p className="flex gap-[3mm] text-[11.5pt] leading-[1.35]">
              <span className="font-display text-[20pt] leading-none text-[var(--phosphor)]">3</span>
              <span>Finish your story and release your creature into the shared aquarium on the big screen.</span>
            </p>
          </li>
        </ol>
      </section>
    </main>
  );
}
