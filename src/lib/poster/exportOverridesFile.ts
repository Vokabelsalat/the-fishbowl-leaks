import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseModelOverrides, type ExportedModelOverrides } from "@/lib/poster/exportOverrides";

/** Each export works in its own temporary directory, which also holds the overrides its pages load. */
export const exportDirectoryPrefix = "poster-export-";
export const overridesFileName = "model-overrides.json";

/** The part of an export directory's name that the captured pages receive as their `overrides` parameter. */
export function exportToken(directory: string) {
  return directory.slice(directory.lastIndexOf(exportDirectoryPrefix) + exportDirectoryPrefix.length);
}

/** The overrides an export stored for its pages, or none when the token names no export. */
export async function readExportedOverrides(token: string | undefined): Promise<ExportedModelOverrides> {
  if (process.env.NODE_ENV === "production" || !token || !/^[A-Za-z0-9]{6}$/.test(token)) return {};
  try {
    return parseModelOverrides(JSON.parse(await readFile(join(tmpdir(), `${exportDirectoryPrefix}${token}`, overridesFileName), "utf8")));
  } catch {
    return {};
  }
}
