"use client";

import { useId } from "react";
import { feedbackQuestions, feedbackScale } from "@/lib/evaluation/artworkFeedback";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { feedbackRated } from "@/store/journeySlice";

export function ArtworkFeedback({ artifactId }: { artifactId: string }) {
  const dispatch = useAppDispatch();
  const id = useId();
  const feedback = useAppSelector((state) =>
    state.journey.discoveries.find((discovery) => discovery.artifactId === artifactId)?.feedback,
  );

  return (
    <section className="mt-6 border-t border-white/25 pt-5" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="font-display text-2xl">How was this piece for you?</h3>
      <p className="mt-2 text-base leading-6">Rate the artwork you just encountered. You can skip any question.</p>
      <div className="mt-5 space-y-5">
        {feedbackQuestions.map(({ dimension, label, question }) => (
          <fieldset key={dimension} aria-describedby={`${id}-${dimension}-scale`}>
            <legend className="text-base leading-6">
              <span className="block font-bold">{label}</span>
              {question}
            </legend>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {feedbackScale.map(({ value, label: scaleLabel }) => (
                <label key={value} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name={`${id}-${dimension}`}
                    value={value}
                    checked={feedback?.[dimension] === value}
                    onChange={() => dispatch(feedbackRated({ artifactId, dimension, rating: value }))}
                    className="peer sr-only"
                    aria-label={`${value} — ${scaleLabel}`}
                  />
                  <span className="flex min-h-11 items-center justify-center border border-white/40 text-base transition-colors peer-checked:border-[var(--phosphor)] peer-checked:bg-[var(--phosphor)] peer-checked:text-[var(--abyss)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--phosphor)]">
                    {value}
                  </span>
                </label>
              ))}
            </div>
            <p id={`${id}-${dimension}-scale`} className="mt-2 flex justify-between gap-4 text-sm">
              <span>1 · Not at all</span><span>5 · Very much</span>
            </p>
            <label className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${id}-${dimension}`}
                checked={feedback?.[dimension] === null}
                onChange={() => dispatch(feedbackRated({ artifactId, dimension, rating: null }))}
                className="h-4 w-4 accent-[var(--phosphor)]"
              />
              Not applicable
            </label>
          </fieldset>
        ))}
      </div>
      <p className="mt-3 text-base leading-6">
        Your ratings are saved on this device and included when you release your creature into the shared tank.
      </p>
    </section>
  );
}
