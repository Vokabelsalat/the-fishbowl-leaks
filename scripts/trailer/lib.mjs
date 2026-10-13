import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
/** The scripts' folder, and the gitignored work folder beside them for camera feeds, frames and clips. */
export const DIR = new URL(".", import.meta.url).pathname;
export const S = DIR + "work/";
export const FF = ffmpegPath;
export const BASE = "http://localhost:3066";

export async function launch(cam, dsf = 1) {
  const args = [`--force-device-scale-factor=${dsf}`, "--screen-info={0,0 3840x2400}", "--use-angle=metal", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"];
  if (cam) args.push("--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${cam}`);
  return chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args });
}

/** Screencasts a page to timestamped JPEG frames; stop() writes a CFR mp4 clip and returns marks (seconds from start). */
export async function record(page, name, { w, h, quality = 92 } = {}) {
  // Frames hold the whole (oversized) window; the viewport sits in its top-left corner at w x h device pixels.
  const dir = `${S}frames/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const marks = {};
  let t0 = null;
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    const ts = metadata.timestamp;
    t0 ??= ts;
    const file = `${dir}/${String(frames.length).padStart(6, "0")}.jpg`;
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: ts - t0 });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality, maxWidth: 4000, maxHeight: 4000, everyNthFrame: 1 });
  const wall0 = Date.now() / 1000;
  return {
    mark(label) { marks[label] = Date.now() / 1000 - wall0; console.log(`[${name}] ${label} @ ${marks[label].toFixed(2)}s`); },
    async stop() {
      await cdp.send("Page.stopScreencast");
      await new Promise((r) => setTimeout(r, 300));
      // The concat demuxer holds each frame until the next one, so idle stretches keep their real length.
      const lines = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? f.t + 1 / 30) - f.t).toFixed(5)}`);
      lines.push(`file '${frames.at(-1).file}'`);
      writeFileSync(`${dir}/list.txt`, lines.join("\n"));
      const out = `${S}clips/${name}.mp4`;
      execFileSync(FF, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${dir}/list.txt`,
        "-vf", `crop=${w}:${h}:0:0,fps=30,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "14", out]);
      const dur = frames.at(-1).t;
      console.log(`[${name}] ${frames.length} frames over ${dur.toFixed(1)}s = ${(frames.length / dur).toFixed(1)} fps -> ${out}`);
      writeFileSync(`${S}clips/${name}.json`, JSON.stringify({ marks, frames: frames.length, duration: dur }, null, 1));
      return marks;
    },
  };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Grows the headless window past the emulated viewport; the screencast captures the window, so a smaller one crops the page. */
export async function fitWindow(page, w, h) {
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: Math.max(500, w) + 100, height: h + 200 } });
  await sleep(200);
}
