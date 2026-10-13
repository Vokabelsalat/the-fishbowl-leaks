import { launch, record, sleep, BASE, fitWindow, S } from "./lib.mjs";
import { writeFileSync } from "node:fs";
// usage: node tanklife.mjs <count> <seconds> [orbit]
const [count, seconds, orbit] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4] === "orbit"];
const name = `tank-${count}${orbit ? "-orbit" : ""}${process.argv[5] ?? ""}`;
const hideDev = `.tank-time-slider, span:has(> select[aria-label="World event to fire"]) { opacity: 0 !important; }`;
const browser = await launch(null, 1.5);
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
await fitWindow(page, 1920, 1080);
await page.goto(BASE + "/collective", { waitUntil: "load" });
await page.addStyleTag({ content: hideDev });
await sleep(6000);
const setMinute = (m) => page.evaluate((m) => {
  const input = document.querySelector(".tank-time-slider");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, String(m));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}, m);
const shown = () => page.evaluate(() => Number([...document.querySelectorAll("header span")].map((s) => s.textContent).find((t) => /sea creature/.test(t))?.match(/\d+/)?.[0]));
let lo = 0, hi = 1439;
while (lo < hi) { const mid = (lo + hi) >> 1; await setMinute(mid); await sleep(120); if ((await shown()) >= count) hi = mid; else lo = mid + 1; }
await setMinute(lo);
await sleep(8000);
const rec = await record(page, name, { w: 2880, h: 1620 });
const t0 = Date.now();
const log = [];
if (orbit) { await sleep(1500); rec.mark("orbit"); await page.evaluate(() => window.__trailer.orbit()); }
let lastPair = -1; const seenSchools = new Set();
while (Date.now() - t0 < seconds * 1000) {
  const state = await page.evaluate(() => {
    const t = window.__trailer; if (!t) return null;
    const rect = document.querySelector(".collective-swim-field canvas").getBoundingClientRect();
    const toScreen = (m) => m && [Math.round(rect.left + rect.width / 2 + m.x * 82), Math.round(rect.top + rect.height / 2 - m.y * 82)];
    const p = t.pairingRef.current;
    return {
      pair: p && { seq: p.sequence, forms: p.parents.map((c) => c.creatureForm), at: toScreen({ x: p.midpoint[0], y: p.midpoint[1] }) },
      schools: t.schoolingRef.current.schools.map((s) => ({ key: s.memberIds.join(","), size: s.memberIds.length,
        at: toScreen(t.actorRegistry.current.get(s.memberIds[0])?.current) })),
    };
  });
  const time = (Date.now() - t0) / 1000;
  if (state?.pair && state.pair.seq !== lastPair) { lastPair = state.pair.seq; log.push({ time, kind: "pair", ...state.pair }); console.log(time.toFixed(1), "pair", state.pair.forms.join("+"), state.pair.at); }
  for (const s of state?.schools ?? []) if (!seenSchools.has(s.key)) { seenSchools.add(s.key); log.push({ time, kind: "school", ...s }); console.log(time.toFixed(1), "school", s.size, s.at); }
  await sleep(250);
}
await rec.stop();
writeFileSync(`${S}clips/${name}-events.json`, JSON.stringify(log, null, 1));
await browser.close();
