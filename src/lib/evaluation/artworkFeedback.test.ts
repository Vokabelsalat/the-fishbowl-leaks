import { describe, expect, it } from "vitest";
import { isArtworkFeedback } from "@/lib/evaluation/artworkFeedback";

describe("artwork feedback validation", () => {
  it("accepts partial answers and distinguishes not applicable from unanswered", () => {
    expect(isArtworkFeedback({ narrative: 1, ludicEntertainment: 5, interaction: null })).toBe(true);
    expect(isArtworkFeedback({ interaction: 3 })).toBe(true);
    expect(isArtworkFeedback({})).toBe(true);
  });

  it.each([null, [], "3", { narrative: 0 }, { narrative: 6 }, { narrative: 2.5 }, { narrative: "4" }, { narrative: NaN }, { unknown: 3 }])(
    "rejects malformed feedback: %j",
    (value) => expect(isArtworkFeedback(value)).toBe(false),
  );
});
