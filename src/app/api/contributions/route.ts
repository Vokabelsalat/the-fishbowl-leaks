import { randomUUID } from "node:crypto";
import { artifacts, artifactById } from "@/data/artifacts";
import {
  createContribution,
  getCollectiveHeatmap,
  getContributionCount,
  getCycleDate,
  getSyntheticContributionCount,
  listContributions,
} from "@/lib/contributions/database";
import { generateJourneyNarrative } from "@/lib/narrative/generateJourneyNarrative";
import { calculateDwellTimes } from "@/lib/contributions/dwellTime";
import { isAquaticForm, pickAquaticForm } from "@/lib/creature/aquaticForms";
import { creatureColorPalette, isCreatureColorPalette } from "@/lib/creature/colorPalettes";
import { creaturePattern, isCreaturePattern } from "@/lib/creature/patterns";
import { creatureProportions, isCreatureProportions } from "@/lib/creature/proportions";
import type { ContributionSubmission, SharedCreaturePart } from "@/types/contribution";
import { isArtworkFeedback } from "@/lib/evaluation/artworkFeedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
};

// Returns the parsed submission, or a reason why it was rejected.
function parseSubmission(value: unknown): ContributionSubmission | string {
  if (!value || typeof value !== "object") return "The body is not an object.";
  const candidate = value as Partial<ContributionSubmission>;
  if (
    typeof candidate.sessionId !== "string" ||
    candidate.sessionId.length < 6 ||
    candidate.sessionId.length > 120 ||
    typeof candidate.completedAt !== "number" ||
    !Number.isFinite(candidate.completedAt) ||
    !Array.isArray(candidate.discoveries) ||
    candidate.discoveries.length === 0 ||
    candidate.discoveries.length > artifacts.length
  ) {
    return "The session ID, completion time or discovery list is missing or malformed.";
  }

  const seen = new Set<string>();
  const discoveries = candidate.discoveries
    .map((item) => ({
      artifactId: typeof item?.artifactId === "string" ? item.artifactId : "",
      sequence: Number(item?.sequence),
      discoveredAt: Number(item?.discoveredAt),
      choiceId: typeof item?.choiceId === "string" ? item.choiceId : undefined,
      feedback: item?.feedback,
    }))
    .sort((a, b) => a.sequence - b.sequence);

  for (const [index, item] of discoveries.entries()) {
    const artifact = artifactById.get(item.artifactId);
    if (!artifact) return `Unknown artifact "${item.artifactId}".`;
    if (item.feedback !== undefined && !isArtworkFeedback(item.feedback)) {
      return `Artifact "${item.artifactId}" has invalid ratings. Use integers from 1 to 5, or null for not applicable.`;
    }
    if (seen.has(item.artifactId)) return `Artifact "${item.artifactId}" appears twice.`;
    if (item.sequence !== index + 1) {
      return `Discovery sequence ${item.sequence} should be ${index + 1}.`;
    }
    if (!Number.isFinite(item.discoveredAt) || item.discoveredAt <= 0) {
      return `Artifact "${item.artifactId}" has no valid discovery time.`;
    }
    if (
      item.choiceId !== undefined &&
      !artifact.choice.options.some((option) => option.id === item.choiceId)
    ) {
      return `Choice "${item.choiceId}" does not exist for artifact "${item.artifactId}".`;
    }
    if (index > 0 && item.discoveredAt < discoveries[index - 1].discoveredAt) {
      return `Artifact "${item.artifactId}" was discovered before the previous one.`;
    }
    seen.add(item.artifactId);
  }

  const firstDiscoveredAt = discoveries[0]?.discoveredAt ?? 0;
  const lastDiscoveredAt = discoveries.at(-1)?.discoveredAt ?? 0;
  if (candidate.completedAt < lastDiscoveredAt) {
    return "The journey was completed before its last discovery.";
  }
  if (candidate.completedAt - firstDiscoveredAt > 24 * 60 * 60_000) {
    return "The journey took longer than 24 hours from the first scan to completion.";
  }

  const creatureForm = isAquaticForm(candidate.creatureForm)
    ? candidate.creatureForm
    : pickAquaticForm(`${candidate.sessionId}:${discoveries[0]?.artifactId ?? "unknown"}:${firstDiscoveredAt}`);
  const creaturePalette = isCreatureColorPalette(candidate.creaturePalette)
    ? candidate.creaturePalette
    : creatureColorPalette(candidate.sessionId);
  const pattern = isCreaturePattern(candidate.creaturePattern)
    ? candidate.creaturePattern
    : creaturePattern(candidate.sessionId);
  const proportions = isCreatureProportions(candidate.creatureProportions)
    ? candidate.creatureProportions
    : creatureProportions(candidate.sessionId);

  return {
    sessionId: candidate.sessionId,
    creatureForm,
    creaturePalette,
    creaturePattern: pattern,
    creatureProportions: proportions,
    completedAt: candidate.completedAt,
    discoveries,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const after = Math.max(0, Number.parseInt(url.searchParams.get("after") ?? "0", 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "80", 10) || 80));
  return Response.json(
    {
      contributions: listContributions(after, limit),
      heatmap: getCollectiveHeatmap(),
      cycleDate: getCycleDate(),
      syntheticCount: getSyntheticContributionCount(),
      contributionCount: getContributionCount(),
    },
    { headers: responseHeaders },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submission = parseSubmission(body);
  if (typeof submission === "string") {
    console.warn(`Rejected contribution: ${submission}`);
    return Response.json(
      { error: `The shared journey is incomplete or invalid. ${submission}` },
      { status: 422 },
    );
  }

  const dwellTimes = calculateDwellTimes(
    submission.discoveries,
    submission.completedAt,
  );
  const parts: SharedCreaturePart[] = submission.discoveries.map((discovery, index) => {
    const artifact = artifactById.get(discovery.artifactId)!;
    return {
      artifactId: artifact.id,
      partId: artifact.creaturePart.id,
      label: artifact.creaturePart.label,
      sequence: discovery.sequence,
      theme: artifact.theme,
      color: artifact.color,
      dwellMs: dwellTimes[index],
      ...(discovery.feedback !== undefined ? { feedback: discovery.feedback } : {}),
    };
  });
  const narrative = generateJourneyNarrative(submission.discoveries, artifacts);
  const contribution = createContribution({
    publicId: randomUUID(),
    sessionId: submission.sessionId,
    creatureForm: submission.creatureForm,
    creaturePalette: submission.creaturePalette,
    creaturePattern: submission.creaturePattern,
    creatureProportions: submission.creatureProportions,
    parts,
    narrative,
  });

  return Response.json({ contribution }, { status: 201, headers: responseHeaders });
}
