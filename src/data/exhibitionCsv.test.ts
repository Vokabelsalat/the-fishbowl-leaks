import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { artifacts } from "@/data/artifacts";

/** Reads public/exhibition.csv, whose quoted fields can hold commas, quotes and line breaks. */
function parse(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// public/exhibition.csv is the curated source; src/data/artifacts.ts must carry the same details.
// Titles are left out on purpose: the app sets some in title case where the CSV uses capitals.
describe("public/exhibition.csv", () => {
  it("matches the artwork details in the app", () => {
    const [header, ...rows] = parse(readFileSync("public/exhibition.csv", "utf8").replace(/^﻿/, ""));
    const list = (value: string) => value.split(";").filter(Boolean);
    const mismatches: string[] = [];
    for (const values of rows) {
      const row = Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]));
      const artifact = artifacts.find(({ exhibitionId }) => exhibitionId === Number(row.ID))!;
      const check = (name: string, actual: unknown, expected: unknown) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push(`${row.ID} ${name}: app ${JSON.stringify(actual)?.slice(0, 80)} csv ${JSON.stringify(expected)?.slice(0, 80)}`);
      };
      check("artist", artifact.artist, list(row.Artist).join(", "));
      check("type", artifact.workType, list(row.Type));
      check("year", artifact.year, Number(row.Year));
      check("description", artifact.description, row.Description);
      check("bios", artifact.bios, [row["Bio 1"], row["Bio 2"], row["Bio 3"]].filter(Boolean));
      check("platforms", artifact.platforms, list(row.Platforms));
      check("technical", artifact.technicalDetails ?? "", row["Technical details"]);
      check("links", artifact.links, list(row.Links));
      check("contacts", artifact.contacts, list(row.Contact));
      check("image", artifact.image?.src ?? "", row.image ? `/images/${row.image}` : "");
      check("color", artifact.color.toLowerCase(), row.color.toLowerCase());
      check("alternative", artifact.alternativeColor.toLowerCase(), row.alternative_color.toLowerCase());
      check("form", artifact.particleForm, row.form);
    }
    expect(mismatches).toEqual([]);
  });
});
