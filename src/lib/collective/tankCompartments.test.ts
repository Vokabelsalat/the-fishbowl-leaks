import { describe, expect, it } from "vitest";
import {
  canPassWall,
  compartmentAt,
  fullBreakdownCreatures,
  separatedByWall,
  tankBreakdown,
  wallOpening,
} from "@/lib/collective/tankCompartments";

describe("tank compartments", () => {
  it("breaks down with the number of creatures, and is gone at the full count", () => {
    expect(tankBreakdown(0)).toBe(0);
    expect(tankBreakdown(fullBreakdownCreatures / 2)).toBeCloseTo(0.5);
    expect(tankBreakdown(fullBreakdownCreatures * 3)).toBe(1);
  });

  it("opens the walls one after another", () => {
    const openings = (count: number) => [0, 1, 2, 3].map((wall) => wallOpening(tankBreakdown(count), wall));
    expect(openings(0)).toEqual([0, 0, 0, 0]);
    expect(openings(fullBreakdownCreatures * 0.3)[0]).toBeGreaterThan(0);
    expect(openings(fullBreakdownCreatures * 0.3)[3]).toBe(0);
    expect(openings(fullBreakdownCreatures)).toEqual([1, 1, 1, 1]);
  });

  it("lets creatures through a wall only at the height of its hole", () => {
    // The first wall's hole sits a third of the way down, at y = 0.32 in a tank from -1 to 1.
    expect(canPassWall(0, 0.32, 0, 1)).toBe(false);
    expect(canPassWall(0, 0.32, 0.25, 1)).toBe(true);
    expect(canPassWall(0, -0.9, 0.25, 1)).toBe(false);
  });

  it("keeps creatures apart while a wall between them holds", () => {
    expect(compartmentAt(-0.9, 1)).toBe(0);
    expect(compartmentAt(0.9, 1)).toBe(4);
    expect(separatedByWall(-0.9, -0.7, 0, 1)).toBe(false);
    expect(separatedByWall(-0.9, 0.9, 0, 1)).toBe(true);
    expect(separatedByWall(-0.9, 0.9, 1, 1)).toBe(false);
  });
});
