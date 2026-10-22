import { plainNarrativeLine } from "@/lib/narrative/narrativeMarkup";
import type { ExhibitionContribution } from "@/types/contribution";

/**
 * The exhibition summary replays the tank from its opening until now in a few minutes. Most visitors'
 * creatures slip into the tank as the clock races on; a few, spread over the run and chosen for their
 * long stories, arrive the way they did at the wall, with the clock held while their story shows.
 */

/** The time spent on the run is shared between the clock (this much) and the creatures (the rest), so busy hours stretch and empty nights pass quickly. */
const realTimeShare = 0.4;
/** The ordered tank is shown this long before the first creature comes. */
export const replayLeadInMs = 3_000;
/** The featured arrivals take at most this share of the run, so the clock still has time to race. */
const featuredShare = 0.65;

/** How long a featured creature's arrival lasts: long enough to read its whole story. */
export function replayArrivalMs(contribution: ExhibitionContribution) {
  const characters = contribution.narrative.map(plainNarrativeLine).join(" ").length;
  return Math.min(17_000, Math.max(9_000, 6_000 + characters * 35));
}

export type ReplayStep = {
  contribution: ExhibitionContribution;
  /** Where in the fast-forward the creature comes, from 0 (the opening) to 1 (now). */
  at: number;
  /** Set for a featured creature: how long its arrival lasts, while the clock holds. */
  arrivalMs?: number;
};

export type ReplayPlan = {
  steps: ReplayStep[];
  /** How long the clock races from the opening until now, without the lead-in and the featured arrivals. */
  fastForwardMs: number;
  /** The replayed time for a point in the fast-forward, from 0 to 1. */
  timeAt: (progress: number) => number;
};

/**
 * Plans the replay of the visitors' creatures, released between `openedAt` and `endAt`, over about
 * `durationMs`, with up to `featuredCount` of them arriving in full.
 */
export function planReplay(
  visitors: ExhibitionContribution[],
  { openedAt, endAt, durationMs, featuredCount }: { openedAt: number; endAt: number; durationMs: number; featuredCount: number },
): ReplayPlan {
  const sorted = [...visitors].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
  const span = Math.max(1, endAt - openedAt);
  const anchors = sorted.map((contribution, index) => ({
    at: realTimeShare * ((Date.parse(contribution.createdAt) - openedAt) / span) + (1 - realTimeShare) * ((index + 1) / (sorted.length + 1)),
    time: Date.parse(contribution.createdAt),
  }));
  const points = [{ at: 0, time: openedAt }, ...anchors, { at: 1, time: endAt }];
  const timeAt = (progress: number) => {
    const next = points.findIndex((point) => point.at >= progress);
    if (next <= 0) return next === 0 ? openedAt : endAt;
    const from = points[next - 1];
    const to = points[next];
    const share = to.at > from.at ? (progress - from.at) / (to.at - from.at) : 1;
    return from.time + (to.time - from.time) * share;
  };

  // One featured creature from each even stretch of the run, the one with the longest story there;
  // fewer when their arrivals would leave the clock too little time.
  const budget = (durationMs - replayLeadInMs) * featuredShare;
  let featured: number[] = [];
  for (let count = Math.min(featuredCount, sorted.length); count > 0; count -= 1) {
    featured = Array.from({ length: count }, (_, bucket) => {
      const from = Math.floor((bucket * sorted.length) / count);
      const to = Math.floor(((bucket + 1) * sorted.length) / count);
      let longest = from;
      for (let index = from; index < to; index += 1) {
        if (replayArrivalMs(sorted[index]) > replayArrivalMs(sorted[longest])) longest = index;
      }
      return longest;
    });
    if (featured.reduce((total, index) => total + replayArrivalMs(sorted[index]), 0) <= budget) break;
    featured = [];
  }
  const featuredSet = new Set(featured);
  const featuredMs = featured.reduce((total, index) => total + replayArrivalMs(sorted[index]), 0);

  return {
    steps: sorted.map((contribution, index) => ({
      contribution,
      at: anchors[index].at,
      ...(featuredSet.has(index) ? { arrivalMs: replayArrivalMs(contribution) } : {}),
    })),
    fastForwardMs: Math.max(1_000, durationMs - replayLeadInMs - featuredMs),
    timeAt,
  };
}
