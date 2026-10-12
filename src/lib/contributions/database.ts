import "server-only";

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ExhibitionContribution, SharedCreaturePart } from "@/types/contribution";
import { artifactById } from "@/data/artifacts";
import { artifacts } from "@/data/artifacts";
import { aggregateContributionDwellTimes } from "@/lib/contributions/heatmap";
import { createDailySeeds } from "@/lib/contributions/dailySeeds";
import { isAquaticForm, type AquaticForm } from "@/lib/creature/aquaticForms";
import { generateJourneyNarrative } from "@/lib/narrative/generateJourneyNarrative";
import {
  creatureColorPalette,
  isCreatureColorPalette,
  type CreatureColorPalette,
} from "@/lib/creature/colorPalettes";
import { creaturePattern, isCreaturePattern, type CreaturePattern } from "@/lib/creature/patterns";
import { creatureProportions, isCreatureProportions, type CreatureProportions } from "@/lib/creature/proportions";

type ContributionRow = {
  id: number;
  public_id: string;
  session_id: string;
  creature_form: string;
  creature_palette_json: string | null;
  creature_pattern_json: string | null;
  creature_proportions_json: string | null;
  glyphs_json: string;
  narrative_json: string;
  tank_breakdown: number;
  synthetic_kind: SyntheticKind | null;
  created_at: string;
};

/**
 * Why a synthetic contribution exists; visitors' own contributions have none. Every synthetic row
 * also has `is_synthetic = 1`.
 * - `test-dataset`: a full test day, switched on and off during development.
 * - `daily-seed`: one of the creatures that open every day's tank, so it never stands empty. They
 *   stay out of the heatmap and the walls' breakdown, and belong in no analysis of visitors.
 */
export type SyntheticKind = "test-dataset" | "daily-seed";

const globalForDatabase = globalThis as typeof globalThis & {
  exhibitionDatabase?: DatabaseSync;
  exhibitionDatabaseSchemaVersion?: number;
};

const DATABASE_SCHEMA_VERSION = 7;

const exhibitionClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function cycleStartIso(now = new Date()) {
  const parts = Object.fromEntries(
    exhibitionClock.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const localMidnightAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );
  const guess = new Date(localMidnightAsUtc);
  const guessParts = Object.fromEntries(
    exhibitionClock.formatToParts(guess).map((part) => [part.type, part.value]),
  );
  const representedLocalTime = Date.UTC(
    Number(guessParts.year),
    Number(guessParts.month) - 1,
    Number(guessParts.day),
    Number(guessParts.hour),
    Number(guessParts.minute),
    Number(guessParts.second),
  );
  return new Date(localMidnightAsUtc - (representedLocalTime - localMidnightAsUtc)).toISOString();
}

export function getCycleDate(now = new Date()) {
  return exhibitionClock.format(now).slice(0, 10);
}

export function getCycleStartIso(now = new Date()) {
  return cycleStartIso(now);
}

function openDatabase() {
  let database = globalForDatabase.exhibitionDatabase;
  if (!database) {
    const databasePath =
      process.env.EXHIBITION_DATABASE_PATH ??
      join(process.cwd(), "data", "exhibition.sqlite");
    mkdirSync(dirname(databasePath), { recursive: true });
    database = new DatabaseSync(databasePath);
    globalForDatabase.exhibitionDatabase = database;
  }

  if (globalForDatabase.exhibitionDatabaseSchemaVersion !== DATABASE_SCHEMA_VERSION) {
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL UNIQUE,
        creature_form TEXT NOT NULL DEFAULT 'fish',
        creature_palette_json TEXT,
        creature_pattern_json TEXT,
        creature_proportions_json TEXT,
        glyphs_json TEXT NOT NULL,
        narrative_json TEXT NOT NULL,
        is_synthetic INTEGER NOT NULL DEFAULT 0,
        synthetic_kind TEXT,
        tank_breakdown REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_contributions_created_at
        ON contributions(created_at DESC);
      PRAGMA optimize;
    `);
    const contributionColumns = database
      .prepare("PRAGMA table_info(contributions)")
      .all() as unknown as Array<{ name: string }>;
    if (!contributionColumns.some((column) => column.name === "creature_form")) {
      database.exec("ALTER TABLE contributions ADD COLUMN creature_form TEXT NOT NULL DEFAULT 'fish'");
    }
    if (!contributionColumns.some((column) => column.name === "is_synthetic")) {
      database.exec("ALTER TABLE contributions ADD COLUMN is_synthetic INTEGER NOT NULL DEFAULT 0");
    }
    // Synthetic rows from before the daily seeds all belong to the test dataset.
    if (!contributionColumns.some((column) => column.name === "synthetic_kind")) {
      database.exec("ALTER TABLE contributions ADD COLUMN synthetic_kind TEXT");
      database.exec("UPDATE contributions SET synthetic_kind = 'test-dataset' WHERE is_synthetic = 1");
    }
    if (!contributionColumns.some((column) => column.name === "creature_palette_json")) {
      database.exec("ALTER TABLE contributions ADD COLUMN creature_palette_json TEXT");
    }
    if (!contributionColumns.some((column) => column.name === "creature_pattern_json")) {
      database.exec("ALTER TABLE contributions ADD COLUMN creature_pattern_json TEXT");
    }
    if (!contributionColumns.some((column) => column.name === "creature_proportions_json")) {
      database.exec("ALTER TABLE contributions ADD COLUMN creature_proportions_json TEXT");
    }
    // Stories saved before the tank broke apart keep a breakdown of 0, so none of their words change.
    if (!contributionColumns.some((column) => column.name === "tank_breakdown")) {
      database.exec("ALTER TABLE contributions ADD COLUMN tank_breakdown REAL NOT NULL DEFAULT 0");
    }
    globalForDatabase.exhibitionDatabaseSchemaVersion = DATABASE_SCHEMA_VERSION;
  }

  return database;
}

function deserialize(row: ContributionRow): ExhibitionContribution {
  const storedParts = JSON.parse(row.glyphs_json) as Array<
    Partial<SharedCreaturePart> & Pick<SharedCreaturePart, "artifactId" | "sequence" | "theme" | "color">
  >;
  const parts = storedParts.flatMap((part) => {
    const artifact = artifactById.get(part.artifactId);
    if (!artifact) return [];
    return [{
      ...part,
      partId: part.partId ?? artifact.creaturePart.id,
      label: part.label ?? artifact.creaturePart.label,
    } as SharedCreaturePart];
  });
  const createdAt = Date.parse(row.created_at);
  let storedPalette: unknown = null;
  try {
    storedPalette = row.creature_palette_json
      ? JSON.parse(row.creature_palette_json)
      : null;
  } catch {
    storedPalette = null;
  }
  let storedPattern: unknown = null;
  try {
    storedPattern = row.creature_pattern_json
      ? JSON.parse(row.creature_pattern_json)
      : null;
  } catch {
    storedPattern = null;
  }
  let storedProportions: unknown = null;
  try {
    storedProportions = row.creature_proportions_json
      ? JSON.parse(row.creature_proportions_json)
      : null;
  } catch {
    storedProportions = null;
  }
  return {
    id: row.id,
    publicId: row.public_id,
    creatureForm: isAquaticForm(row.creature_form) ? row.creature_form : "fish",
    creaturePalette: isCreatureColorPalette(storedPalette)
      ? storedPalette
      : creatureColorPalette(row.session_id),
    // Contributions saved before patterns existed get the one their session would have drawn.
    creaturePattern: isCreaturePattern(storedPattern)
      ? storedPattern
      : creaturePattern(row.session_id),
    creatureProportions: isCreatureProportions(storedProportions)
      ? storedProportions
      : creatureProportions(row.session_id),
    parts,
    narrative: generateJourneyNarrative(
      parts.map((part) => ({
        artifactId: part.artifactId,
        sequence: part.sequence,
        discoveredAt: createdAt + part.sequence,
      })),
      artifacts,
      { breakdown: row.tank_breakdown ?? 0 },
    ),
    createdAt: row.created_at,
    ...(row.synthetic_kind === "daily-seed" ? { dailySeed: true } : {}),
  };
}

let seededCycleStart: string | null = null;

/** Puts the day's seed creatures into the tank once a day, before any visitor's creature. */
function ensureDailySeeds() {
  const cycleStart = cycleStartIso();
  if (seededCycleStart === cycleStart) return;
  for (const seed of createDailySeeds(cycleStart, getCycleDate())) {
    createContribution({ ...seed, synthetic: "daily-seed" });
  }
  seededCycleStart = cycleStart;
}

export function listContributions(afterId = 0, limit = 80) {
  ensureDailySeeds();
  const rows = openDatabase()
    .prepare(
      `SELECT id, public_id, session_id, creature_form, creature_palette_json, creature_pattern_json, creature_proportions_json, glyphs_json, narrative_json, tank_breakdown, synthetic_kind, created_at
       FROM contributions
       WHERE id > ? AND created_at >= ?
       ORDER BY id ASC
       LIMIT ?`,
    )
    .all(afterId, cycleStartIso(), limit) as unknown as ContributionRow[];

  return rows.map(deserialize);
}

export function getCollectiveHeatmap() {
  const rows = openDatabase()
    .prepare(
      `SELECT id, public_id, session_id, creature_form, creature_palette_json, creature_pattern_json, creature_proportions_json, glyphs_json, narrative_json, tank_breakdown, synthetic_kind, created_at
       FROM contributions
       WHERE created_at >= ? AND synthetic_kind IS NOT 'daily-seed'
       ORDER BY id ASC`,
    )
    .all(cycleStartIso()) as unknown as ContributionRow[];

  return aggregateContributionDwellTimes(
    rows.map(deserialize),
    artifacts.map((artifact) => artifact.id),
  );
}

export function createContribution(input: {
  publicId: string;
  sessionId: string;
  creatureForm: AquaticForm;
  creaturePalette: CreatureColorPalette;
  creaturePattern: CreaturePattern;
  creatureProportions: CreatureProportions;
  parts: SharedCreaturePart[];
  narrative: string[];
  /** How far the tank's compartments had broken apart when the creature was released. */
  tankBreakdown?: number;
  createdAt?: string;
  synthetic?: SyntheticKind;
}) {
  if (!input.synthetic) ensureDailySeeds();
  const database = openDatabase();
  database
    .prepare(
      `INSERT INTO contributions (public_id, session_id, creature_form, creature_palette_json, creature_pattern_json, creature_proportions_json, glyphs_json, narrative_json, is_synthetic, synthetic_kind, tank_breakdown, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO NOTHING`,
    )
    .run(
      input.publicId,
      input.sessionId,
      input.creatureForm,
      JSON.stringify(input.creaturePalette),
      JSON.stringify(input.creaturePattern),
      JSON.stringify(input.creatureProportions),
      JSON.stringify(input.parts),
      JSON.stringify(input.narrative),
      input.synthetic ? 1 : 0,
      input.synthetic ?? null,
      input.tankBreakdown ?? 0,
      input.createdAt ?? new Date().toISOString(),
    );

  const row = database
    .prepare(
      `SELECT id, public_id, session_id, creature_form, creature_palette_json, creature_pattern_json, creature_proportions_json, glyphs_json, narrative_json, tank_breakdown, synthetic_kind, created_at
       FROM contributions
       WHERE session_id = ?`,
    )
    .get(input.sessionId) as unknown as ContributionRow;

  return deserialize(row);
}

/** How many creatures were released into today's tank, not counting the seed creatures it opened with. */
export function getContributionCount() {
  const row = openDatabase()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM contributions
       WHERE created_at >= ? AND synthetic_kind IS NOT 'daily-seed'`,
    )
    .get(cycleStartIso()) as unknown as { count: number };
  return row.count;
}

export function getSyntheticContributionCount() {
  const row = openDatabase()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM contributions
       WHERE synthetic_kind = 'test-dataset' AND created_at >= ?`,
    )
    .get(cycleStartIso()) as unknown as { count: number };
  return row.count;
}

export function clearSyntheticContributions() {
  const result = openDatabase()
    .prepare("DELETE FROM contributions WHERE synthetic_kind = 'test-dataset'")
    .run();
  return Number(result.changes);
}
