import { beforeEach, describe, expect, it, vi } from "vitest";
import { artifacts } from "@/data/artifacts";

vi.mock("@/lib/contributions/database", () => ({
  createContribution: vi.fn((input) => ({ id: 1, ...input })),
  getCollectiveHeatmap: vi.fn(() => []),
  getContributionCount: vi.fn(() => 0),
  getSyntheticContributionCount: vi.fn(() => 0),
  listContributions: vi.fn(() => []),
}));

import { POST } from "@/app/api/contributions/route";
import { createContribution } from "@/lib/contributions/database";

function request(feedback?: unknown) {
  return new Request("http://localhost/api/contributions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-feedback-test",
      completedAt: 2000,
      discoveries: [{ artifactId: artifacts[0].id, sequence: 1, discoveredAt: 1000, ...(feedback !== undefined ? { feedback } : {}) }],
    }),
  });
}

describe("contribution feedback submission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes artwork ratings to database storage along with their artifact ID", async () => {
    const feedback = { connection: 4, ludic: 2, narrative: 5, feelings: ["Curious", "Uneasy"] };
    const response = await POST(request(feedback));
    expect(response.status).toBe(201);
    expect(createContribution).toHaveBeenCalledWith(expect.objectContaining({
      parts: [expect.objectContaining({ artifactId: artifacts[0].id, feedback })],
    }));
    const body = await response.json();
    expect(body.contribution.parts[0].feedback).toEqual(feedback);
  });

  it("keeps older journeys without feedback valid", async () => {
    expect((await POST(request())).status).toBe(201);
    const input = vi.mocked(createContribution).mock.calls[0][0];
    expect(input.parts[0]).not.toHaveProperty("feedback");
  });

  it.each([{ narrative: 8 }, { ludic: 2.5 }, { narrative: "3" }, { narrative: null }, { other: 4 }, { feelings: ["Happy"] }, { feelings: ["Calm", "Sad", "Moved", "Bored"] }, [], null])(
    "rejects malformed feedback before storage: %j",
    async (feedback) => {
      expect((await POST(request(feedback))).status).toBe(422);
      expect(createContribution).not.toHaveBeenCalled();
    },
  );
});
