"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  connectionQuestion,
  contributionQuestions,
  feedbackScale,
  feelingGroups,
  MAX_FEELINGS,
  type ArtworkFeedback as Feedback,
  type FeedbackDimension,
  type FeedbackRating,
} from "@/lib/evaluation/artworkFeedback";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { feedbackRated, feelingToggled } from "@/store/journeySlice";

const STEP_COUNT = 3;
const DONE = STEP_COUNT;
// Long enough to see the chosen value before step 1 moves on by itself.
const AUTO_ADVANCE_MS = 350;

function firstOpenStep(feedback: Feedback | undefined) {
  if (feedback?.connection === undefined) return 0;
  if (contributionQuestions.some(({ dimension }) => feedback[dimension] === undefined)) return 1;
  if (!feedback.feelings?.length) return 2;
  return DONE;
}

const choiceClass =
  "flex min-h-11 items-center justify-center border border-white/40 text-base transition-colors peer-checked:border-[var(--phosphor)] peer-checked:bg-[var(--phosphor)] peer-checked:text-[var(--abyss)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--phosphor)]";

function RatingRow({
  name,
  value,
  onRate,
}: {
  name: string;
  value: FeedbackRating | undefined;
  onRate: (rating: FeedbackRating) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {feedbackScale.map(({ value: rating, label }) => (
        <label key={rating} className="relative cursor-pointer">
          <input
            type="radio"
            name={name}
            value={rating}
            checked={value === rating}
            onChange={() => onRate(rating)}
            className="peer sr-only"
            aria-label={`${rating} — ${label}`}
          />
          <span className={choiceClass}>{rating}</span>
        </label>
      ))}
    </div>
  );
}

export function ArtworkFeedback({ artifactId }: { artifactId: string }) {
  const dispatch = useAppDispatch();
  const id = useId();
  const feedback = useAppSelector((state) =>
    state.journey.discoveries.find((discovery) => discovery.artifactId === artifactId)?.feedback,
  );
  const [step, setStep] = useState(() => firstOpenStep(feedback));
  const stepRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigated = useRef(false);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  // Move focus to each new step after the visitor moves on, but not on first render.
  useEffect(() => {
    if (navigated.current) stepRef.current?.focus({ preventScroll: true });
  }, [step]);

  function goTo(next: number) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    navigated.current = true;
    setStep(next);
  }

  function rate(dimension: FeedbackDimension, rating: FeedbackRating) {
    dispatch(feedbackRated({ artifactId, dimension, rating }));
  }

  const scaleId = `${id}-scale`;
  const feelings = feedback?.feelings ?? [];
  const stepAnswered =
    step === 0
      ? feedback?.connection !== undefined
      : step === 1
        ? contributionQuestions.some(({ dimension }) => feedback?.[dimension] !== undefined)
        : feelings.length > 0;

  return (
    <section className="mt-6 border-t border-white/25 pt-5" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="font-display text-2xl">How was this piece for you?</h3>

      {step === DONE ? (
        <div ref={stepRef} tabIndex={-1} className="mt-2 outline-none">
          <p className="text-base leading-6">Thank you for your answers.</p>
          <button
            type="button"
            onClick={() => goTo(0)}
            className="mt-3 inline-flex min-h-11 items-center border border-white/30 px-4 text-sm transition-colors hover:border-white/65"
          >
            Change my answers
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-base leading-6">
            Step {step + 1} of {STEP_COUNT}. Answer quickly, without thinking too long. You can skip any step.
          </p>

          <div ref={stepRef} tabIndex={-1} className="mt-5 outline-none">
            {step === 0 && (
              <fieldset aria-describedby={scaleId}>
                <legend className="text-base font-bold leading-6">{connectionQuestion.statement}</legend>
                <RatingRow
                  name={`${id}-connection`}
                  value={feedback?.connection}
                  onRate={(rating) => {
                    rate("connection", rating);
                    if (advanceTimer.current) clearTimeout(advanceTimer.current);
                    advanceTimer.current = setTimeout(() => goTo(1), AUTO_ADVANCE_MS);
                  }}
                />
              </fieldset>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <p className="text-base font-bold leading-6">What contributed to your experience?</p>
                {contributionQuestions.map(({ dimension, label, statement }) => (
                  <fieldset key={dimension} aria-describedby={scaleId}>
                    <legend className="text-base leading-6">
                      <span className="block font-bold">{label}</span>
                      {statement}
                    </legend>
                    <RatingRow
                      name={`${id}-${dimension}`}
                      value={feedback?.[dimension]}
                      onRate={(rating) => rate(dimension, rating)}
                    />
                  </fieldset>
                ))}
              </div>
            )}

            {step !== 2 && (
              <p id={scaleId} className="mt-2 flex justify-between gap-4 text-sm">
                <span>1 · Strongly disagree</span><span>5 · Strongly agree</span>
              </p>
            )}

            {step === 2 && (
              <fieldset>
                <legend className="text-base leading-6">
                  <span className="block font-bold">How did it make you feel?</span>
                  Tap up to three words. {feelings.length} of {MAX_FEELINGS} chosen.
                </legend>
                <div className="mt-4">
                  {feelingGroups.map(({ tone, label, words }, groupIndex) => (
                    <div
                      key={tone}
                      role="group"
                      aria-labelledby={`${id}-tone-${groupIndex}`}
                      className={groupIndex > 0 ? "mt-4 border-t border-white/15 pt-4" : ""}
                    >
                      <p id={`${id}-tone-${groupIndex}`} className="text-base font-bold leading-6">{label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {words.map((word, wordIndex) => {
                          const selected = feelings.includes(word);
                          const full = !selected && feelings.length >= MAX_FEELINGS;
                          return (
                            <button
                              key={word}
                              type="button"
                              aria-pressed={selected}
                              disabled={full}
                              onClick={() => dispatch(feelingToggled({ artifactId, feeling: word }))}
                              style={{ animationDelay: `${(groupIndex * 4 + wordIndex) * 45}ms` }}
                              className={`feeling-word min-h-11 border px-3 text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--phosphor)] disabled:cursor-not-allowed disabled:opacity-40 ${
                                selected
                                  ? "border-[var(--phosphor)] bg-[var(--phosphor)] text-[var(--abyss)]"
                                  : "border-white/40 hover:border-white/70"
                              }`}
                            >
                              {word}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                className="inline-flex min-h-11 items-center gap-2 border border-white/30 px-4 text-sm transition-colors hover:border-white/65"
              >
                <span aria-hidden="true">←</span> Back
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              className="inline-flex min-h-11 items-center gap-2 border border-white/30 px-4 text-sm transition-colors hover:border-white/65"
            >
              {step === STEP_COUNT - 1 ? (stepAnswered ? "Done" : "Skip") : stepAnswered ? "Next" : "Skip"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
      <p className="mt-3 text-base leading-6">
        Your answers are saved on this device and included when you release your creature into the shared tank.
      </p>
    </section>
  );
}
