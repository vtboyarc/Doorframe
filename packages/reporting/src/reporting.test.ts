import { describe, expect, it } from "vitest";
import type { ProjectData } from "@doorframe/core";
import { generateHtmlTraceabilityReport } from "./html";
import { generateMarkdownTraceabilityReport } from "./markdown";
import { buildJsonReport, generateJsonReport } from "./json";
import { generateTraceabilityMatrixCsv } from "./csv";

function fixture(): ProjectData {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    project: { id: "p1", name: "Demo", createdAt: now, updatedAt: now },
    requirements: [
      {
        id: "r1",
        projectId: "p1",
        externalId: "REQ-1",
        title: "Display status",
        text: "The system shall display status.",
        source: "requirements-csv",
        status: "Approved",
        verificationMethod: "Test",
        createdAt: now,
        updatedAt: now
      }
    ],
    workItems: [
      {
        id: "w1",
        projectId: "p1",
        externalId: "FG-1",
        title: "Implement status",
        status: "Done",
        source: "jira-csv",
        createdAt: now,
        updatedAt: now
      }
    ],
    testCases: [
      {
        id: "t1",
        projectId: "p1",
        externalId: "Suite.testStatus",
        name: "testStatus",
        status: "passed",
        source: "junit-xml",
        createdAt: now,
        updatedAt: now
      }
    ],
    traceLinks: [
      {
        id: "l1",
        projectId: "p1",
        sourceType: "requirement",
        sourceId: "r1",
        targetType: "workItem",
        targetId: "w1",
        linkType: "implements",
        confidence: 0.85,
        source: "jira-csv",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "l2",
        projectId: "p1",
        sourceType: "requirement",
        sourceId: "r1",
        targetType: "testCase",
        targetId: "t1",
        linkType: "verifies",
        confidence: 0.8,
        source: "junit-xml",
        createdAt: now,
        updatedAt: now
      }
    ],
    findings: [],
    importBatches: []
  };
}

describe("report formats", () => {
  it("renders HTML with the requirement and links", () => {
    const html = generateHtmlTraceabilityReport(fixture());
    expect(html).toContain("REQ-1");
    expect(html).toContain("FG-1");
    expect(html).toContain("testStatus");
  });

  it("renders Markdown tables", () => {
    const md = generateMarkdownTraceabilityReport(fixture());
    expect(md).toContain("# Doorframe Traceability Report");
    expect(md).toContain("| REQ-1 |");
    expect(md).toContain("FG-1");
  });

  it("builds a JSON report whose snapshot can round-trip", () => {
    const report = buildJsonReport(fixture());
    expect(report.summary.requirements).toBe(1);
    expect(report.matrix[0].workItems).toEqual(["FG-1"]);
    expect(report.snapshot.requirements).toHaveLength(1);
    expect(() => JSON.parse(generateJsonReport(fixture()))).not.toThrow();
  });

  it("renders a CSV matrix", () => {
    const csv = generateTraceabilityMatrixCsv(fixture());
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Requirement ID");
    expect(lines[1]).toContain("REQ-1");
    expect(lines[1]).toContain("FG-1");
  });
});
