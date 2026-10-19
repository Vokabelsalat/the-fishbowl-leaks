import { describe, expect, it } from "vitest";
import {
  canPassWall,
  compartmentAt,
  fullBreakdownCreatures,
  isOpenSea,
  openSeaCreatures,
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

  it("cracks every wall by 30 creatures, out of order, and opens them all by the open sea", () => {
    const openings = (count: number) => [0, 1, 2, 3].map((wall) => wallOpening(tankBreakdown(count), wall));
    expect(openings(0)).toEqual([0, 0, 0, 0]);
    expect(openings(10)).toEqual([0, 0, expect.any(Number), 0]);
    expect(openings(10)[2]).toBeGreaterThan(0);
    expect(openings(30).every((opening) => opening > 0)).toBe(true);
    expect(openings(openSeaCreatures)).toEqual([1, 1, 1, 1]);
    expect(isOpenSea(openSeaCreatures - 1)).toBe(false);
    expect(isOpenSea(openSeaCreatures)).toBe(true);
    expect(tankBreakdown(openSeaCreatures)).toBeLessThan(1);
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
