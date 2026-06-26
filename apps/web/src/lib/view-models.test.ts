import { describe, expect, it } from "vitest";
import { matrixRows } from "@doorframe/reporting";
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
  projectSummary,
  requirementFindings,
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

    expect(rows[0].failingTestCount).toBe(1);
    expect(filterRequirementRows(rows, "failed-tests")).toHaveLength(1);
    expect(filterRequirementRows(rows, "without-work")).toHaveLength(0);
  });
});

describe("requirementFindings", () => {
  it("includes findings attached to linked work items and tests", () => {
    const findings = [
      { ...finding("requirement", requirement.id), id: "requirement-finding" },
      { ...finding("workItem", workItem.id), id: "work-finding" },
      { ...finding("testCase", testCase.id), id: "test-finding" },
      { ...finding("workItem", "unrelated-work"), id: "unrelated-finding" }
    ];
    const data = projectData(findings);

    expect(requirementFindings(requirement, data).map((item) => item.id)).toEqual([
      "requirement-finding",
      "work-finding",
      "test-finding"
    ]);
    expect(requirementFindings(requirement, data)).toEqual(matrixRows(data)[0].findings);
    expect(requirementRows(data)[0].findingCount).toBe(3);
  });
});

describe("projectSummary", () => {
  it("counts each requirement once and includes requirements with only errored tests", () => {
    const secondRequirement: Requirement = {
      ...requirement,
      id: "req-2",
      externalId: "REQ-002",
      title: "Record status errors"
    };
    const secondFailedTest: TestCase = {
      ...testCase,
      id: "test-2",
      externalId: "TEST-002",
      name: "backup status transmission"
    };
    const erroredTest: TestCase = {
      ...testCase,
      id: "test-3",
      externalId: "TEST-003",
      name: "status error path",
      status: "errored"
    };
    const data = projectData();
    data.requirements = [requirement, secondRequirement];
    data.testCases = [testCase, secondFailedTest, erroredTest];
    data.traceLinks = [
      ...traceLinks,
      { ...traceLinks[1], id: "link-3", targetId: secondFailedTest.id },
      {
        ...traceLinks[1],
        id: "link-4",
        sourceId: secondRequirement.id,
        targetId: erroredTest.id
      }
    ];

    expect(requirementRows(data).map((row) => row.failingTestCount)).toEqual([2, 1]);
    expect(projectSummary(data).linkedRequirements).toBe(1);
    expect(projectSummary(data).failedTestsLinkedToRequirements).toBe(2);
    expect(filterRequirementRows(requirementRows(data), "failed-tests")).toHaveLength(2);
  });

  it("ignores links that do not connect a known requirement", () => {
    const data = projectData();
    data.traceLinks = [
      ...traceLinks,
      {
        ...traceLinks[0],
        id: "link-unrelated",
        sourceType: "workItem",
        sourceId: workItem.id,
        targetType: "testCase",
        targetId: testCase.id
      },
      {
        ...traceLinks[1],
        id: "link-missing-requirement",
        sourceId: "missing-requirement"
      }
    ];

    expect(projectSummary(data)).toMatchObject({
      linkedRequirements: 1,
      requirementsWithoutWork: 0,
      requirementsWithoutTests: 0,
      failedTestsLinkedToRequirements: 1
    });
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
