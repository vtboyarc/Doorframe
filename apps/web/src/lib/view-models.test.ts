import { describe, expect, it } from "vitest";
import type {
  Finding,
  ProjectData,
  Requirement,
  TestCase,
  TraceLink,
  WorkItem
} from "@doorframe/core";
import {
  auditEventTarget,
  filterRequirementRows,
  findingContext,
  findingsByPriority,
  requirementRows
} from "./view-models";

const requirement: Requirement = {
  id: "req-1",
  projectId: "project-1",
  externalId: "REQ-001",
  title: "Transmit status",
  text: "The gateway shall transmit status.",
  source: "requirements-csv",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const workItem: WorkItem = {
  id: "work-1",
  projectId: "project-1",
  externalId: "WORK-001",
  title: "Implement status",
  source: "jira-csv",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const testCase: TestCase = {
  id: "test-1",
  projectId: "project-1",
  externalId: "TEST-001",
  name: "status transmission",
  status: "failed",
  source: "junit-xml",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const traceLinks: TraceLink[] = [
  {
    id: "link-1",
    projectId: "project-1",
    sourceType: "requirement",
    sourceId: requirement.id,
    targetType: "workItem",
    targetId: workItem.id,
    linkType: "implements",
    confidence: 1,
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "link-2",
    projectId: "project-1",
    sourceType: "requirement",
    sourceId: requirement.id,
    targetType: "testCase",
    targetId: testCase.id,
    linkType: "verifies",
    confidence: 1,
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

function finding(entityType: Finding["entityType"], entityId: string): Finding {
  return {
    id: "finding-1",
    projectId: "project-1",
    severity: "warning",
    category: "closed_work_without_verification",
    title: "Review traceability",
    description: "The affected entity needs review.",
    entityType,
    entityId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function projectData(findings: Finding[] = []): ProjectData {
  return {
    project: {
      id: "project-1",
      name: "Falcon Telemetry Gateway",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    requirements: [requirement],
    workItems: [workItem],
    testCases: [testCase],
    traceLinks,
    findings,
    importBatches: []
  };
}

describe("findingContext", () => {
  it("resolves a finding entity and its related requirements", () => {
    const context = findingContext(finding("workItem", workItem.id), projectData());

    expect(context.entity).toEqual(workItem);
    expect(context.relatedRequirements).toEqual([requirement]);
  });

  it("returns a null entity when imported data no longer contains the target", () => {
    const context = findingContext(finding("testCase", "missing-test"), projectData());

    expect(context.entity).toBeNull();
    expect(context.relatedRequirements).toEqual([]);
  });
});

describe("findingsByPriority", () => {
  it("shows errors before warnings and informational findings", () => {
    const findings = [
      { ...finding("requirement", requirement.id), id: "info", severity: "info" as const },
      { ...finding("requirement", requirement.id), id: "warning", severity: "warning" as const },
      { ...finding("requirement", requirement.id), id: "error", severity: "error" as const }
    ];

    expect(findingsByPriority(findings).map((item) => item.id)).toEqual(["error", "warning", "info"]);
  });
});

describe("requirementRows", () => {
  it("counts failed linked tests and supports dashboard gap views", () => {
    const rows = requirementRows(projectData());

    expect(rows[0].failedTestCount).toBe(1);
    expect(filterRequirementRows(rows, "failed-tests")).toHaveLength(1);
    expect(filterRequirementRows(rows, "without-work")).toHaveLength(0);
  });
});

describe("auditEventTarget", () => {
  it("routes analysis events to findings", () => {
    expect(auditEventTarget("project-1", "analysis.rerun")).toEqual({
      href: "/projects/project-1/findings",
      label: "Review findings"
    });
  });
});
