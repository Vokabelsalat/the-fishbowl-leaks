import { describe, expect, it } from "vitest";
import { createDailySeeds, DAILY_SEED_COUNT } from "@/lib/contributions/dailySeeds";

describe("createDailySeeds", () => {
  const cycleStart = "2026-10-11T22:00:00.000Z";

  it("opens the day with ten different forms before any visitor", () => {
    const seeds = createDailySeeds(cycleStart, "2026-10-12");
    expect(seeds).toHaveLength(DAILY_SEED_COUNT);
    expect(new Set(seeds.map((seed) => seed.creatureForm)).size).toBe(DAILY_SEED_COUNT);
    expect(seeds.every((seed) => seed.sessionId.startsWith("daily-seed:20261012:"))).toBe(true);
    expect(seeds[0].createdAt).toBe(cycleStart);
    expect(seeds.at(-1)!.createdAt < "2026-10-11T22:01:00.000Z").toBe(true);
  });

  it("is repeatable within a day and moves on the next day", () => {
    expect(createDailySeeds(cycleStart, "2026-10-12")).toEqual(createDailySeeds(cycleStart, "2026-10-12"));
    const today = createDailySeeds(cycleStart, "2026-10-12").map((seed) => seed.creatureForm);
    const tomorrow = createDailySeeds("2026-10-12T22:00:00.000Z", "2026-10-13").map((seed) => seed.creatureForm);
    expect(tomorrow).not.toEqual(today);
  });
});
