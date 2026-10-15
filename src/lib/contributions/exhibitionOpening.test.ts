import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDailySeeds } from "@/lib/contributions/dailySeeds";
import { creatureColorPalette } from "@/lib/creature/colorPalettes";
import { creaturePattern } from "@/lib/creature/patterns";
import { creatureProportions } from "@/lib/creature/proportions";

vi.mock("server-only", () => ({}));

const directory = mkdtempSync(join(tmpdir(), "exhibition-opening-"));
let database: typeof import("@/lib/contributions/database");

const visitor = (sessionId: string, createdAt: string) => ({
  publicId: sessionId,
  sessionId,
  creatureForm: "fish" as const,
  creaturePalette: creatureColorPalette(sessionId),
  creaturePattern: creaturePattern(sessionId),
  creatureProportions: creatureProportions(sessionId),
  parts: [],
  narrative: [],
  createdAt,
});

beforeAll(async () => {
  vi.stubEnv("EXHIBITION_DATABASE_PATH", join(directory, "exhibition.sqlite"));
  vi.stubEnv("EXHIBITION_OPENED_AT", "2026-10-15T17:00:00+02:00");
  database = await import("@/lib/contributions/database");
  // Seeds the tank was opened with that morning, before the tank kept its creatures.
  for (const seed of createDailySeeds("2026-10-14T22:00:00.000Z", "2026-10-15")) {
    database.createContribution({ ...seed, synthetic: "daily-seed" });
  }
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("the exhibition's opening time", () => {
  it("leaves out creatures released before it, without deleting them", () => {
    database.createContribution(visitor("before-opening", "2026-10-15T14:59:00.000Z"));
    database.createContribution(visitor("after-opening", "2026-10-15T15:01:00.000Z"));

    const shown = database.listContributions(0, 100);
    const visitors = shown.filter((contribution) => !contribution.dailySeed).map((contribution) => contribution.publicId);
    expect(visitors).toEqual(["after-opening"]);
    // Only creatures from the opening on break the walls.
    expect(database.getContributionCount()).toBe(1);
  });

  it("opens the tank with its own seed creatures, timed at the opening", () => {
    const seeds = database.listContributions(0, 100).filter((contribution) => contribution.dailySeed);
    expect(seeds).toHaveLength(10);
    for (const seed of seeds) {
      expect(seed.createdAt >= "2026-10-15T15:00:00.000Z").toBe(true);
      expect(seed.publicId).toMatch(/^daily-seed-20261015T150000Z-\d{2}$/);
    }
  });

  it("keeps every creature when no opening time is set", () => {
    vi.stubEnv("EXHIBITION_OPENED_AT", "");
    const visitors = database.listContributions(0, 100).filter((contribution) => !contribution.dailySeed);
    expect(visitors.map((contribution) => contribution.publicId)).toEqual(["before-opening", "after-opening"]);
    expect(database.getContributionCount()).toBe(2);
    vi.stubEnv("EXHIBITION_OPENED_AT", "2026-10-15T17:00:00+02:00");
  });
});
