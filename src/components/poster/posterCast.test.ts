import { describe, expect, it } from "vitest";
import { aquaticForms } from "@/lib/creature/aquaticForms";
import { cast } from "./posterCast";

describe("poster cast", () => {
  it("brings every species onto the poster", () => {
    const onPoster = new Set(cast.map((role) => role.form));
    expect(aquaticForms.filter((form) => !onPoster.has(form))).toEqual([]);
  });
});
