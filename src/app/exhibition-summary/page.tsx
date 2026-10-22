import type { Metadata } from "next";
import { CollectiveWall } from "@/components/collective/CollectiveWall";

export const metadata: Metadata = {
  title: "Exhibition Summary — The Fishbowl Leaks",
  description: "The shared aquarium replayed from the opening of the exhibition until now.",
};

/** A whole number from the URL, or the fallback when it is missing or not one. */
function wholeNumber(value: string | string[] | undefined, fallback: number) {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * The shared aquarium fast-forwarded from the opening until now, for a screen recording. `?seconds=`
 * sets how long the replay runs (120 by default), `?featured=` how many creatures arrive in full with
 * their story (5 by default, fewer when their arrivals would not fit).
 */
export default async function ExhibitionSummaryPage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  return (
    <CollectiveWall
      replay={{
        durationMs: wholeNumber(query.seconds, 120) * 1000,
        featuredCount: wholeNumber(query.featured, 5),
      }}
    />
  );
}
