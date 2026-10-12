import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync, brotliDecompressSync } from "node:zlib";
import { decode } from "@msgpack/msgpack";
import { describe, expect, it } from "vitest";
import { artifacts } from "@/data/artifacts";
import { targetBundleVersion } from "@/data/targetBundle";

describe("artifact target image configuration", () => {
  it("maps the full exhibition in CSV order to unique target indices", () => {
    expect(artifacts).toHaveLength(18);
    expect(artifacts.map(({ exhibitionId }) => exhibitionId)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
    expect(artifacts.map(({ targetIndex }) => targetIndex)).toEqual(
      Array.from({ length: 18 }, (_, index) => index),
    );
    expect(artifacts[0].title).toBe("Finding Frida");
    expect(artifacts[11].title).toBe("Goliath");
    expect(artifacts[14].title).toBe("Fiery Sparks of Light");
    expect(artifacts[15].title).toBe("The Fishbowl Leaks");
    expect(artifacts[16].title).toBe("Realidad Mitigada");
    expect(artifacts[17].title).toBe("Earth Fortunes");
  });

  it("keeps the three poster families while assigning artwork-specific particles", () => {
    expect(new Set(artifacts.map(({ posterImageSrc }) => posterImageSrc))).toEqual(
      new Set([
        "/images/melting-eye.jpeg",
        "/images/eye.jpeg",
        "/images/hands.jpeg",
      ]),
    );
    expect(new Set(artifacts.map(({ theme }) => theme))).toEqual(
      new Set(["memory", "interface", "worldmaking", "embodiment", "agency"]),
    );
    expect(artifacts.map(({ particleForm, color, alternativeColor }) => [particleForm, color, alternativeColor])).toEqual([
      ["torus", "#356B4B", "#245137"],
      ["triad", "#6C3F61", "#5A2F4F"],
      ["tree", "#597D8C", "#365E6D"],
      ["cuboid", "#79A83B", "#4D751C"],
      ["crest", "#D5A62E", "#8A6500"],
      ["prism", "#C4473D", "#A52E27"],
      ["book", "#ffffff", "#000000"],
      ["skateboard", "#8B5E3C", "#6B4027"],
      ["brain", "#555555", "#333333"],
      ["galaxy", "#51477F", "#40356D"],
      ["pillar", "#B44772", "#8E2F57"],
      ["dodecahedron", "#2D7F88", "#185F68"],
      ["crystal", "#8CB6C7", "#3D7288"],
      ["hourglass", "#C19D65", "#77572F"],
      ["spiral", "#E45D3E", "#B43822"],
      ["fish", "#2F6FB5", "#1D4F8A"],
      ["crescent", "#9A6BDB", "#5E2E9A"],
      ["butterfly", "#C77B30", "#94531A"],
    ]);
  });

  it("gives every artifact a distinct creature part", () => {
    expect(new Set(artifacts.map(({ creaturePart }) => creaturePart.id)).size).toBe(18);
    expect(
      artifacts.find(({ id }) => id === "grand-hotel-bald-cockatoo")?.creaturePart,
    ).toMatchObject({ id: "cockatoo-beak", label: "Cockatoo beak" });
  });

  it("includes complete aquarium metadata for every artifact", () => {
    artifacts.forEach((artifact) => {
      expect(artifact.marineType).toBeTruthy();
      expect(artifact.classification).toBeTruthy();
      expect(artifact.visualTraits).toHaveLength(2);
      expect(artifact.storylet).toBeTruthy();
      expect(artifact.choice.options).toHaveLength(2);
    });
  });
});

describe("compiled MindAR bundle", () => {
  it("contains one white target per artifact", () => {
    const bundle = decode(readFileSync("public/targets/exhibition.mind")) as {
      dataList: unknown[];
    };
    expect(bundle.dataList).toHaveLength(artifacts.length);
  });

  it("is versioned and precompressed from the current bundle", () => {
    const bundle = readFileSync("public/targets/exhibition.mind");
    expect(createHash("sha256").update(bundle).digest("hex").slice(0, 12)).toBe(targetBundleVersion);
    expect(brotliDecompressSync(readFileSync("public/targets/exhibition.mind.br")).equals(bundle)).toBe(true);
    expect(gunzipSync(readFileSync("public/targets/exhibition.mind.gz")).equals(bundle)).toBe(true);
  });
});
