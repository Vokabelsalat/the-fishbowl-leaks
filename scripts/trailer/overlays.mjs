import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
const S = new URL("./work/", import.meta.url).pathname;
const base = `<style>
html,body{margin:0;width:1920px;height:1080px;background:transparent;overflow:hidden}
body{font-family:"Avenir Next",Avenir,sans-serif;color:#e8f5ef}
.d{font-family:"Iowan Old Style",Baskerville,serif;letter-spacing:-0.03em}
.wall{position:absolute;inset:0;background:radial-gradient(ellipse 900px 260px at 960px 210px,rgba(3,16,21,.62),rgba(3,16,21,0) 70%)}
.wall p{position:absolute;left:0;right:0;top:160px;margin:0;text-align:center;font-size:66px;line-height:1.1;text-shadow:0 2px 30px rgba(3,16,21,.9)}
.low{position:absolute;inset:0;background:radial-gradient(ellipse 1000px 230px at 960px 930px,rgba(3,16,21,.78),rgba(3,16,21,0) 72%)}
.low p{position:absolute;left:0;right:0;bottom:118px;margin:0;text-align:center;font-size:62px;line-height:1.1;text-shadow:0 2px 30px rgba(3,16,21,.9)}
.side p{position:absolute;left:1060px;width:700px;top:50%;transform:translateY(-50%);margin:0;font-size:68px;line-height:1.1;text-wrap:balance}
</style>`;
const pages = {
  "cap-classify": `<div class="wall"><p class="d">This aquarium is trying to classify the exhibition.</p></div>`,
  "cap-scan": `<div class="side"><p class="d">Scan the markers beside the artworks.</p></div>`,
  "cap-gather": `<div class="side"><p class="d">Gather fragments of a story.</p></div>`,
  "cap-grow": `<div class="side"><p class="d">Grow a creature the tank cannot fully contain.</p></div>`,
  "cap-release": `<div class="side"><p class="d">Release it into the shared aquarium.</p></div>`,
  "cap-order": `<div class="wall"><p class="d">With every visitor, the order breaks down.</p></div>`,
  "cap-free": `<div class="wall"><p class="d">Species break free. The tank falls apart.</p></div>`,
  "cap-leak": `<div class="wall"><p class="d">What evolves when the container starts to leak?</p></div>`,
  "cap-unique": `<div class="low"><p class="d">No two specimens are alike.</p></div>`,
  "cap-editor": `<div class="low"><p class="d">Every form is shaped in its own editor.</p></div>`,
  "cap-constellation": `<div class="low"><p class="d">Each artwork leaves its own constellation.</p></div>`,
  "cap-tanklife": `<div class="wall"><p class="d">In the tank, they school, pair and multiply.</p></div>`,
  // Drawn under the phone's screen: its body and a soft shadow.
  "phone-under": `<div style="position:absolute;left:468px;top:48px;width:468px;height:984px;border-radius:60px;background:#0a171b;border:1.5px solid rgba(232,245,239,.22);box-sizing:border-box;box-shadow:0 30px 90px rgba(0,0,0,.55)"></div>`,
  "phone-mask": `<div style="position:absolute;left:0;top:0;width:444px;height:960px;border-radius:48px;background:#fff"></div><style>html,body{width:444px;height:960px;background:#000}</style>`,
  "endcard": `<div style="position:absolute;inset:0;background:rgba(3,16,21,.74)"></div>
    <div style="position:absolute;left:240px;top:290px">
      <h1 class="d" style="margin:0;font-weight:400;font-size:168px;line-height:.92">The Fishbowl<span style="display:block;margin-left:150px;font-style:italic;color:#b9ffdc">Leaks</span></h1>
      <p style="margin:56px 0 0;font-size:34px;line-height:1.35;max-width:1100px;color:#e8f5ef">A porous virtual aquarium at After Augmented Reality</p>
    </div>
    <div style="position:absolute;right:240px;top:330px;width:330px;text-align:center">
      <img src="qr.svg" style="display:block;width:330px;height:330px">
      <p style="margin:26px 0 0;font-size:34px">aar.kusnick.com</p>
    </div>`,
};
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
for (const [name, html] of Object.entries(pages)) {
  const mask = name === "phone-mask";
  const p = await b.newPage({ viewport: mask ? { width: 444, height: 960 } : { width: 1920, height: 1080 } });
  writeFileSync(`${S}ov/${name}.html`, `<!doctype html><meta charset="utf-8">${base}${html}`);
  await p.goto(`file://${S}ov/${name}.html`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${S}ov/${name}.png`, omitBackground: !mask });
  await p.close();
}
await b.close();
