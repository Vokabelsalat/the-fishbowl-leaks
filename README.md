# The Fishbowl Leaks

**The Fishbowl Leaks** transform(s) the exhibition into a porous virtual aquarium…  
 
Visitors encounter fragments of the surrounding works as marine life and unstable species through a browser-based augmented reality layer. Each encounter alters a personal creature, shaped by the visitor’s movement through the exhibition, transforming it into a generative story.  
The aquarium acts as both environment and metaphor. It displays containment but also resembles a collective, developing system. On a shared screen, the aquarium begins in a state of order: partitioned and classified. As visitors contribute their creatures, this order gradually breaks down. Texts detach, species break free, the tank falls apart, and memory is leaking, releasing the creatures into open waters… 
 
**The Fishbowl Leaks** imagine(s) a living narrative ecosystem. The single artworks start in fixed categories and grow together into a symbiotic, participatory collective, by the help of exhibition visitors. The result sits between exhibition guide, generative story system, and shared hallucination in a container. What might evolve when that container starts to leak? 

## Used Software

Augmented Reality Web-Application created by Codex (OpenAI) and Claude Code (Antropic), assisted by Jakob Kusnick using
Next.js, three.js, MindAR, Tailwind CSS, SQLite, Node.js,Inkscape, Visual Studio Code

## Setup

Use Node.js 22.13 or newer (the contribution database uses the built-in `node:sqlite` module; this repository was verified on Node 24).

```bash
npm install
npm run dev
```

Open [http://localhost:3066](http://localhost:3066). Tap **Scan an artwork marker** to enter the scanner and request camera access.

### Visualization design

All visitor-path visualizations are selected through one environment variable:

```bash
NEXT_PUBLIC_VISUALIZATION_DESIGN=fish
```

Supported values are:

- `constellation` — the node-link particle design from `main`;
- `creature` — the assembled upright form from `new_form`;
- `fish` — the articulated swimming design from `fishies` (the default).

Copy `.env.example` to `.env.local`, choose one value, and restart the development server after changing it. The setting controls reveal animations, journey views, navigation miniatures, collective-field glyphs, arrival focus, and recent contributions. All modes use the same contribution API and stored `parts` data, so changing the design does not require a database migration.

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

MindAR 1.2.5 declares the old native `canvas@2` package for its Node-based compiler tooling. This project overrides that compiler-only dependency to `canvas@3.2.3`, which installs on Node 24. Browser tracking does not use `canvas`. A small dependency-free `postinstall` patch also updates MindAR's browser build from Three.js's removed `sRGBEncoding` API to `SRGBColorSpace` and removes a statically analyzed Node-only `fs` branch. The patch is intentionally narrow, repeatable, and guarded against unexpected upstream changes.

The development and production scripts use Next.js's supported webpack mode. With MindAR's large prebundled TensorFlow module and Node 24, webpack currently provides the most repeatable client-only split across local and restricted build environments.

## Development simulation

In `npm run dev`, the simulator controls appear automatically at the bottom of the scanner. They provide:

- the numbered artwork buttons — send the same semantic artifact event as a MindAR detection and expose every work from `public/exhibition.csv`;
- **Reset journey** — clears the current Redux journey and its persisted record;
- **Finish journey** — opens the final constellation and generated narrative;
- **Hide** — reveals the camera interface; the no-camera simulator can be reopened from there.

The simulator is also offered as an accessible fallback whenever the real scanner is idle or fails. It does not maintain a second experience path: both inputs end at `handleArtifactDetected(artifactId)` in `ExhibitionExperience`.

Suggested acceptance path:

1. Start the experience.
2. Tap the first artwork and watch the attached → release → formation → content handoff.
3. Continue scanning and repeat with other works.
4. Open **My Journey** after any scan to see the constellation change.
5. Finish the reading, then reload to confirm persistence.
6. Tap **Share with the exhibition**, then open [http://localhost:3066/collective](http://localhost:3066/collective) on the wall display.

## Poster and tutorial sheet

Open `/poster` in development, click **New poster** until the cast fits (drag a creature to turn it, Shift-drag to move it; seed and poses stay in the address bar), then use the export buttons:

- **Export image** downloads the poster as a PNG, 2400 × 3600 px (3600 × 2400 px with `format=landscape`).
- **Export A4 tutorial** downloads an A4 PDF to hang in the exhibition: the poster in its landscape layout, three steps on how to take part, the QR code and the dark Fishbowl Leaks target as an example, which visitors can scan right there. The sheet itself is at `/poster/tutorial?seed=<seed>`.

Both exports load the pages in the installed Google Chrome in headless mode, which takes about a minute. Set `CHROME_PATH` to use another Chrome or Chromium. The export route only works during development.

## Shared exhibition screen

The finished-story screen can send a visitor's anonymous journey to the server. The submission contains the journey session ID, completion time, ordered artifact IDs with their scan timestamps, creature form, and the creature's explicit color palette. The server validates those values, regenerates the canonical narrative, attaches the configured glyph themes and colors, calculates each artifact's dwell time, and stores the result in SQLite. Keeping the palette with the contribution ensures the creature has the same colors during scanning, in the personal journey, and after release into the collective aquarium.

Dwell time runs from an artifact's first scan until the next new artifact is scanned. The final artifact runs until the visitor finishes the story. On the collective screen, longer dwell times produce larger colored nodes. Sizing combines a bounded logarithmic absolute scale with relative contrast inside each story, making modest timing differences visible without allowing an unusually long visit to overwhelm the composition. Previously stored stories without timing data retain the original neutral node size.

Open `/collective` full-screen on the exhibition display. It polls the live contribution feed every 2.5 seconds. Each new story expands into focus, displays its narrative, then contracts into an abstract constellation and joins up to 60 other drifting contributions. Initial history appears directly as the ambient field, so restarting the display does not replay every old story.

The tank starts each day divided into five labelled compartments. Every creature released that day cracks the walls between them a little further: the walls open one after another, each with a growing hole that creatures can swim through, until with 60 creatures (`fullBreakdownCreatures` in `src/lib/collective/tankCompartments.ts`) all walls have burst and the creatures swim together. The count includes all of the day's creatures, not only the latest ones shown, and the time slider replays it.

The stories break apart with the tank. Each new contribution stores how far the walls had broken when it was released (`tank_breakdown`), and its narrative is written with that much of its classifying vocabulary replaced by leaking words (`leakBanks` in `src/data/narrativeGrammar.ts`): walls and boundaries first, then qualities, places, traces and finally verbs, never an artwork's own subject. The wall shows a replaced word crossed out, followed by the new one. Stories released before anything broke, and every story saved before this existed, keep all their words.

Use the **Time map** switch on the collective display to see cumulative dwell time for all 18 artwork stations. This view aggregates every stored contribution (not only the recent stories in the ambient field), ranks the stations by total attention, and shows visit count plus average dwell time. Missing timing data from older stories is excluded from the totals.

The default database file is `data/exhibition.sqlite` and is ignored by Git. Set `EXHIBITION_DATABASE_PATH` to an absolute persistent volume path in production. Run one server instance against that volume; for horizontal scaling, replace the small database helper with a managed shared SQL store while preserving the API contract.

The server endpoints are:

- `POST /api/contributions` — validate and store a completed journey; duplicate session IDs are idempotent.
- `GET /api/contributions?after=<id>&limit=<n>` — return ordered contributions for the wall feed.

## Real AR testing

### 1. Add exact poster reference images

Add the final print artwork as high-quality JPG or PNG files in `public/images/`. Target images must be visually identical to the physical posters. Images with detailed, non-repeating texture track better than flat typography or large empty regions.

### 2. Compile a MindAR bundle

Open the [MindAR image target compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile/), add the images in this exact order, compile, and export the bundle:

Compile the final artwork images in the same order as `public/exhibition.csv`. The current configuration assigns target indices `0` through `17`, from **Finding Frida** through **Earth Fortunes**, so target index `N` is the artwork with exhibition ID `N + 1`.

Save the downloaded file as:

```text
public/targets/exhibition.mind
```

The exhibition prints the constellations on white. The checked-in `exhibition.mind` bundle contains 19 targets compiled from the 400 × 533 px particle constellation images in `public/targets/`: first the `-white.png` targets in exhibition ID order (`1-finding-frida-white.png` through `18-earth-fortunes-white.png`), then the dark poster target `16-fishbowl-leaks-black.png` at index 18, which opens The Fishbowl Leaks like its white target. `targetImages` in `src/data/artifacts.ts` lists them in this order; add an artifact id to `posterTargetIds` there to give another work a dark target. `npm run targets:export` regenerates them from each artifact's `alternativeColor`. The constellation gallery still previews the dark version, but dark images are not exported or compiled. `npm run targets:compile` recompiles the bundle with MindAR's offline compiler, so the web compiler is optional. Recompile whenever the compiled images change.

To lay out the constellations for the targets, open `/particles` in development (`npm run dev`). Each preview shows its target image exactly as it will be exported. Drag a constellation to turn it and Shift-drag to roll it within the image; on release it is re-framed to fill the target. **Save layout** writes every orientation to `src/data/constellationOrientations.ts`, which the target export, the print files and the scanner's assembly animation all read. Then run `npm run targets:build` to regenerate the target images, `exhibition.mind` with its compressed copies and version hash, the verification and the print files in one go, and reprint the targets whose layout changed. Saving only works while developing; the route returns 404 in production.

The compile images are deliberately small. MindAR stores every target at several scales from the full image size down to 100 px, so the bundle grows with the image resolution, while the camera only ever sees a print at a few hundred pixels. At 400 × 533 px (`COMPILE_WIDTH` in `scripts/export-particle-targets.mjs`) the bundle is about 4.5 MB instead of 6.5 MB at 800 × 600 px (measured with the earlier 4:3 targets), with the same detection results in `npm run targets:assess`. Do not go below 400 px: MindAR's tracking image needs a short side of at least 256 px.

The compile script also writes Brotli and gzip copies (`exhibition.mind.br`, `exhibition.mind.gz`) and the bundle's content hash to `src/data/targetBundle.ts`. The scanner loads the bundle from `/api/targets?v=<hash>`, which sends the smallest encoding the browser accepts (about 1.4 MB with Brotli) and lets browsers cache it for good under that hash. MindAR's msgpack format is otherwise sent uncompressed: neither Next nor Caddy compresses `application/octet-stream`.

Run `npm run targets:verify` after compiling. Each compiled target keeps a downscaled copy of its source image, and the script matches it against the PNGs to confirm that every target index resolves to the expected image. It also prints how many tracking feature points MindAR found per target.

`npm run targets:assess [typical|hard] [framesPerTarget]` estimates how reliably each target is detected. It renders synthetic 640 × 480 camera frames of every print at near, mid and far distance with random viewing angle, lighting, ink contrast, blur and noise, runs MindAR's own crop detector and matcher on them like the browser does (first matching target index wins), and reports the detection rate, wrong-target detections and a false-positive check with unrelated dot prints. With the current targets, `typical` detects 100% with no confusions; `hard` (dim light, washed-out ink, motion blur, steep angles) detects about 74%, with the misses almost all at the far distance, where the print covers only a quarter to a third of the frame's shorter side. Keep the printed target at least a third of the camera's shorter side in view: roughly, an A4-wide print up to about 0.8 m away, or larger prints for longer distances. Matte paper avoids glare that washes out the ink.

`npm run targets:print [--width-mm=400] [--dpi=300]` exports the print files, drawn with the same painter as the compile images, so prints and bundle show the same picture at any size. It writes one vector PDF per target at the given print width and a matching raster PNG at the given dpi (skip with `--dpi=0`) to `print/`, which is not committed, plus an A4 test sheet with all targets in `public/targets/print-white.pdf`, nine per page with each target's title and MindAR index.

### 3. Check the configuration mapping

`src/data/artifacts.ts` is the runtime source of truth and follows the CSV row order. `targetIndex` must match the image order used by the compiler. MindAR emits a number, the adapter forwards it, and `artifactByTargetIndex` resolves the exhibition content. The curatorial themes are **Memory**, **Interface**, **Worldmaking**, **Embodiment**, and **Agency**. Until final artwork images are available, the 18 configured works reuse three poster-image families while each keeps the artwork-specific `color`, white-background `alternative_color`, and simplified `particleForm` defined in `public/exhibition.csv`.

### 4. Serve over HTTPS on a phone

Camera APIs require a secure context. `localhost` is treated as secure on the development computer, but a phone visiting a plain `http://192.168.x.x:3000` address is not. Use an HTTPS-capable local proxy/tunnel or deploy a preview build over HTTPS, then:

1. open the HTTPS URL in iPhone Safari or Android Chrome;
2. tap **Scan an artwork marker**;
3. allow camera permission;
4. hold a compiled poster in view and move slowly while it locks on.

When the page is hidden, the prototype stops MindAR and releases the camera. Tap the restart control after returning.

## Architecture

```text
MindAR native Three.js tracker
          ↓ targetIndex
semantic adapter callback
          ↓ artifactId
Redux journey state + localStorage
          ↓
tracked AR particle volume + React content
          ↓
persistent particle constellation
          ↓
deterministic narrative generator
          ↓ share
validated contribution API + SQLite
          ↓ live feed
collective wall field
```

- `src/components/ar/MindARAdapter.ts` is the only application module that imports MindAR. It owns camera startup, anchors, its renderer loop, repeated-target gating, and disposal.
- `src/components/ar/ARScanner.tsx` dynamically imports the adapter when the visitor enters the scanner. No MindAR or camera code runs during SSR.
- `src/store/journeySlice.ts` contains only serializable application state. Three.js scenes, anchors, buffers, cameras, and DOM nodes remain local.
- `src/lib/animation/revealMachine.ts` centralizes reveal phase timings. Real and simulated detections both use the R3F full-screen source, release, disappearance, and theme-formation sequence. Real detections then hand the same deterministic formation positions to a target-anchored MindAR point cloud. Neither path updates React or Redux each frame.
- `src/components/particles/JourneyConstellation.tsx` builds one point cloud and one chronological line geometry, keeping draw calls low.
- `src/lib/narrative/generateJourneyNarrative.ts` is pure and deterministic, so an external generator can replace it later without changing the view.

### MindAR / R3F bridge

The prototype uses the reliability-first handoff described in the brief:

1. MindAR owns its native Three.js tracking scene.
2. R3F plays the cinematic screen-space release: particles fill the view, disappear, and reform as the artifact-specific geometric shape configured in the exhibition data.
3. `onTargetFound(targetIndex)` crosses the boundary as a plain number.
4. The formation positions are shared as typed arrays, not tracking objects. At the content handoff, MindAR renders that shape as a separate `THREE.Points` group above the target. It follows the anchor while tracking is active and retains its last valid pose through brief tracking interruptions.
5. A normal HTML article sheet resolves over the lower part of the camera view. Pressing **Continue scanning** explicitly removes the anchored cluster.

MindAR transforms, cameras, and render loops are not shared with the R3F renderer. Only deterministic particle formation arrays cross the visual handoff, avoiding synchronized cameras or matrices across two scene owners on mobile Safari. R3F also owns the persistent journey constellation.

## Add another poster or artifact

1. Add a typed entry to `src/data/artifacts.ts`, including a unique `id`, the next `targetIndex`, its matching `posterImageSrc`, theme, color, content, and narrative words.
2. Add or adjust its theme definition in `src/data/themes.ts` if necessary.
3. Recompile **all** reference images into `exhibition.mind` in the same order as the configured indices.
4. Run `npm run targets:compile`, which replaces `public/targets/exhibition.mind`, its compressed copies and its version hash, then test both the simulator button and the physical target.

Artifact content, target mapping, particles, persistence, constellation encoding, and narrative generation all read configuration data; no individual reveal component needs exhibition-specific logic.

## Production deployment on Ubuntu with Caddy

See [DEPLOYMENT.md](DEPLOYMENT.md) for running the app as a systemd service on `127.0.0.1:3066` behind Caddy, including updates, backups and troubleshooting.

## Persistence

The localStorage key is `say-hi:journey:v1`. It stores only session ID, start and completion times, artifact IDs, discovery order, and scan timestamps. Hydration validates malformed data before handing it to Redux. **Start again** or the development reset returns to a clean intro state. Shared journeys are separate, anonymous server records; resetting the phone does not remove a story already shared with the exhibition.

## Known prototype limitations

- Target detection has only been assessed on synthetic camera frames (`npm run targets:assess`). It must still be validated with the real prints, phones and exhibition lighting.
- The current AR-first experiment retains the last valid particle pose when tracking is lost and realigns it when the poster is reacquired. Because MindAR image tracking is not world-tracking/SLAM, that frozen pose cannot remain physically registered if the camera moves significantly while the poster is outside the frame.
- Detection has been architected for Safari/Chrome lifecycle constraints, but final tracking quality and filter tuning must be validated against the actual prints and exhibition lighting.
- The poem is template-based and English-only. It varies by first/last work, intermediate order, narrative vocabulary, count, and repeated themes, but it is not an LLM.
- Personal in-progress journeys remain device/browser-local and have no account sync. Only an explicit share sends the completed path to the server.
