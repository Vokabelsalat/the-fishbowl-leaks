import type { Metadata } from "next";
import { ExportedModelOverrides } from "@/components/poster/ExportedModelOverrides";
import { PosterTutorialSheet } from "@/components/poster/PosterTutorialSheet";
import { readExportedOverrides } from "@/lib/poster/exportOverridesFile";

export const metadata: Metadata = {
  title: "Tutorial sheet — The Fishbowl Leaks",
  description: "The A4 sheet that explains the exhibition app, with the poster, its QR code and an example target.",
};

export default async function PosterTutorialPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { seed, pose, overrides } = await searchParams;
  return (
    // Set by poster exports, whose headless Chrome starts without the editors' saved overrides.
    <ExportedModelOverrides overrides={await readExportedOverrides(typeof overrides === "string" ? overrides : undefined)}>
      <PosterTutorialSheet
        seed={typeof seed === "string" && seed ? seed : "fishbowl"}
        pose={typeof pose === "string" ? pose : undefined}
      />
    </ExportedModelOverrides>
  );
}
