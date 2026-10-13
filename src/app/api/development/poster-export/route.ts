import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { tutorialExampleArtifactId } from "@/components/poster/tutorialCopy";
import { artifactById } from "@/data/artifacts";
import { parseModelOverrides } from "@/lib/poster/exportOverrides";
import { exportDirectoryPrefix, exportToken, overridesFileName } from "@/lib/poster/exportOverridesFile";
import { tutorialSheetSvg } from "@/lib/poster/tutorialSvg";

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
/** The width of A4 in CSS pixels at 96 per inch, rounded to whole pixels for the window. */
const sheetWidthPixels = Math.round((210 / 25.4) * 96);
/** How long Chrome lets the page build its creatures before capturing it. */
const renderBudgetMs = 15000;

function developmentOnly() {
  return process.env.NODE_ENV !== "production";
}

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: responseHeaders });
}

type ExportKind = "image" | "tutorial" | "svg";

/** The page Chrome loads for an export, and the capture it makes there. */
function exportPlan(kind: ExportKind, origin: string, seed: string, pose: string | null, landscape: boolean, output: string, overrides: string | null) {
  const page = new URL(kind === "tutorial" ? "/poster/tutorial" : "/poster", origin);
  page.searchParams.set("seed", seed);
  if (pose) page.searchParams.set("pose", pose);
  if (overrides) page.searchParams.set("overrides", overrides);
  if (kind === "tutorial") {
    return { page, captureArguments: [`--force-device-scale-factor=${pdfScale}`, "--no-pdf-header-footer", `--print-to-pdf=${output}`] };
  }
  if (kind === "svg") {
    // The tutorial's landscape poster without its words, exactly A4 wide, which the SVG sets as text.
    page.searchParams.set("format", "landscape");
    page.searchParams.set("bare", "1");
    page.searchParams.set("width", String(sheetWidthPixels));
    return {
      page,
      captureArguments: [`--window-size=${sheetWidthPixels},${Math.floor((sheetWidthPixels * 2) / 3)}`, `--force-device-scale-factor=${pdfScale}`, `--screenshot=${output}`],
    };
  }
  if (landscape) page.searchParams.set("format", "landscape");
  page.searchParams.set("width", String(landscape ? imageWidth * 1.5 : imageWidth));
  const [width, height] = landscape ? [imageWidth * 1.5, imageWidth] : [imageWidth, imageWidth * 1.5];
  return { page, captureArguments: [`--window-size=${width},${height}`, `--force-device-scale-factor=${imageScale}`, `--screenshot=${output}`] };
}

// Captures the poster as a PNG, the A4 tutorial sheet as a PDF, or the sheet as an editable SVG,
// with a headless Chrome loading the pages from this server. Its profile starts empty, so the
// request carries the editors' saved overrides, which the pages write into its storage.
export async function POST(request: Request) {
  if (!developmentOnly()) return failure("Posters can only be exported during development.", 404);
  const chrome = chromeCandidates.find((path) => existsSync(path));
  if (!chrome) return failure("No Chrome found. Set CHROME_PATH to a Chrome or Chromium executable.", 500);

  const requestUrl = new URL(request.url);
  const kind = requestUrl.searchParams.get("kind");
  const seed = requestUrl.searchParams.get("seed")?.replace(/[^\w-]/g, "") || "fishbowl";
  const pose = requestUrl.searchParams.get("pose");
  const landscape = requestUrl.searchParams.get("format") === "landscape";
  if (kind !== "image" && kind !== "tutorial" && kind !== "svg") return failure("Unknown export kind.", 400);

  const overrides = parseModelOverrides(await request.json().catch(() => null));
  const directory = await mkdtemp(join(tmpdir(), exportDirectoryPrefix));
  const output = join(directory, kind === "tutorial" ? "tutorial.pdf" : "poster.png");
  const hasOverrides = Object.keys(overrides).length > 0;
  const { page, captureArguments } = exportPlan(kind, requestUrl.origin, seed, pose, landscape, output, hasOverrides ? exportToken(directory) : null);

  try {
    if (hasOverrides) await writeFile(join(directory, overridesFileName), JSON.stringify(overrides));
    await run(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--enable-webgl",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--hide-scrollbars",
      "--ignore-certificate-errors",
      `--user-data-dir=${join(directory, "profile")}`,
      `--virtual-time-budget=${renderBudgetMs}`,
      ...captureArguments,
      page.href,
    ], { timeout: 180000 });
    const file = await readFile(output);
    const download = (body: BodyInit, type: string, name: string) => new Response(body, {
      headers: { ...responseHeaders, "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"` },
    });
    if (kind === "svg") {
      const svg = tutorialSheetSvg({
        posterPng: file,
        qrSvg: await readFile(join(process.cwd(), "public/images/exhibition-qr.svg"), "utf8"),
        exampleArtifact: artifactById.get(tutorialExampleArtifactId)!,
      });
      return download(svg, "image/svg+xml", `fishbowl-leaks-tutorial-${seed}.svg`);
    }
    if (kind === "image") return download(file, "image/png", `fishbowl-leaks-poster-${seed}${landscape ? "-landscape" : ""}.png`);
    return download(file, "application/pdf", `fishbowl-leaks-tutorial-${seed}.pdf`);
  } catch (error) {
    return failure(`Chrome could not capture the page: ${error instanceof Error ? error.message : error}`, 500);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
