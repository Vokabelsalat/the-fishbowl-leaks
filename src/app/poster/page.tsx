import type { Metadata } from "next";
import { CreaturePoster } from "@/components/poster/CreaturePoster";
import { ExportedModelOverrides } from "@/components/poster/ExportedModelOverrides";
import { readExportedOverrides } from "@/lib/poster/exportOverridesFile";

export const metadata: Metadata = {
  title: "Poster — The Fishbowl Leaks",
  description: "A movie-style poster with a seeded ensemble of augmented creatures.",
};

/** A short seed for a new cast, drawn once per request on the server. */
function freshSeed() {
  return crypto.randomUUID().slice(0, 8);
}

export default async function PosterPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { seed, width, pose, format, bare, overrides } = await searchParams;
  const fixedWidth = Number(width);
  return (
    // Set by poster exports, whose headless Chrome starts without the editors' saved overrides.
    <ExportedModelOverrides overrides={await readExportedOverrides(typeof overrides === "string" ? overrides : undefined)}>
      <CreaturePoster
        // Without a seed every visit draws a new cast; the poster logs its seed so it can be recreated.
        seed={typeof seed === "string" && seed ? seed : freshSeed()}
        width={Number.isFinite(fixedWidth) && fixedWidth > 0 ? fixedWidth : undefined}
        pose={typeof pose === "string" ? pose : undefined}
        landscape={format === "landscape"}
        bare={bare === "1"}
      />
    </ExportedModelOverrides>
  );
}
