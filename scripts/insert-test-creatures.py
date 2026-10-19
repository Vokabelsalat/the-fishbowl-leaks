#!/usr/bin/env python3
"""
Inserts randomized test creatures into the running exhibition database, or removes them again.

Every test creature carries a clear signature, so it can be found and removed later:
  - session_id starts with "test-creature:" and public_id with "test-creature-"
  - is_synthetic = 1 and synthetic_kind = 'test-dataset', as the app's own test dataset, so the app
    treats them as test data (the development simulator's "clear" removes them too)

They count towards breaking the tank's walls, like visitors' creatures. Their palette, pattern and
proportions are left empty, so the app draws them from the session id, and their story is told
when they are read, so neither needs to be written here.

Usage, on the server (Python 3.8+, standard library only):
  sudo -u afterar python3 scripts/insert-test-creatures.py
  sudo -u afterar python3 scripts/insert-test-creatures.py --count 20
  sudo -u afterar python3 scripts/insert-test-creatures.py --list
  sudo -u afterar python3 scripts/insert-test-creatures.py --delete

The database path comes from --database, then EXHIBITION_DATABASE_PATH, then the deployment default.
The opening time, which decides which creatures count towards the walls, comes from --opened-at,
then EXHIBITION_OPENED_AT, then /etc/after-augmented-reality.env.
"""

import argparse
import json
import os
import random
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta, timezone

DEFAULT_DATABASE = "/var/lib/after-augmented-reality/exhibition.sqlite"
ENVIRONMENT_FILE = "/etc/after-augmented-reality.env"
SESSION_PREFIX = "test-creature:"
PUBLIC_PREFIX = "test-creature-"

# Mirrors fullBreakdownCreatures in src/lib/collective/tankCompartments.ts.
FULL_BREAKDOWN_CREATURES = 100

# Mirrors aquaticForms in src/lib/creature/aquaticForms.ts, without the whale, which only swims in the open sea.
FORMS = [
    "fish", "crab", "jellyfish", "octopus", "turtle", "ray", "starfish", "seahorse",
    "seal", "shrimp", "narwhal", "dolphin", "clam", "pufferfish",
]

# Mirrors the artworks in src/data/artifacts.ts: id, theme and colour.
ARTIFACTS = [
    ("finding-frida", "memory", "#356B4B"),
    ("historically-yours", "memory", "#6C3F61"),
    ("from-ingrid-to-bergen", "memory", "#597D8C"),
    ("your-update-has-failed", "interface", "#79A83B"),
    ("grand-hotel-bald-cockatoo", "worldmaking", "#D5A62E"),
    ("glass-like-fabric", "interface", "#C4473D"),
    ("between-page-and-screen", "interface", "#ffffff"),
    ("bybanen-slop-surfer", "embodiment", "#8B5E3C"),
    ("emperor", "embodiment", "#555555"),
    ("grand-hotel-galactic-center", "worldmaking", "#51477F"),
    ("her-name-was-gisberta", "agency", "#B44772"),
    ("goliath", "worldmaking", "#2D7F88"),
    ("land-of-crystals", "memory", "#8CB6C7"),
    ("grand-hotel-sand-fountain", "memory", "#C19D65"),
    ("fiery-sparks-of-light", "interface", "#E45D3E"),
    ("fishbowl-leaks", "worldmaking", "#2F6FB5"),
    ("realidad-mitigada", "agency", "#9A6BDB"),
    ("earth-fortunes", "worldmaking", "#C77B30"),
]


def iso(moment):
    """Formats a moment as the app stores it, like JavaScript's toISOString()."""
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{moment.microsecond // 1000:03d}Z"


def environment_setting(name):
    if os.environ.get(name):
        return os.environ[name].strip()
    try:
        with open(ENVIRONMENT_FILE, encoding="utf-8") as file:
            for line in file:
                key, _, value = line.strip().partition("=")
                if key == name and value:
                    return value.strip().strip("\"'")
    except OSError:
        pass
    return ""


def opened_at(setting):
    """The opening time in the stored format, or "" to count every creature, as the app does."""
    if not setting:
        return ""
    try:
        return iso(datetime.fromisoformat(setting.replace("Z", "+00:00")))
    except ValueError:
        sys.exit(f"The opening time is not a date: {setting!r}")


def released_count(database, opening):
    """How many creatures break the walls, as getContributionCount in src/lib/contributions/database.ts counts them."""
    row = database.execute(
        "SELECT COUNT(*) FROM contributions WHERE synthetic_kind IS NOT 'daily-seed' AND created_at >= ?",
        (opening,),
    ).fetchone()
    return row[0]


def random_parts(rng):
    chosen = rng.sample(ARTIFACTS, rng.randint(1, 6))
    return [
        {
            "artifactId": artifact_id,
            "sequence": sequence,
            "theme": theme,
            "color": color,
            "dwellMs": rng.randint(20_000, 240_000),
        }
        for sequence, (artifact_id, theme, color) in enumerate(chosen, start=1)
    ]


def insert(database, count, opening, rng):
    batch = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    start = datetime.now(timezone.utc)
    released = released_count(database, opening)
    with database:
        for index in range(count):
            number = f"{index + 1:02d}"
            released += 1
            database.execute(
                """INSERT INTO contributions (public_id, session_id, creature_form, creature_palette_json,
                     creature_pattern_json, creature_proportions_json, glyphs_json, narrative_json,
                     is_synthetic, synthetic_kind, tank_breakdown, created_at)
                   VALUES (?, ?, ?, NULL, NULL, NULL, ?, '[]', 1, 'test-dataset', ?, ?)""",
                (
                    f"{PUBLIC_PREFIX}{batch}-{number}-{uuid.uuid4().hex[:8]}",
                    f"{SESSION_PREFIX}{batch}:{number}",
                    rng.choice(FORMS),
                    json.dumps(random_parts(rng)),
                    min(1.0, released / FULL_BREAKDOWN_CREATURES),
                    # A second apart, so they arrive in the tank one after another.
                    iso(start + timedelta(seconds=index)),
                ),
            )
    print(f"Inserted {count} test creatures as batch {batch}. The tank now counts {released} released creatures.")


def list_test_creatures(database):
    rows = database.execute(
        "SELECT id, session_id, creature_form, glyphs_json, created_at FROM contributions WHERE session_id LIKE ? ORDER BY id",
        (SESSION_PREFIX + "%",),
    ).fetchall()
    for row_id, session_id, form, glyphs, created_at in rows:
        print(f"{row_id:>6}  {session_id:<36} {form:<11} {len(json.loads(glyphs))} traits  {created_at}")
    print(f"{len(rows)} test creatures.")


def delete(database):
    with database:
        removed = database.execute("DELETE FROM contributions WHERE session_id LIKE ?", (SESSION_PREFIX + "%",)).rowcount
    print(f"Removed {removed} test creatures.")


def main():
    parser = argparse.ArgumentParser(description="Insert randomized test creatures into the exhibition database, or remove them.")
    parser.add_argument("--count", type=int, default=20, help="how many creatures to insert (default 20)")
    parser.add_argument("--database", help=f"path to the SQLite database (default: EXHIBITION_DATABASE_PATH or {DEFAULT_DATABASE})")
    parser.add_argument("--opened-at", help="the exhibition opening time, like 2026-10-15T17:00:00+02:00")
    parser.add_argument("--seed", type=int, help="random seed, to insert the same creatures again")
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--list", action="store_true", help="list the test creatures instead of inserting")
    action.add_argument("--delete", action="store_true", help="remove every test creature instead of inserting")
    args = parser.parse_args()

    path = args.database or environment_setting("EXHIBITION_DATABASE_PATH") or DEFAULT_DATABASE
    if not os.path.exists(path):
        sys.exit(f"No database at {path}. Start the app once, or pass --database.")
    # The app keeps the database open in WAL mode; waiting on its lock keeps both safe.
    database = sqlite3.connect(path, timeout=10)
    try:
        if args.list:
            list_test_creatures(database)
        elif args.delete:
            delete(database)
        else:
            if args.count < 1:
                sys.exit("--count must be at least 1.")
            opening = opened_at(args.opened_at or environment_setting("EXHIBITION_OPENED_AT"))
            insert(database, args.count, opening, random.Random(args.seed))
    finally:
        database.close()


if __name__ == "__main__":
    main()
