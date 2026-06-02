import { describe, expect, it } from "vitest";
import { loadProjectBaselinesFromSqlite, loadProjectDataFromSqlite } from "@doorframe/storage";
import {
  findOrphanItemsData,
  getBaselineDiffSummaryData,
  getRequirementChangeDetailData,
  getProjectSummaryData,
  getRequirementDetailData,
  getReviewRiskSummaryData,
  getReviewBriefData,
  getStaleTraceCandidatesData,
  getTraceLinksForRequirementData,
  getTraceabilityGapsData,
  listChangedRequirementsData,
  listFindingsData,
  searchRequirementsData
} from "../tools";
import { createDemoProjectDb } from "./fixtures";

function projectDb() {
  const dbPath = createDemoProjectDb();
  return {
    loadProjectData: () => loadProjectDataFromSqlite(dbPath),
    listBaselines: () => loadProjectBaselinesFromSqlite(dbPath)
  };
}

describe("Doorframe MCP tool data adapters", () => {
  it("summarizes project counts and risk concerns", () => {
    const summary = getProjectSummaryData(projectDb());

    expect(summary.project.name).toBe("Demo Doorframe Project");
    expect(summary.counts.requirements).toBe(3);
    expect(summary.counts.workItems).toBe(3);
    expect(summary.counts.testCases).toBe(3);
    expect(summary.counts.traceLinks).toBe(4);
    expect(summary.counts.findings).toBe(4);
    expect(summary.findingsBySeverity.high).toBe(2);
    expect(summary.findingsBySeverity.medium).toBe(2);
    expect(summary.concerns.requirementsWithoutTests).toBe(1);
    expect(summary.concerns.closedWorkWithoutVerification).toBe(1);
  });

  it("searches requirements with filters and caps results", () => {
    const result = searchRequirementsData(projectDb(), {
      missingTests: true,
      weakLanguage: true,
      limit: 5
    });

    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].externalId).toBe("REQ-002");
    expect(result.requirements[0].textExcerpt).toContain("appropriate logging");
  });

  it("hides raw requirement text in summary mode", () => {
    const result = searchRequirementsData(
      projectDb(),
      {
        query: "logging",
        limit: 5
      },
      { mode: "summary" }
    );

    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].textExcerpt).toBeUndefined();
    expect(result.requirements[0].rawTextHidden).toBe(true);
  });

  it("returns requirement details without raw imports", () => {
    const detail = getRequirementDetailData(projectDb(), "REQ-001");

    expect(detail.found).toBe(true);
    if (!detail.found) {
      throw new Error("expected requirement detail");
    }

    expect(detail.requirement.externalId).toBe("REQ-001");
    expect(detail.linkedWorkItems.map((item) => item.externalId)).toEqual(["DOOR-1"]);
    expect(detail.linkedTestCases.map((item) => item.externalId)).toEqual(["TC-001"]);
    expect(detail.traceSummary.passingTests).toBe(1);
  });

  it("returns a clear not-found result for unknown requirement IDs", () => {
    const detail = getRequirementDetailData(projectDb(), "REQ-999");

    expect(detail.found).toBe(false);
    if (detail.found) {
      throw new Error("expected not-found result");
    }
    expect(detail.message).toContain("search_requirements");
  });

  it("lists findings with public severity filters", () => {
    const result = listFindingsData(projectDb(), { severity: "high", limit: 10 });

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.category).sort()).toEqual([
      "closed_work_without_verification",
      "missing_verification"
    ]);
  });

  it("returns traceability gaps by type", () => {
    const result = getTraceabilityGapsData(projectDb(), {
      gapType: "failed_tests",
      limit: 10
    });

    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].requirement.externalId).toBe("REQ-003");
    expect(result.gaps[0].severity).toBe("high");
  });

  it("summarizes review risk from findings and traceability data", () => {
    const result = getReviewRiskSummaryData(projectDb(), {
      reviewType: "test_readiness_review",
      limit: 5
    });

    expect(result.topRisks.length).toBeGreaterThan(0);
    expect(result.summary).toContain("Doorframe findings and traceability data");
    expect(result.suggestedDiscussionPoints.some((point) => point.includes("verification"))).toBe(true);
  });

  it("returns trace links for one requirement", () => {
    const result = getTraceLinksForRequirementData(projectDb(), "REQ-003");

    expect(result.found).toBe(true);
    if (!result.found) {
      throw new Error("expected trace links");
    }

    expect(result.traceLinks.map((link) => link.linkType).sort()).toEqual(["implements", "verifies"]);
  });

  it("finds orphan entities without mutating project data", () => {
    const result = findOrphanItemsData(projectDb(), {
      entityType: "all",
      limit: 10
    });

    expect(result.items.map((item) => `${item.entityType}:${item.externalId}`).sort()).toEqual([
      "requirement:REQ-002",
      "testCase:TC-003",
      "workItem:DOOR-3"
    ]);
  });

  it("returns baseline diff summary", () => {
    const result = getBaselineDiffSummaryData(projectDb());

    expect(result.baselineA.id).toBe("baseline_old");
    expect(result.baselineB.id).toBe("baseline_new");
    expect(result.summary.added).toBe(1);
    expect(result.summary.deleted).toBe(1);
    expect(result.summary.changed).toBe(1);
    expect(result.summary.highConcern).toBe(1);
  });

  it("lists changed requirements with concern filters", () => {
    const result = listChangedRequirementsData(projectDb(), {
      changeType: "changed",
      concernLevel: "high",
      limit: 10
    });

    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0]).toMatchObject({
      changeType: "changed",
      externalId: "REQ-001",
      concern: "high"
    });
  });

  it("returns requirement change detail with stale trace indicators", () => {
    const result = getRequirementChangeDetailData(projectDb(), { requirementId: "REQ-001" });

    expect(result.found).toBe(true);
    if (!result.found) {
      throw new Error("expected change detail");
    }

    expect(result.changedFields.map((change) => (change as { field: string }).field)).toContain("text");
    expect(result.staleTraceIndicators).toEqual(expect.arrayContaining(["numeric-threshold-change"]));
    expect(result.traceSummary.linkedWorkItems).toHaveLength(1);
  });

  it("finds stale trace candidates from baseline changes", () => {
    const result = getStaleTraceCandidatesData(projectDb(), { limit: 10 });

    expect(result.candidates.map((candidate) => candidate.requirement.externalId)).toEqual(
      expect.arrayContaining(["REQ-001", "REQ-004"])
    );
    expect(result.grouped.byConcern.high).toBeGreaterThanOrEqual(1);
  });

  it("returns structured review brief facts", () => {
    const result = getReviewBriefData(projectDb(), {
      reviewType: "test_readiness_review",
      limit: 5
    });

    expect(result.briefBoundary).toContain("not an AI-generated final answer");
    expect(result.changedRequirements.length).toBeGreaterThan(0);
    expect(result.staleTraceCandidates.length).toBeGreaterThan(0);
  });
});
