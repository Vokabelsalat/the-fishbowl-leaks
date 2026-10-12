/**
 * A narrative line can carry words the leaking tank replaced, written `[[old>>new]]`. They are shown
 * as the old word crossed out, followed by the new one.
 */

export type NarrativeSegment = { text: string } | { replaced: string; by: string };

const replacementPattern = /\[\[([^\]]+?)>>([^\]]+?)\]\]/g;

export function replacementMarkup(replaced: string, by: string) {
  return `[[${replaced}>>${by}]]`;
}

export function parseNarrativeLine(line: string): NarrativeSegment[] {
  const segments: NarrativeSegment[] = [];
  let last = 0;
  for (const match of line.matchAll(replacementPattern)) {
    if (match.index > last) segments.push({ text: line.slice(last, match.index) });
    segments.push({ replaced: match[1], by: match[2] });
    last = match.index + match[0].length;
  }
  if (last < line.length) segments.push({ text: line.slice(last) });
  return segments;
}

/** The line as it now reads, with only the replacing words. */
export function plainNarrativeLine(line: string) {
  return line.replace(replacementPattern, (_, __, by: string) => by);
}
