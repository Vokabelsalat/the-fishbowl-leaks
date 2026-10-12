import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { aquariumTracks } from "@/lib/audio/aquariumTracks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = promisify(execFile);
const responseHeaders = { "Cache-Control": "no-store" };
/** macOS's built-in audio converter, which encodes AAC. */
const afconvert = "/usr/bin/afconvert";
/** AAC bit rate of the recordings: transparent for these soft, slow tracks. */
const bitRate = 160_000;

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: responseHeaders });
}

// Receives one synthesized track as WAV from /soundtrack and saves it as AAC in public/audio.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return failure("The soundtrack can only be recorded during development.", 404);
  if (!existsSync(afconvert)) return failure("afconvert was not found; recording needs macOS.", 500);
  const index = Number(new URL(request.url).searchParams.get("index"));
  const track = aquariumTracks[index];
  if (!track) return failure("Unknown track.", 400);

  const directory = await mkdtemp(join(tmpdir(), "soundtrack-"));
  const wav = join(directory, "track.wav");
  const output = join(process.cwd(), "public", track.src);
  try {
    await writeFile(wav, Buffer.from(await request.arrayBuffer()));
    await run(afconvert, ["-f", "m4af", "-d", "aac", "-b", String(bitRate), wav, output]);
    const { size } = await stat(output);
    return Response.json({ file: track.src, size }, { headers: responseHeaders });
  } catch (error) {
    return failure(`The track could not be encoded: ${error instanceof Error ? error.message : error}`, 500);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
