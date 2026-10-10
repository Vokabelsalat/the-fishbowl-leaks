import { describe, expect, it } from "vitest";
import {
  aquaticForms,
  creatureSizeScale,
  creatureSpeedFactor,
  creatureSpeedHoldSeconds,
  creatureSpeedLevel,
  isAquaticForm,
  pickAquaticForm,
} from "@/lib/creature/aquaticForms";

describe("aquatic creature forms", () => {
  it("picks a stable form for the same first encounter", () => {
    expect(pickAquaticForm("session:artwork:100")).toBe(
      pickAquaticForm("session:artwork:100"),
    );
  });

  it("distributes different sessions across every available form", () => {
    const selected = new Set(
      Array.from({ length: 200 }, (_, index) => pickAquaticForm(`session-${index}`)),
    );

    expect(selected).toEqual(new Set(aquaticForms));
  });

  it("validates values received from persistence and the contribution API", () => {
    expect(isAquaticForm("jellyfish")).toBe(true);
    expect(isAquaticForm("eel")).toBe(false);
    expect(isAquaticForm("seagull")).toBe(false);
  });

  it("assigns stable, visibly different creature sizes", () => {
    expect(creatureSizeScale("visitor-12")).toBe(creatureSizeScale("visitor-12"));
    const sizes = new Set(
      Array.from({ length: 100 }, (_, index) => creatureSizeScale(`visitor-${index}`)),
    );
    expect(sizes.size).toBe(5);
    expect(Math.min(...sizes)).toBeLessThan(0.8);
    expect(Math.max(...sizes)).toBeGreaterThan(1.2);
  });
});

describe("creatureSpeedFactor", () => {
  const ids = Array.from({ length: 600 }, (_, index) => `public-${index}`);

  it("gives each visitor a stable speed", () => {
    expect(creatureSpeedFactor("public-1")).toBe(creatureSpeedFactor("public-1"));
  });

  it("spreads visitors over the starting speed levels without sprinting", () => {
    const factors = ids.map((id) => creatureSpeedFactor(id));
    expect(factors.some((factor) => factor < 0.45)).toBe(true);
    expect(factors.some((factor) => factor > 0.99 && factor < 1.21)).toBe(true);
    expect(factors.some((factor) => factor > 1.62)).toBe(true);
    expect(factors.every((factor) => factor >= 0.4 * 0.9 && factor <= 1.8 * 1.1)).toBe(true);
  });

  it("sprints now and then after the first change of pace", () => {
    const levels = ids.map((id) => creatureSpeedLevel(id, 3).name);
    const sprints = levels.filter((name) => name === "sprinting").length;
    expect(sprints).toBeGreaterThan(ids.length * 0.08);
    expect(sprints).toBeLessThan(ids.length * 0.22);
  });

  it("does not tie speed to size", () => {
    const smallest = ids.filter((id) => creatureSizeScale(id) === 0.72);
    const levels = new Set(smallest.map((id) => Math.round(creatureSpeedFactor(id) * 2)));
    expect(levels.size).toBeGreaterThanOrEqual(3);
  });
});

describe("changing pace", () => {
  it("moves each creature through different speed levels over time", () => {
    const levels = Array.from({ length: 12 }, (_, change) => creatureSpeedFactor("public-7", change));
    expect(new Set(levels.map((factor) => (factor < 0.7 ? "drifting" : factor > 1.5 ? "darting" : "steady"))).size).toBeGreaterThan(1);
    expect(creatureSpeedFactor("public-7", 3)).toBe(creatureSpeedFactor("public-7", 3));
  });

  it("holds each pace for 6 to 18 seconds and sprints for only a few", () => {
    const changes = Array.from({ length: 200 }, (_, change) => change);
    const isSprint = (change: number) => creatureSpeedLevel("public-7", change).name === "sprinting";
    const holds = changes.filter((change) => !isSprint(change)).map((change) => creatureSpeedHoldSeconds("public-7", change));
    const sprints = changes.filter(isSprint).map((change) => creatureSpeedHoldSeconds("public-7", change));
    expect(holds.every((seconds) => seconds >= 6 && seconds <= 18)).toBe(true);
    expect(Math.max(...holds) - Math.min(...holds)).toBeGreaterThan(8);
    expect(sprints.length).toBeGreaterThan(0);
    expect(sprints.every((seconds) => seconds >= 2 && seconds <= 4.5)).toBe(true);
  });
});
