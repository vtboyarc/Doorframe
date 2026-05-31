import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ProjectData } from "@doorframe/core";
import { parseJiraCsv, parseJUnitXml, parseRequirementsCsv } from "@doorframe/parsers";
import {
  buildProjectDataFromImportedRecords,
  defaultJiraCsvMapping,
  defaultRequirementsCsvMapping
} from "@doorframe/storage";
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
    expect(html).toContain("Executive Summary");
    expect(html).toContain("Traceability Matrix");
    expect(html).toContain("Appendix");
  });

  it("escapes unsafe HTML and does not reference external resources", () => {
    const unsafe = fixture();
    unsafe.project.name = "<script>alert(1)</script>";
    unsafe.requirements[0].title = "<img src=x onerror=alert(1)>";

    const html = generateHtmlTraceabilityReport(unsafe);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/@import/i);
  });

  it("renders the Falcon demo project with expected counts and sections", () => {
    const demoDir = path.join(process.cwd(), "examples", "falcon-telemetry-gateway");
    const requirements = parseRequirementsCsv(
      fs.readFileSync(path.join(demoDir, "sample-requirements-baseline-b.csv"), "utf8"),
      defaultRequirementsCsvMapping
    );
    const jira = parseJiraCsv(
      fs.readFileSync(path.join(demoDir, "sample-jira.csv"), "utf8"),
      defaultJiraCsvMapping
    );
    const junit = parseJUnitXml(fs.readFileSync(path.join(demoDir, "sample-junit.xml"), "utf8"));
    const data = buildProjectDataFromImportedRecords({
      projectName: "Falcon Telemetry Gateway",
      requirements: requirements.records,
      workItems: jira.records,
      testCases: junit.records
    });

    const html = generateHtmlTraceabilityReport(data);

    expect(data.requirements).toHaveLength(42);
    expect(data.workItems).toHaveLength(31);
    expect(data.testCases).toHaveLength(58);
    expect(data.findings).toHaveLength(19);
    expect(html).toContain("Falcon Telemetry Gateway");
    expect(html).toContain("Weak Requirement Language");
    expect(html).toContain("Closed Work Without Passing Tests");
    expect(html).toContain("REQ-003");
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
