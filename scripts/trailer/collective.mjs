import { launch, record, sleep, BASE, fitWindow } from "./lib.mjs";
const hideDev = `.tank-time-slider, span:has(> select[aria-label="World event to fire"]) { opacity: 0 !important; }`;
const durations = { mermaid: 21, boat: 22, kraken: 16, shark: 14, sardines: 16, sardineCan: 20, fishingHook: 17, fishSticks: 16 };
const scenes = {
  c10: { count: 10, intro: 8, events: ["fishingHook", "mermaid"] },
  c50: { count: 50, intro: 6, events: ["boat", "sardines", "shark", "sardineCan"] },
  c110: { count: 110, intro: 6, events: ["kraken", "fishSticks", "shark"] },
};
const only = process.argv[2];
const browser = await launch(null, 1.5);
for (const [name, sc] of Object.entries(scenes)) {
  if (only && only !== name) continue;
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
  const count = () => page.evaluate(() => Number([...document.querySelectorAll("header span")].map((s) => s.textContent).find((t) => /sea creature/.test(t))?.match(/\d+/)?.[0]));
  let lo = 0, hi = 1439;
  while (lo < hi) { const mid = (lo + hi) >> 1; await setMinute(mid); await sleep(120); if ((await count()) >= sc.count) hi = mid; else lo = mid + 1; }
  await setMinute(lo); await sleep(500);
  console.log(name, "minute", lo, "count", await count());
  await sleep(7000); // let creatures settle into the new tank state
  const rec = await record(page, `wall-${name}`, { w: 2880, h: 1620 });
  await sleep(sc.intro * 1000);
  for (const id of sc.events) {
    rec.mark(id);
    await page.evaluate((id) => {
      const select = document.querySelector('select[aria-label="World event to fire"]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, id);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, id);
    await sleep(200);
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Fire event").click());
    await sleep(durations[id] * 1000 + 500);
  }
  await rec.stop();
  await ctx.close();
}
await browser.close();
