import type { Metadata } from "next";
import { PosterTutorialSheet } from "@/components/poster/PosterTutorialSheet";

export const metadata: Metadata = {
  title: "Tutorial sheet — The Fishbowl Leaks",
  description: "The A4 sheet that explains the exhibition app, with the poster, its QR code and an example target.",
};

export default async function PosterTutorialPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { seed, pose } = await searchParams;
  return (
    <PosterTutorialSheet
      seed={typeof seed === "string" && seed ? seed : "fishbowl"}
      pose={typeof pose === "string" ? pose : undefined}
    />
  );
}
