import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  applyModelEditChanges,
  formatModelEdits,
  MODEL_EDITS_FILE,
  modelEditStores,
  parseModelEditChanges,
  type ModelEdits,
} from "@/lib/creature/modelEdits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = { "Cache-Control": "no-store" };

function developmentOnly() {
  return process.env.NODE_ENV !== "production";
}

// Saves the creature editor's changes into src/data/modelEdits.json, merged with the ones already
// there, so they are committed with the code rather than kept in one browser.
export async function POST(request: Request) {
  if (!developmentOnly()) {
    return Response.json(
      { error: "Model edits can only be saved during development." },
      { status: 404, headers: responseHeaders },
    );
  }

  const parsed = parseModelEditChanges(await request.json().catch(() => null));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400, headers: responseHeaders });

  // Read from disk rather than the imported module, which may predate the last save.
  const path = join(process.cwd(), MODEL_EDITS_FILE);
  const saved = JSON.parse(await readFile(path, "utf8")) as Partial<ModelEdits>;
  const edits = Object.fromEntries(modelEditStores.map((store) => [store, saved[store] ?? {}])) as ModelEdits;
  await writeFile(path, formatModelEdits(applyModelEditChanges(edits, parsed.changes)));
  return Response.json({ saved: true }, { headers: responseHeaders });
}
