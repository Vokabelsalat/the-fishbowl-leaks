# Trailers

Two advertisement trailers for The Fishbowl Leaks, recorded from the running app and cut to the aquarium soundtrack. Both are 1920 × 1080 at 30 fps, H.264 with AAC audio normalised to about −16 LUFS.

| Cut | Length | File | Build command |
| --- | --- | --- | --- |
| Short | 1:34 | `scripts/trailer/work/fishbowl-leaks-trailer.mp4` | `python3 build.py teaser` |
| Extended | 1:59 | `scripts/trailer/work/fishbowl-leaks-trailer-extended.mp4` | `python3 build.py extended` |

The video files are not in the repository: `scripts/trailer/work/` is gitignored and holds the raw footage (about 1 GB). Copies of the finished cuts were exported to `~/Movies`.

## What the trailers show

Both follow one visitor's story and then the tank over a day. Captions are set in the app's display face (Iowan Old Style) in `--foam`, adapted from the intro screen and the README.

### Short trailer

| Time | Shot | Caption |
| --- | --- | --- |
| 0:00 | The ordered tank at 10 creatures, a mermaid swims in | This aquarium is trying to classify the exhibition. |
| 0:07 | Fishing hook (close-up) | |
| 0:10 | Mermaid settles on the floor (close-up) | |
| 0:13 | Phone: intro screen, then scanning Finding Frida, a seahorse specimen forms | Scan the markers beside the artworks. |
| 0:25 | Phone: scanning Glasslike Fabric, Goliath and Fiery Sparks of Light | Gather fragments of a story. |
| 0:34 | Phone: release chamber with the generated story | Grow a creature the tank cannot fully contain. |
| 0:40 | Phone: "Release into the shared tank" | Release it into the shared aquarium. |
| 0:43 | Wall: the seahorse drops into the tank (15 creatures) with its story panel | |
| 0:50 | Wall at 50 creatures, walls broken; sardine school; sinking sardine can | With every visitor, the order breaks down. |
| 1:03 | Wall at 110 creatures, open sea; kraken; fish stick school; shark | Species break free. The tank falls apart. |
| 1:20 | The full tank | What evolves when the container starts to leak? |
| 1:25 | End card: title, "A porous virtual aquarium at After Augmented Reality", QR code, aar.kusnick.com | |

### Extended trailer

The extended cut keeps the opening, journey and arrival, and adds the making of the specimens, life in the tank, the tank orbit, and the poster.

| Time | Shot | Caption |
| --- | --- | --- |
| 0:00 | Ordered tank with mermaid, fishing hook | This aquarium is trying to classify the exhibition. |
| 0:10 | Phone journey: intro, four scans | Scan the markers… / Gather fragments of a story. |
| 0:31 | Phone: release chamber and release | Grow a creature… / Release it into the shared aquarium. |
| 0:39 | Wall: the creature drop animation | |
| 0:46 | `/palettes`: switching creatures and patterns | No two specimens are alike. |
| 0:52 | `/creature_editor`: cycling forms, randomising add-ons, orbiting the model, the mermaid and kraken in World events | Every form is shaped in its own editor. |
| 1:01 | `/particles`: constellations turned by dragging, on the black background | Each artwork leaves its own constellation. |
| 1:07 | Tank close-ups: a school of four shrimp, two octopuses pairing with the heart, their juvenile | In the tank, they school, pair and multiply. |
| 1:17 | Wall at 50 creatures; sardine school; sinking sardine can | With every visitor, the order breaks down. |
| 1:27 | Wall at 110 creatures; kraken; fish stick school | Species break free. The tank falls apart. |
| 1:38 | The tank orbit, played at double speed | What evolves when the container starts to leak? |
| 1:47 | The curated landscape poster from `todos.md`, animated, fading out | |

Some page shots are sped up to fit two minutes: palettes and constellations at 1.5×, the editor at 1.6×, the orbit at 2×.

The boat world event is in neither cut: in every take only a sliver of its hull shows at the top edge of the tank.

## Music

The trailers use the three tracks composed for the aquarium (`public/audio`), cut to their structure as written in `src/lib/audio`:

- **Threads of the tide** (harp, 12-second phrases with a melody note every 3 seconds) carries the tank opening and the visitor's journey. The cuts of the opening and the journey fall on its melody notes.
- **Pressure drift** (drones, a chord swelling every 24 seconds, used from 1:35 into the track) fades in under the leaking tank and the world events.
- The harp's last phrase, which settles back on D, closes both trailers over the end card or the poster.

## How the footage was made

Everything was recorded from `npm run dev` with headless Google Chrome, driven by Playwright, using the GPU (60 fps at 1080p on an M5).

- **Real AR scans.** The phone shots use a 390 × 844 viewport at twice the pixel density. Chrome's fake camera plays a video of each artwork with its marker beside it (`makecam.sh`), and MindAR tracks the markers itself; the simulator is not used.
- **Chosen specimen.** The visitor's form follows from a hash of the session id, so the journey replaces `crypto.randomUUID` with an id that gives a seahorse in both the aquarium and the open sea.
- **Growing tank.** The tank counts come from the synthetic exhibition day and the development time slider, set to the first minute with 10, 50 and 110 creatures. The arrival is recorded with the synthetic day switched off, so the visitor's creature lands in a tank of 15.
- **World events** are fired from the development dropdown. The dropdown and the time slider are hidden with injected CSS during recording.
- **Pairing, schooling and the orbit** happen on their own, and the "Circle the tank" button is commented out. For recording, a temporary development hook in `CollectiveCreatureField.tsx` exposed the pairing and schooling state and triggered the orbit; it was reverted afterwards.
- **Sharp close-ups.** The wall and the pages are recorded at 1.5× pixel density (2880 × 1620), so 1.5× close-ups keep their native resolution.
- **Visible pointer.** A drawn pointer follows the scripted mouse on the desktop pages, and taps on the phone show a ring.

### Screencast caveat

Chrome's screencast captures the whole headless window, not the emulated viewport, and the window is clamped by default. Recordings therefore make the window larger than the viewport (`fitWindow`) and crop the viewport out of every frame when encoding (`record` in `lib.mjs`).

## Re-recording or re-cutting

The scripts live in `scripts/trailer/`. Its README lists the recording steps in order. To change a cut without recording anything again, edit the shot, caption and music lists at the top of `build.py` and run it again. Captions, the phone frame and the end card are HTML rendered by `overlays.mjs`.

Recording changes the development database:

- `journey.mjs` releases a real contribution.
- `journey.mjs` switches the synthetic day off.
- `arrival.mjs` sends the contribution again.

Afterwards, switch the synthetic day back on and delete the journey's contribution by its session id from `work/uuids.json`.
