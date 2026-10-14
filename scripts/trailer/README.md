# Trailer recordings

Records the running app (`npm run dev` on port 3066) in headless Chrome and cuts the advertisement trailers to the aquarium soundtrack in `public/audio`. Recordings, camera feeds and cuts go to the gitignored `work/` folder.

```bash
cd scripts/trailer
npm install
```

Run the steps in this order; each writes its clip to `work/clips/`.

1. `node finduuid.mjs > work/uuids.json` picks session ids whose specimen is a given form; the journey uses the seahorse.
2. `./makecam.sh <target.png> <artwork.jpg> work/cam/t1.mjpeg` (likewise `t6`, `t12` and `t15`) renders the fake camera feeds, a marker beside its artwork, which MindAR really tracks.
3. `node journey.mjs` records the four scans, the ending and the release on a phone viewport. It switches the synthetic exhibition day off, so the tank shows the arrival with few creatures.
4. `node arrival.mjs` records the released creature arriving on the wall. It deletes and re-sends the journey's contribution, so it can be repeated.
5. Switch the synthetic day back on (`POST /api/development/synthetic` with `{"active": true}`), then `node collective.mjs` records the tank at 10, 50 and 110 creatures with world events.
6. `node tanklife.mjs <count> <seconds> [orbit] [suffix]` records the tank and logs pairings and schools with their screen positions. It needs a temporary development hook in `CollectiveCreatureField.tsx` that sets `window.__trailer = { pairingRef, schoolingRef, actorRegistry, orbit }`; revert it afterwards.
7. `node pages.mjs [editor|palettes|particles|poster]` records the creature editor, palettes, particle constellations and the curated poster from `todos.md`.
8. `node overlays.mjs` renders the captions, phone frame and end card.
9. `python3 build.py teaser` cuts the 94-second trailer; `python3 build.py extended` the two-minute one. Shots, captions and music cues are listed at the top of `build.py`.
10. `python3 build.py teaser stills` (or `extended stills`) exports the middle frame of every shot as a 1920 × 1080 PNG to `work/stills/<cut>/`, once `clean` and once `captioned`.

The screencast captures the whole headless window, so `fitWindow` makes it larger than the viewport and `record` crops the viewport out of each frame.
