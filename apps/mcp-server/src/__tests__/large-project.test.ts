import { describe, expect, it } from "vitest";
import type { Baseline, Finding, ProjectData, Requirement, TestCase, TestStatus, TraceLink, WorkItem } from "@doorframe/core";
import {
  getProjectSummaryData,
  getReviewBriefData,
  getStaleTraceCandidatesData,
  searchRequirementsData
} from "../tools";

const now = "2026-01-01T00:00:00.000Z";
const size = 2000;

function largeProject(): { data: ProjectData; baselines: Baseline[] } {
  const requirements: Requirement[] = [];
  const workItems: WorkItem[] = [];
  const testCases: TestCase[] = [];
  const traceLinks: TraceLink[] = [];
  const findings: Finding[] = [];
  const statuses: TestStatus[] = ["passed", "failed", "skipped", "passed"];

  const addLink = (sourceType: TraceLink["sourceType"], sourceId: string, targetType: TraceLink["targetType"], targetId: string) => {
    traceLinks.push({
      id: `trace_${traceLinks.length}`,
      projectId: "project_large",
      sourceType,
      sourceId,
      targetType,
      targetId,
      linkType: targetType === "testCase" || sourceType === "testCase" ? "verifies" : "implements",
      confidence: 0.9,
      source: "manual",
      createdAt: now,
      updatedAt: now
    });
  };

  for (let index = 0; index < size; index += 1) {
    requirements.push({
      id: `req_${index}`,
      projectId: "project_large",
      externalId: `FTG-${String(index).padStart(4, "0")}`,
      title: `Telemetry requirement ${index}`,
      text: `The gateway shall forward telemetry frame ${index} within ${index % 7} seconds.`,
      source: "requirements-csv",
      status: index % 5 === 0 ? "draft" : "approved",
      createdAt: now,
      updatedAt: now
    });
    workItems.push({
      id: `work_${index}`,
      projectId: "project_large",
      externalId: `FTG-W-${index}`,
      title: `Implement telemetry ${index}`,
      status: index % 2 === 0 ? "done" : "open",
      source: "jira-csv",
      createdAt: now,
      updatedAt: now
    });
    testCases.push({
      id: `test_${index}`,
      projectId: "project_large",
      externalId: `FTG-T-${index}`,
      name: `telemetry ${index} forwards within ${index % 7} seconds`,
      status: statuses[index % statuses.length],
      source: "junit-xml",
      createdAt: now,
      updatedAt: now
    });
    if (index % 10 !== 0) {
      addLink("requirement", `req_${index}`, "workItem", `work_${(index * 7) % size}`);
    }
    if (index % 9 !== 0) {
      addLink("requirement", `req_${index}`, "testCase", `test_${(index * 11) % size}`);
    }
    if (index % 3 === 0) {
      addLink("workItem", `work_${index}`, "requirement", `req_${(index * 13) % size}`);
    }
    findings.push({
      id: `finding_${index}`,
      projectId: "project_large",
      severity: index % 3 === 0 ? "error" : "warning",
      category: index % 4 === 0 ? "closed_work_without_verification" : "weak_wording",
      title: `Finding ${index}`,
      description: "Fictional finding.",
      entityType: index % 4 === 0 ? "workItem" : "requirement",
      entityId: index % 4 === 0 ? `work_${index}` : `req_${index}`,
      createdAt: now,
      updatedAt: now
    });
  }

  const data: ProjectData = {
    project: { id: "project_large", name: "Large Fictional Gateway", createdAt: now, updatedAt: now },
    requirements,
    workItems,
    testCases,
    traceLinks,
    findings,
    importBatches: []
  };
  const older = {
    requirements: requirements.map((requirement, index) =>
      index % 8 === 0 ? { ...requirement, text: `${requirement.text} Legacy threshold 9.` } : requirement
    ),
    workItems,
    testCases,
    traceLinks,
    findings
  };

  return {
    data,
    baselines: [{ id: "baseline_1", projectId: "project_large", label: "Baseline 1", createdAt: now, snapshot: older }]
  };
}

/**
 * Wrap the project's trace links so every element read is counted. Counting reads keeps the test
 * deterministic, unlike a wall-clock limit that a slow CI runner could miss.
 */
function countLinkReads(data: ProjectData): { data: ProjectData; reads: () => number } {
  let reads = 0;
  const traceLinks = new Proxy(data.traceLinks, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) {
        reads += 1;
      }
      return Reflect.get(target, property, receiver);
    }
  });
  return { data: { ...data, traceLinks }, reads: () => reads };
}

describe("Doorframe MCP adapters on a large project", () => {
  it("answers summary, search, stale-trace, and review-brief calls without rescanning links per requirement", () => {
    const { data: plainData, baselines } = largeProject();
    const { data, reads } = countLinkReads(plainData);
    const projectDb = { loadProjectData: () => data, listBaselines: () => baselines };

    const summary = getProjectSummaryData(projectDb);
    const search = searchRequirementsData(projectDb, { query: "telemetry", limit: 5 });
    const stale = getStaleTraceCandidatesData(projectDb, { limit: 5 });
    const brief = getReviewBriefData(projectDb, { reviewType: "test_readiness_review", limit: 5 });

    // Scanning every link for each requirement would read links millions of times at this size
    // (requirements x links x scans); indexing them once per call reads each link a few times.
    expect(reads()).toBeLessThan(plainData.traceLinks.length * 50);
    expect(summary.counts).toMatchObject({ requirements: size, workItems: size, testCases: size });
    expect(summary.concerns.requirementsWithoutWork).toBeGreaterThan(0);
    expect(search.limit.total).toBe(size);
    expect(stale.limit.total).toBeGreaterThan(0);
    expect(brief.topGaps).toHaveLength(5);
  });
});
