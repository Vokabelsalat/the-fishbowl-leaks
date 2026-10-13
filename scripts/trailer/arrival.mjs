import { launch, record, sleep, BASE, fitWindow, S, DIR } from "./lib.mjs";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const st = JSON.parse(readFileSync(S + "journey-state.json", "utf8"));
const j = JSON.parse(st.origins[0].localStorage.find((kv) => kv.name.includes("journey")).value);
new DatabaseSync(DIR + "../../data/exhibition.sqlite").prepare("DELETE FROM contributions WHERE session_id = ?").run(j.sessionId);
const hideDev = `.tank-time-slider, span:has(> select[aria-label="World event to fire"]) { opacity: 0 !important; }`;
const b = await launch(null, 1.5);
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage(); await fitWindow(page, 1920, 1080);
// Wait for the start of a minute, so the wall's half-minute clock already covers the release time.
await page.goto(BASE + "/collective"); await page.addStyleTag({ content: hideDev });
while (new Date().getSeconds() > 2) await sleep(250);
await page.reload(); await page.addStyleTag({ content: hideDev });
await sleep(9000);
const rec = await record(page, "wall-arrival", { w: 2880, h: 1620 });
await sleep(2000);
rec.mark("release");
const res = await fetch(BASE + "/api/contributions", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId: j.sessionId, completedAt: Date.now(), discoveries: j.discoveries, creatureForm: j.creatureForm, creaturePalette: j.creaturePalette, creaturePattern: j.creaturePattern, creatureProportions: j.creatureProportions }) });
console.log("post", res.status);
for (let i = 0; i < 200 && !(await page.evaluate(() => document.body.innerText.includes("A new specimen has entered the tank"))); i++) await sleep(250);
rec.mark("arrival");
await sleep(24000);
await rec.stop(); await b.close();
