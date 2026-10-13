import { launch, record, sleep, BASE, S, fitWindow } from "./lib.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const uuid = JSON.parse(readFileSync(S + "uuids.json", "utf8")).seahorse;
const only = process.argv[2]; // optionally run one step
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["camera"] };
const statePath = S + "journey-state.json";

// A soft ring where a finger touches the screen, so taps read on video.
const tapRipple = () => {
  addEventListener("pointerdown", (e) => {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(232,245,239,.35);border:2px solid rgba(232,245,239,.8);pointer-events:none;z-index:99999;transition:transform .5s ease-out,opacity .5s ease-out`;
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = "scale(1.8)"; d.style.opacity = "0"; });
    setTimeout(() => d.remove(), 600);
  }, true);
};

async function smoothScroll(page, to, ms) {
  await page.evaluate(([to, ms]) => new Promise((r) => {
    const from = scrollY, target = to === "bottom" ? document.documentElement.scrollHeight - innerHeight : to, t0 = performance.now();
    const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; scrollTo(0, from + (target - from) * e); k < 1 ? requestAnimationFrame(f) : r(); };
    requestAnimationFrame(f);
  }), [to, ms]);
}

async function scanStep(n, cam, { first = false, last = false } = {}) {
  const browser = await launch(`${S}cam/${cam}.mjpeg`, 2);
  const ctx = await browser.newContext({ ...phone, ...(first ? {} : { storageState: statePath }) });
  await ctx.addInitScript((u) => { crypto.randomUUID = () => u; }, uuid);
  await ctx.addInitScript(tapRipple);
  const page = await ctx.newPage();
  await fitWindow(page, 390, 844);
  await page.goto(BASE + "/", { waitUntil: "load" });
  await sleep(first ? 2500 : 500);
  const rec = await record(page, `phone-scan${n}`, { w: 780, h: 1688 });
  if (first) {
    await sleep(3500);
    rec.mark("tap-start");
    await page.getByRole("button", { name: /Scan an artwork marker/ }).tap();
  }
  const cont = page.getByRole("button", { name: /Continue through the exhibition/ });
  await page.getByText("Hold the artwork marker inside the frame").waitFor({ timeout: 60000 }).catch(() => {});
  rec.mark("camera-running");
  await page.getByText(/Signal located/).waitFor({ timeout: 90000 }).catch(() => {});
  rec.mark("detected");
  await cont.waitFor({ timeout: 90000 });
  rec.mark("content");
  await sleep(3000);
  rec.mark("tap-continue");
  await cont.tap();
  await sleep(2000);
  if (!last) {
    await rec.stop();
    await ctx.storageState({ path: statePath });
    await browser.close();
    return;
  }
  // The ending: open the creature, read the story, release it, and watch it arrive on the wall.
  rec.mark("tap-my-creature");
  await page.getByRole("button", { name: /Open My sea creature/ }).tap();
  await page.waitForURL(/journey/);
  await sleep(4000);
  rec.mark("scroll-story");
  await smoothScroll(page, "bottom", 7000);
  await sleep(1500);
  await ctx.storageState({ path: statePath });

  await fetch(BASE + "/api/development/synthetic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: false }) });
  // The wall starts listening before the release, so the creature arrives as a new one.
  const wallCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const wall = await wallCtx.newPage();
  await fitWindow(wall, 1920, 1080);
  await wall.goto(BASE + "/collective", { waitUntil: "load" });
  await wall.addStyleTag({ content: hideDev });
  await sleep(9000);
  const wallRec = await record(wall, "wall-arrival", { w: 1920, h: 1080 });
  await sleep(1500);
  rec.mark("tap-release"); wallRec.mark("tap-release");
  await page.getByRole("button", { name: /Release into the shared tank/ }).tap();
  await page.getByText(/crossed the glass/).waitFor({ timeout: 20000 });
  rec.mark("released");
  await sleep(4000);
  await rec.stop();
  for (let i = 0; i < 150 && !(await wall.evaluate(() => document.body.innerText.includes("A new specimen has entered the tank"))); i++) await sleep(500);
  wallRec.mark("arrival");
  await sleep(19000);
  await wallRec.stop();
  await browser.close();
}

export const hideDev = `.tank-time-slider, span:has(> select[aria-label="World event to fire"]) { opacity: 0 !important; }`;

const steps = [["1", "t1", { first: true }], ["2", "t6"], ["3", "t12"], ["4", "t15", { last: true }]];
for (const [n, cam, opts] of steps) {
  if (only && only !== n) continue;
  console.log("step", n);
  await scanStep(n, cam, opts);
}
