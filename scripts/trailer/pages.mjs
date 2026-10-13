import { launch, record, sleep, BASE, fitWindow } from "./lib.mjs";
// usage: node pages.mjs [editor|palettes|particles|poster]
const only = process.argv[2];
const posterPath = "/poster?format=landscape&seed=cdf4ff45&pose=dolphin-8%3A-0.57%3A0.24%3A-0.19%3A0.44%3A2.25%3Bnarwhal-2%3A-0.41%3A-0.07%3A-1.25%3A-0.20%3A1.60%3Bwhale-0%3A-0.58%3A-0.14%3A-0.41%3A0.37%3A1.31%3Boctopus-1%3A0.26%3A0.15%3A-0.26%3A0.71%3A1.56%3Bfish-4%3A0.25%3A0.12%3A-0.13%3A0.03%3A1.18%3Bseal-5%3A0.99%3A-0.16%3A-0.86%3A0.77%3A1.62%3Bstarfish-11%3A-0.12%3A-1.08%3A-1.14%3A0.23%3A1.72%3Bpufferfish-7%3A-0.90%3A-0.04%3A-0.06%3A-0.04%3A1.91%3Bcrab-9%3A0.56%3A-0.16%3A0.28%3A0.29%3A1.57%3Bseahorse-6%3A13.09%3A0.24%3A1.22%3A1.08%3A1.71%3Bjellyfish-3%3A7.00%3A0.48%3A0.09%3A0.08%3A1.83%3Bclam-10%3A0.03%3A-0.16%3A-0.02%3A0.29%3A1.56%3Bturtle-12%3A0.31%3A0.20%3A0.13%3A-0.27%3A1.67%3Bray-13%3A-1.26%3A-0.15%3A-0.32%3A-1.07%3A2.22%3Bshrimp-14%3A8.77%3A-6.49%3A0.95%3A0.71%3A1.26";

// A pointer that follows the scripted mouse, since the screencast does not show the real one.
const cursor = () => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8 16 L12 24 L15.5 22.5 L11.5 14.5 L18.5 14.5 Z" fill="#e8f5ef" stroke="#031015" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    c.style.cssText = "position:fixed;left:-40px;top:-40px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));transition:transform .12s";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX - 3 + "px"; c.style.top = e.clientY - 2 + "px"; }, true);
    addEventListener("mousedown", () => { c.style.transform = "scale(.85)"; }, true);
    addEventListener("mouseup", () => { c.style.transform = ""; }, true);
  });
};

async function glideTo(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
}
async function clickOn(page, locator, pause = 1200) {
  await glideTo(page, locator); await sleep(150);
  await page.mouse.down(); await sleep(80); await page.mouse.up();
  await sleep(pause);
}
async function drag(page, x0, y0, dx, dy, ms) {
  await page.mouse.move(x0, y0, { steps: 12 }); await page.mouse.down();
  const steps = Math.round(ms / 16);
  for (let i = 1; i <= steps; i++) { const k = i / steps, e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; await page.mouse.move(x0 + dx * e, y0 + dy * e); await sleep(16); }
  await page.mouse.up();
}

const scenes = {
  async editor(page) {
    await page.goto(BASE + "/creature_editor"); await sleep(5000);
    const rec = await record(page, "page-editor", { w: 2880, h: 1620 });
    await page.mouse.move(960, 540); await sleep(1200);
    for (const form of ["octopus", "seahorse", "turtle", "pufferfish", "narwhal"]) await clickOn(page, page.getByRole("button", { name: form, exact: true }), 1300);
    for (let i = 0; i < 2; i++) await clickOn(page, page.getByRole("button", { name: "Randomize add-ons" }), 1300);
    await drag(page, 1000, 560, 380, 60, 2400); await sleep(800);
    await clickOn(page, page.getByRole("button", { name: "World events", exact: true }), 2200);
    const kraken = page.getByRole("button", { name: /Kraken/ }).first();
    if (await kraken.count()) await clickOn(page, kraken, 2400);
    await rec.stop();
  },
  async palettes(page) {
    await page.goto(BASE + "/palettes"); await sleep(5000);
    await page.evaluate(() => scrollTo(0, 120)); await sleep(800);
    const rec = await record(page, "page-palettes", { w: 2880, h: 1620 });
    await page.mouse.move(700, 400); await sleep(900);
    for (const [form, pattern] of [["seahorse", "stripes"], ["turtle", "spots"], ["octopus", "scales"], ["pufferfish", "net"]]) {
      await clickOn(page, page.getByRole("button", { name: form, exact: true }), 1100);
      await clickOn(page, page.getByRole("button", { name: pattern, exact: true }), 1100);
    }
    await rec.stop();
  },
  async particles(page) {
    await page.goto(BASE + "/particles"); await sleep(5000);
    await page.getByRole("button", { name: "Black background" }).click(); await sleep(800);
    const first = await page.locator("canvas").first().boundingBox();
    await page.evaluate((y) => scrollTo(0, y + scrollY - 60), first.y); await sleep(1200);
    const rec = await record(page, "page-particles", { w: 2880, h: 1620 });
    await page.mouse.move(900, 900); await sleep(600);
    const canvases = await page.locator("canvas").all();
    for (const [i, dx, dy] of [[0, 260, 40], [1, -240, 80], [2, 220, -60], [3, -260, -30], [5, 240, 70], [6, -220, 50]]) {
      const b = await canvases[i].boundingBox();
      await drag(page, b.x + b.width / 2 - dx / 2, b.y + b.height / 2 - dy / 2, dx, dy, 1500);
      await sleep(200);
    }
    await page.mouse.move(1900, 1000, { steps: 10 });
    await page.evaluate(() => new Promise((r) => { const from = scrollY, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / 3500); scrollTo(0, from + 700 * k * k * (3 - 2 * k)); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }));
    await sleep(500);
    await rec.stop();
  },
  async poster(page) {
    await page.goto(BASE + posterPath); await sleep(7000);
    await page.addStyleTag({ content: "button { opacity: 0 !important; }" });
    const rec = await record(page, "page-poster", { w: 2880, h: 1620 });
    await sleep(14000);
    await rec.stop();
  },
};

const browser = await launch(null, 1.5);
for (const [name, scene] of Object.entries(scenes)) {
  if (only && only !== name) continue;
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });
  if (name !== "poster") await ctx.addInitScript(cursor);
  const page = await ctx.newPage();
  await fitWindow(page, 1920, 1080);
  await scene(page);
  await ctx.close();
}
await browser.close();
