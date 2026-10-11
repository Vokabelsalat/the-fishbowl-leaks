export const feedbackQuestions = [
  {
    dimension: "narrative",
    label: "Narrative",
    question: "How much did this piece draw you into its story or ideas?",
  },
  {
    dimension: "ludicEntertainment",
    label: "Play and exploration",
    question: "How much did this piece make you want to play or explore?",
  },
  {
    dimension: "interaction",
    label: "Interaction",
    question: "How much did your actions feel like they shaped your experience of this piece?",
  },
] as const;

export type FeedbackDimension = (typeof feedbackQuestions)[number]["dimension"];
export type FeedbackRating = 1 | 2 | 3 | 4 | 5;
// Missing = unanswered; null = explicitly not applicable. Neither is a numeric score.
export type ArtworkFeedback = Partial<Record<FeedbackDimension, FeedbackRating | null>>;

export const feedbackScale = [
  { value: 1, label: "Not at all" },
  { value: 2, label: "A little" },
  { value: 3, label: "Moderately" },
  { value: 4, label: "Quite a bit" },
  { value: 5, label: "Very much" },
] as const;

export function isArtworkFeedback(value: unknown): value is ArtworkFeedback {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([dimension, rating]) =>
    feedbackQuestions.some((question) => question.dimension === dimension) &&
    (rating === null || (typeof rating === "number" && Number.isInteger(rating) && rating >= 1 && rating <= 5)),
  );
}
