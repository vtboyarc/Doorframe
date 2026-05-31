import { describe, expect, it } from "vitest";
import type { Requirement, TestCase, TraceLink, WorkItem } from "@doorframe/core";
import { generateFindings } from "./rules";

const baseTime = "2026-01-01T00:00:00.000Z";

function requirement(overrides: Partial<Requirement>): Requirement {
  return {
    id: "req_1",
    projectId: "project_1",
    externalId: "REQ-1",
    title: "Requirement",
    text: "The system should be fast and user-friendly.",
    source: "requirements-csv",
    createdAt: baseTime,
    updatedAt: baseTime,
    ...overrides
  };
}

function workItem(overrides: Partial<WorkItem>): WorkItem {
  return {
    id: "work_1",
    projectId: "project_1",
    externalId: "ENG-1",
    title: "Implement REQ-1",
    source: "jira-csv",
    createdAt: baseTime,
    updatedAt: baseTime,
    ...overrides
  };
}

function testCase(overrides: Partial<TestCase>): TestCase {
  return {
    id: "test_1",
    projectId: "project_1",
    externalId: "REQ-1 verifies login",
    name: "REQ-1 verifies login",
    status: "passed",
    source: "junit-xml",
    createdAt: baseTime,
    updatedAt: baseTime,
    ...overrides
  };
}

function traceLink(overrides: Partial<TraceLink>): TraceLink {
  return {
    id: "trace_1",
    projectId: "project_1",
    sourceType: "requirement",
    sourceId: "req_1",
    targetType: "testCase",
    targetId: "test_1",
    linkType: "verifies",
    confidence: 0.9,
    source: "junit-xml",
    createdAt: baseTime,
    updatedAt: baseTime,
    ...overrides
  };
}

describe("generateFindings", () => {
  it("flags weak wording and missing traces", () => {
    const findings = generateFindings({
      requirements: [requirement({})],
      workItems: [],
      testCases: [],
      traceLinks: []
    });

    expect(findings.map((finding) => finding.category)).toContain("weak_wording");
    expect(findings.map((finding) => finding.category)).toContain("missing_verification");
    expect(findings.map((finding) => finding.category)).toContain("missing_work_trace");
  });

  it("flags closed work linked to a requirement without passing test evidence", () => {
    const findings = generateFindings({
      requirements: [requirement({ text: "The system shall display an error within 2 seconds.", verificationMethod: "Test" })],
      workItems: [workItem({ status: "Done" })],
      testCases: [testCase({ status: "failed" })],
      traceLinks: [
        traceLink({ targetType: "workItem", targetId: "work_1", linkType: "implements" }),
        traceLink({ id: "trace_2", targetType: "testCase", targetId: "test_1", linkType: "verifies" })
      ]
    });

    expect(findings.map((finding) => finding.category)).toContain("closed_work_without_verification");
  });
});
