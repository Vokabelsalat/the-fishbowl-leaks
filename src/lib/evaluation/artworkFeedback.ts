// No longer asked in the form (see ArtworkFeedback.tsx), but answers already given stay valid.
export const connectionQuestion = {
  dimension: "connection",
  statement: "I felt connected to this experience.",
} as const;

// Step 1: what contributed. Keys are the analytical poles; labels are what visitors see.
export const contributionQuestions = [
  {
    dimension: "ludic",
    label: "Interaction",
    statement: "Being able to act, choose or explore contributed to my experience.",
  },
  {
    dimension: "spectacle",
    label: "Sensory / Visual",
    statement: "The visual, spatial or sensory qualities drew me into the experience.",
  },
  {
    dimension: "narrative",
    label: "Story",
    statement: "The story or ideas were central to my engagement with the work.",
  },
] as const;

// Step 2: up to three words, grouped by tone. Order is the display order.
export const feelingGroups = [
  {
    tone: "positive",
    label: "Positive",
    words: ["Empowered", "Engaged", "Moved", "Curious", "Inspired", "Absorbed", "Delighted", "Amused", "Calm"],
  },
  {
    tone: "in between",
    label: "In between",
    words: ["Reflective", "Ambivalent", "Nostalgic", "Strange", "Provoked"],
  },
  {
    tone: "negative",
    label: "Negative",
    words: ["Unsettled", "Confused", "Bored", "Distanced", "Uneasy", "Frustrated", "Overwhelmed", "Uncomfortable", "Sad"],
  },
] as const;

export const MAX_FEELINGS = 3;

export type FeedbackDimension =
  | typeof connectionQuestion.dimension
  | (typeof contributionQuestions)[number]["dimension"];
export type FeedbackRating = 1 | 2 | 3 | 4 | 5;
export type FeelingWord = (typeof feelingGroups)[number]["words"][number];
// Missing keys mean the visitor skipped that question.
export type ArtworkFeedback = Partial<Record<FeedbackDimension, FeedbackRating>> & {
  feelings?: FeelingWord[];
};

export const feedbackScale = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neither agree nor disagree" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
] as const;

const ratingDimensions = new Set<string>([
  connectionQuestion.dimension,
  ...contributionQuestions.map((question) => question.dimension),
]);
const feelingWords = new Set<string>(feelingGroups.flatMap((group) => group.words));

export function isFeedbackRating(value: unknown): value is FeedbackRating {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isFeelingWord(value: unknown): value is FeelingWord {
  return typeof value === "string" && feelingWords.has(value);
}

function isFeelingList(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= MAX_FEELINGS &&
    value.every(isFeelingWord) &&
    new Set(value).size === value.length
  );
}

export function isArtworkFeedback(value: unknown): value is ArtworkFeedback {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, answer]) =>
    key === "feelings" ? isFeelingList(answer) : ratingDimensions.has(key) && isFeedbackRating(answer),
  );
}
