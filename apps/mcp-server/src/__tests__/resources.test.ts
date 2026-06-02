import { describe, expect, it } from "vitest";
import { loadProjectBaselinesFromSqlite, loadProjectDataFromSqlite } from "@doorframe/storage";
import {
  readBaselineDiffResource,
  readProjectFindingsResource,
  readProjectSummaryResource,
  readReviewPrepResource,
  readRequirementsReviewBriefResource,
  readStaleTracesResource,
  readTestReadinessReviewBriefResource,
  readTraceabilityMatrixResource
} from "../resources";
import { createDemoProjectDb } from "./fixtures";

function projectDb() {
  const dbPath = createDemoProjectDb();
  return {
    loadProjectData: () => loadProjectDataFromSqlite(dbPath),
    listBaselines: () => loadProjectBaselinesFromSqlite(dbPath)
  };
}

function jsonFromResource(result: ReturnType<typeof readProjectSummaryResource>) {
  const content = result.contents[0];
  if (!("text" in content) || !content.text) {
    throw new Error("expected text resource");
  }

  return JSON.parse(content.text) as Record<string, unknown>;
}

describe("Doorframe MCP resources", () => {
  it("returns project summary resource content", () => {
    const resource = readProjectSummaryResource(projectDb());
    const json = jsonFromResource(resource);

    expect(resource.contents[0].uri).toBe("doorframe://project/summary");
    expect(json.counts).toMatchObject({ requirements: 3, findings: 4 });
    expect(json.readableText).toContain("Doorframe project summary");
  });

  it("caps findings resource content", () => {
    const resource = readProjectFindingsResource(projectDb());
    const json = jsonFromResource(resource);

    expect(resource.contents[0].uri).toBe("doorframe://project/findings");
    expect(json.limit).toMatchObject({ returned: 4, total: 4, capped: false });
  });

  it("returns compact traceability matrix rows", () => {
    const resource = readTraceabilityMatrixResource(projectDb());
    const json = jsonFromResource(resource);

    expect(resource.contents[0].uri).toBe("doorframe://project/traceability-matrix");
    expect(json.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: "REQ-003",
          linkedWorkCount: 1,
          linkedTestCount: 1,
          testStatusSummary: { passed: 0, failed: 1, skipped: 0 }
        })
      ])
    );
  });

  it("returns review prep resource content", () => {
    const resource = readReviewPrepResource(projectDb());
    const json = jsonFromResource(resource);

    expect(resource.contents[0].uri).toBe("doorframe://project/review-prep");
    expect(json.weakWordingCount).toBe(1);
    expect(json.suggestedMeetingDiscussionTopics).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it("returns baseline diff resource content", () => {
    const resource = readBaselineDiffResource(projectDb());
    const json = jsonFromResource(resource);

    expect(resource.contents[0].uri).toBe("doorframe://project/baseline-diff");
    expect(json.summary).toMatchObject({ added: 1, deleted: 1, changed: 1, highConcern: 1 });
  });

  it("returns stale traces resource content", () => {
    const resource = readStaleTracesResource(projectDb());
    const json = jsonFromResource(resource);

    expect(resource.contents[0].uri).toBe("doorframe://project/stale-traces");
    expect(json.limit).toMatchObject({ returned: expect.any(Number), total: expect.any(Number) });
  });

  it("returns review brief resources", () => {
    const testReadiness = jsonFromResource(readTestReadinessReviewBriefResource(projectDb()));
    const requirementsReview = jsonFromResource(readRequirementsReviewBriefResource(projectDb()));

    expect(testReadiness.reviewType).toBe("test_readiness_review");
    expect(requirementsReview.reviewType).toBe("requirements_review");
    expect(testReadiness.briefBoundary).toContain("not an AI-generated final answer");
  });
});
