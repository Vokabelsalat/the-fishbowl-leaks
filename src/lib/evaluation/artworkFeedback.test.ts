import { describe, expect, it } from "vitest";
import { isArtworkFeedback } from "@/lib/evaluation/artworkFeedback";

describe("artwork feedback validation", () => {
  it("accepts partial answers", () => {
    expect(isArtworkFeedback({ connection: 4, ludic: 1, spectacle: 5, narrative: 3, feelings: ["Calm", "Strange", "Sad"] })).toBe(true);
    expect(isArtworkFeedback({ spectacle: 3 })).toBe(true);
    expect(isArtworkFeedback({ feelings: [] })).toBe(true);
    expect(isArtworkFeedback({})).toBe(true);
  });

  it.each([null, [], "3", { narrative: 0 }, { narrative: 6 }, { narrative: 2.5 }, { narrative: "4" }, { narrative: NaN }, { narrative: null }, { unknown: 3 }, { interaction: 3 }, { feelings: "Calm" }, { feelings: ["Happy"] }, { feelings: ["Calm", "Calm"] }, { feelings: ["Calm", "Sad", "Moved", "Bored"] }])(
    "rejects malformed feedback: %j",
    (value) => expect(isArtworkFeedback(value)).toBe(false),
  );
});
