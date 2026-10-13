type GeneratedNarrativeProps = {
  lines: string[];
};

export function GeneratedNarrative({ lines }: GeneratedNarrativeProps) {
  return (
    <div className="font-display text-[clamp(1.4rem,6vw,2rem)] leading-[1.28] tracking-[-0.02em] text-[#F3F0E8]">
      {lines.map((line, index) => (
        <p
          key={`${index}-${line}`}
          className="mb-3 whitespace-pre-line"
        >
          {line}
        </p>
      ))}
    </div>
  );
}
