import { Fragment } from "react";
import { parseNarrativeLine } from "@/lib/narrative/narrativeMarkup";

/** A story line with the words the leaking tank replaced shown crossed out, followed by their replacements. */
export function NarrativeLine({ line }: { line: string }) {
  return parseNarrativeLine(line).map((segment, index) =>
    "text" in segment ? (
      <Fragment key={index}>{segment.text}</Fragment>
    ) : (
      <Fragment key={index}>
        <s>{segment.replaced}</s> <span className="text-[var(--phosphor)]">{segment.by}</span>
      </Fragment>
    ),
  );
}

/** Several story lines run together into one paragraph. */
export function NarrativeLines({ lines }: { lines: string[] }) {
  return lines.map((line, index) => (
    <Fragment key={`${index}-${line}`}>
      {index > 0 && " "}
      <NarrativeLine line={line} />
    </Fragment>
  ));
}
