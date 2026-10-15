import { NarrativeLines } from "@/components/collective/NarrativeLine";

type GeneratedNarrativeProps = {
  lines: string[];
};

/** The visitor's story as one paragraph, since its lines run on into each other. */
export function GeneratedNarrative({ lines }: GeneratedNarrativeProps) {
  return (
    <p className="font-display text-[clamp(1.4rem,6vw,2rem)] leading-[1.28] tracking-[-0.02em] text-[#F3F0E8]">
      <NarrativeLines lines={lines} />
    </p>
  );
}
