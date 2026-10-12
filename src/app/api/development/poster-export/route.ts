import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = promisify(execFile);
const responseHeaders = { "Cache-Control": "no-store" };

/** Chrome as installed on macOS; set CHROME_PATH to use another Chromium build. */
const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((path): path is string => Boolean(path));

/** Portrait posters are captured 1200 px wide at 2×, giving 2400 × 3600 px; landscape ones the other way round. */
const imageWidth = 1200;
const imageScale = 2;
/** Pixel density of the tutorial's poster and target in the PDF: 3× of 96 per inch is close to 300 dpi. */
const pdfScale = 3;
/** How long Chrome lets the page build its creatures before capturing it. */
const renderBudgetMs = 15000;

function developmentOnly() {
  return process.env.NODE_ENV !== "production";
}

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: responseHeaders });
}

// Captures the poster as a PNG, or the A4 tutorial sheet as a PDF, with a headless Chrome
// loading the pages from this server.
export async function GET(request: Request) {
  if (!developmentOnly()) return failure("Posters can only be exported during development.", 404);
  const chrome = chromeCandidates.find((path) => existsSync(path));
  if (!chrome) return failure("No Chrome found. Set CHROME_PATH to a Chrome or Chromium executable.", 500);

  const requestUrl = new URL(request.url);
  const kind = requestUrl.searchParams.get("kind");
  const seed = requestUrl.searchParams.get("seed")?.replace(/[^\w-]/g, "") || "fishbowl";
  const pose = requestUrl.searchParams.get("pose");
  const landscape = requestUrl.searchParams.get("format") === "landscape";
  if (kind !== "image" && kind !== "tutorial") return failure("Unknown export kind.", 400);

  const page = new URL(kind === "image" ? "/poster" : "/poster/tutorial", requestUrl.origin);
  page.searchParams.set("seed", seed);
  if (pose) page.searchParams.set("pose", pose);
  if (kind === "image") {
    if (landscape) page.searchParams.set("format", "landscape");
    page.searchParams.set("width", String(landscape ? imageWidth * 1.5 : imageWidth));
  }

  const directory = await mkdtemp(join(tmpdir(), "poster-export-"));
  const output = join(directory, kind === "image" ? "poster.png" : "tutorial.pdf");
  const [width, height] = landscape ? [imageWidth * 1.5, imageWidth] : [imageWidth, imageWidth * 1.5];
  const captureArguments = kind === "image"
    ? [`--window-size=${width},${height}`, `--force-device-scale-factor=${imageScale}`, `--screenshot=${output}`]
    : [`--force-device-scale-factor=${pdfScale}`, "--no-pdf-header-footer", `--print-to-pdf=${output}`];

  try {
    await run(chrome, [
      "--headless=new",
      "--hide-scrollbars",
      "--ignore-certificate-errors",
      `--user-data-dir=${join(directory, "profile")}`,
      `--virtual-time-budget=${renderBudgetMs}`,
      ...captureArguments,
      page.href,
    ], { timeout: 180000 });
    const file = await readFile(output);
    const name = kind === "image"
      ? `fishbowl-leaks-poster-${seed}${landscape ? "-landscape" : ""}.png`
      : `fishbowl-leaks-tutorial-${seed}.pdf`;
    return new Response(file, {
      headers: {
        ...responseHeaders,
        "Content-Type": kind === "image" ? "image/png" : "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (error) {
    return failure(`Chrome could not capture the page: ${error instanceof Error ? error.message : error}`, 500);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
