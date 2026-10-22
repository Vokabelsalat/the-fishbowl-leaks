import { describe, expect, it } from "vitest";
import { planReplay, replayArrivalMs, replayLeadInMs } from "@/lib/collective/exhibitionReplay";
import type { ExhibitionContribution } from "@/types/contribution";

const openedAt = Date.parse("2026-10-15T15:00:00Z");
const endAt = Date.parse("2026-10-21T15:00:00Z");

function creature(id: number, hoursAfterOpening: number, storyLength = 120): ExhibitionContribution {
  return {
    id,
    narrative: ["x".repeat(storyLength)],
    createdAt: new Date(openedAt + hoursAfterOpening * 3_600_000).toISOString(),
  } as ExhibitionContribution;
}

describe("exhibition replay", () => {
  const visitors = Array.from({ length: 60 }, (_, index) => creature(index + 1, index * 2, index === 37 ? 400 : 120));

  it("brings the creatures in order, from the opening until now", () => {
    const plan = planReplay(visitors, { openedAt, endAt, durationMs: 120_000, featuredCount: 5 });
    const positions = plan.steps.map((step) => step.at);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions[0]).toBeGreaterThan(0);
    expect(positions.at(-1)).toBeLessThan(1);
    expect(plan.timeAt(0)).toBe(openedAt);
    expect(plan.timeAt(1)).toBe(endAt);
    expect(plan.timeAt(plan.steps[10].at)).toBe(Date.parse(visitors[10].createdAt));
  });

  it("features the longest story of each stretch, and keeps the whole run near its duration", () => {
    const plan = planReplay(visitors, { openedAt, endAt, durationMs: 120_000, featuredCount: 5 });
    const featured = plan.steps.filter((step) => step.arrivalMs);
    expect(featured).toHaveLength(5);
    expect(featured.map((step) => step.contribution.id)).toContain(38);
    const featuredMs = featured.reduce((total, step) => total + step.arrivalMs!, 0);
    expect(replayLeadInMs + featuredMs + plan.fastForwardMs).toBe(120_000);
  });

  it("features fewer creatures when their arrivals would leave the clock too little time", () => {
    const plan = planReplay(visitors, { openedAt, endAt, durationMs: 40_000, featuredCount: 5 });
    expect(plan.steps.filter((step) => step.arrivalMs).length).toBeLessThan(5);
  });

  it("gives a long story a longer arrival", () => {
    expect(replayArrivalMs(creature(1, 0, 400))).toBeGreaterThan(replayArrivalMs(creature(2, 0, 120)));
  });
});
