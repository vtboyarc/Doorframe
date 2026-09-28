import { describe, expect, it } from "vitest";
import type {
  Baseline,
  EntityType,
  Finding,
  FindingCategory,
  ProjectData,
  Requirement,
  TestCase,
  TestStatus,
  TraceLink,
  TraceLinkType,
  WorkItem
} from "@doorframe/core";
import {
  findOrphanItemsData,
  getProjectSummaryData,
  getRequirementDetailData,
  getReviewBriefData,
  getStaleTraceCandidatesData,
  getTraceabilityGapsData,
  listFindingsData
} from "../tools";

const now = "2026-01-01T00:00:00.000Z";

function requirement(id: string, externalId: string, text = "The gateway shall forward frames."): Requirement {
  return {
    id,
    projectId: "project_1",
    externalId,
    title: `Title ${externalId}`,
    text,
    source: "requirements-csv",
    status: "approved",
    createdAt: now,
    updatedAt: now
  };
}

function workItem(id: string, externalId: string, status = "open"): WorkItem {
  return {
    id,
    projectId: "project_1",
    externalId,
    title: `Work ${externalId}`,
    status,
    source: "jira-csv",
    createdAt: now,
    updatedAt: now
  };
}

function testCase(id: string, externalId: string, status: TestStatus = "passed"): TestCase {
  return {
    id,
    projectId: "project_1",
    externalId,
    name: `Test ${externalId}`,
    status,
    source: "junit-xml",
    createdAt: now,
    updatedAt: now
  };
}

function link(
  id: string,
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string,
  linkType: TraceLinkType = "implements"
): TraceLink {
  return {
    id,
    projectId: "project_1",
    sourceType,
    sourceId,
    targetType,
    targetId,
    linkType,
    confidence: 0.9,
    source: "manual",
    createdAt: now,
    updatedAt: now
  };
}

function finding(id: string, entityType: EntityType, entityId: string, category: FindingCategory = "weak_wording"): Finding {
  return {
    id,
    projectId: "project_1",
    severity: "warning",
    category,
    title: `Finding ${id}`,
    description: "Fictional finding.",
    entityType,
    entityId,
    createdAt: now,
    updatedAt: now
  };
}

function projectData(parts: Partial<ProjectData>): ProjectData {
  return {
    project: { id: "project_1", name: "Fictional Gateway", createdAt: now, updatedAt: now },
    requirements: [],
    workItems: [],
    testCases: [],
    traceLinks: [],
    findings: [],
    importBatches: [],
    ...parts
  };
}

function countingDb(data: ProjectData, baselines: Baseline[] = []) {
  const calls = { loadProjectData: 0, listBaselines: 0 };
  return {
    calls,
    loadProjectData: () => {
      calls.loadProjectData += 1;
      return data;
    },
    listBaselines: () => {
      calls.listBaselines += 1;
      return baselines;
    }
  };
}

describe("Doorframe MCP trace link lookups", () => {
  it("follows forward, reverse, self, and dangling links in project order", () => {
    const data = projectData({
      requirements: [requirement("req_1", "REQ-1")],
      workItems: [workItem("work_1", "W-1"), workItem("work_2", "W-2")],
      testCases: [testCase("test_1", "T-1")],
      traceLinks: [
        link("trace_reverse", "workItem", "work_2", "requirement", "req_1"),
        link("trace_forward", "requirement", "req_1", "workItem", "work_1"),
        link("trace_self", "requirement", "req_1", "requirement", "req_1", "parent"),
        link("trace_missing", "requirement", "req_1", "workItem", "work_missing"),
        link("trace_test", "testCase", "test_1", "requirement", "req_1", "verifies")
      ]
    });

    const detail = getRequirementDetailData(countingDb(data), "REQ-1");
    if (!detail.found) {
      throw new Error("expected requirement detail");
    }

    expect(detail.linkedWorkItems.map((item) => item.externalId)).toEqual(["W-2", "W-1"]);
    expect(detail.linkedTestCases.map((item) => item.externalId)).toEqual(["T-1"]);
    expect(detail.traceLinks.map((item) => item.id)).toEqual([
      "trace_reverse",
      "trace_forward",
      "trace_self",
      "trace_missing",
      "trace_test"
    ]);
  });

  it("keeps records apart when a requirement, work item, and test share an id", () => {
    const data = projectData({
      requirements: [requirement("shared", "REQ-1")],
      workItems: [workItem("shared", "W-1")],
      testCases: [testCase("shared", "T-1"), testCase("test_2", "T-2")],
      traceLinks: [link("trace_1", "requirement", "shared", "workItem", "shared")],
      findings: [
        finding("finding_requirement", "requirement", "shared"),
        finding("finding_work", "workItem", "shared"),
        finding("finding_test", "testCase", "shared")
      ]
    });
    const projectDb = countingDb(data);

    const detail = getRequirementDetailData(projectDb, "REQ-1");
    if (!detail.found) {
      throw new Error("expected requirement detail");
    }
    expect(detail.linkedWorkItems.map((item) => item.externalId)).toEqual(["W-1"]);
    expect(detail.linkedTestCases).toEqual([]);
    expect(detail.findings.map((item) => item.id)).toEqual(["finding_requirement"]);

    const orphans = findOrphanItemsData(projectDb, { entityType: "all", limit: 10 });
    expect(orphans.items.map((item) => `${item.entityType}:${item.externalId}`)).toEqual([
      "testCase:T-1",
      "testCase:T-2"
    ]);
  });

  it("labels findings with the first record when ids repeat", () => {
    const data = projectData({
      workItems: [workItem("work_1", "W-FIRST"), workItem("work_1", "W-SECOND")],
      findings: [finding("finding_1", "workItem", "work_1"), finding("finding_2", "workItem", "work_unknown")]
    });

    const result = listFindingsData(countingDb(data), { limit: 10 });

    expect(result.findings.map((item) => item.entityLabel)).toEqual(["W-FIRST: Work W-FIRST", "work_unknown"]);
  });

  it("attaches closed-work findings for the requirement's closed work in project order", () => {
    const data = projectData({
      requirements: [requirement("req_1", "REQ-1"), requirement("req_2", "REQ-2")],
      workItems: [workItem("work_1", "W-1", "done"), workItem("work_2", "W-2", "closed"), workItem("work_3", "W-3", "done")],
      traceLinks: [
        link("trace_1", "requirement", "req_1", "workItem", "work_2"),
        link("trace_2", "requirement", "req_1", "workItem", "work_1"),
        link("trace_3", "requirement", "req_2", "workItem", "work_3")
      ],
      findings: [
        finding("closed_1", "workItem", "work_1", "closed_work_without_verification"),
        finding("closed_3", "workItem", "work_3", "closed_work_without_verification"),
        finding("closed_2", "workItem", "work_2", "closed_work_without_verification"),
        finding("weak_1", "workItem", "work_1", "weak_wording")
      ]
    });

    const result = getTraceabilityGapsData(countingDb(data), { gapType: "closed_work_without_verification", limit: 10 });

    expect(result.gaps.map((gap) => [gap.requirement.externalId, gap.findings?.map((item) => item.id)])).toEqual([
      ["REQ-1", ["closed_1", "closed_2"]],
      ["REQ-2", ["closed_3"]]
    ]);
  });

  it("lists stale-trace linked items in baseline order, not link order", () => {
    const older = projectData({
      requirements: [requirement("req_1", "REQ-1", "The gateway shall forward frames within 5 seconds.")]
    });
    const current = projectData({
      requirements: [requirement("req_1", "REQ-1", "The gateway shall forward frames within 2 seconds.")],
      workItems: [workItem("work_1", "W-1", "done"), workItem("work_2", "W-2")],
      testCases: [testCase("test_1", "T-1", "failed"), testCase("test_2", "T-2", "passed")],
      traceLinks: [
        link("trace_1", "requirement", "req_1", "workItem", "work_2"),
        link("trace_2", "requirement", "req_1", "workItem", "work_1"),
        link("trace_3", "requirement", "req_1", "testCase", "test_2", "verifies"),
        link("trace_4", "testCase", "test_1", "requirement", "req_1", "verifies")
      ]
    });
    const baseline: Baseline = {
      id: "baseline_1",
      projectId: "project_1",
      label: "Baseline 1",
      createdAt: now,
      snapshot: older
    };

    const result = getStaleTraceCandidatesData(countingDb(current, [baseline]), { limit: 10 });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].linkedWorkItems.map((item) => item.externalId)).toEqual(["W-1", "W-2"]);
    expect(result.candidates[0].linkedTestCases.map((item) => item.externalId)).toEqual(["T-1", "T-2"]);
  });
});

describe("Doorframe MCP per-call analysis", () => {
  it("loads project data and baselines once for a review brief", () => {
    const data = projectData({
      requirements: [requirement("req_1", "REQ-1")],
      workItems: [workItem("work_1", "W-1")],
      traceLinks: [link("trace_1", "requirement", "req_1", "workItem", "work_1")]
    });
    const projectDb = countingDb(data, []);

    getReviewBriefData(projectDb, { reviewType: "test_readiness_review" });

    expect(projectDb.calls).toEqual({ loadProjectData: 1, listBaselines: 1 });
  });

  it("does not reuse results between calls when the same data object changes", () => {
    const data = projectData({ requirements: [requirement("req_1", "REQ-1")] });
    const projectDb = countingDb(data);

    expect(getProjectSummaryData(projectDb).concerns.requirementsWithoutWork).toBe(1);

    data.requirements.push(requirement("req_2", "REQ-2"));
    data.workItems.push(workItem("work_1", "W-1"));
    data.traceLinks.push(link("trace_1", "requirement", "req_1", "workItem", "work_1"));

    const summary = getProjectSummaryData(projectDb);
    expect(summary.counts.requirements).toBe(2);
    expect(summary.concerns.requirementsWithoutWork).toBe(1);
    expect(projectDb.calls.loadProjectData).toBe(2);
  });
});
