import { describe, expect, it } from "vitest";
import { diffBaselines, type Finding, type ProjectSnapshot, type Requirement, type TestCase, type TraceLink, type WorkItem } from "@doorframe/core";
import { generateBaselineDiffHtmlReport } from "@doorframe/reporting";
import { baselineDiffDetails, baselineDiffReport, baselineRecordChanges } from "./baseline-details";

const time = "2026-01-01T00:00:00.000Z";

function requirement(id: string, externalId: string, text: string, status = "Approved"): Requirement {
  return { id, projectId: "p", externalId, title: `${externalId} title`, text, status, source: "requirements-csv", createdAt: time, updatedAt: time };
}

function link(id: string, sourceId: string, targetType: TraceLink["targetType"], targetId: string, linkType: TraceLink["linkType"]): TraceLink {
  return { id, projectId: "p", sourceType: "requirement", sourceId, targetType, targetId, linkType, confidence: 1, source: "x", createdAt: time, updatedAt: time };
}

function finding(title: string, category: Finding["category"] = "missing_work_trace"): Finding {
  return { id: title, projectId: "p", severity: "warning", category, title, description: "", entityType: "requirement", entityId: "x", createdAt: time, updatedAt: time };
}

const work: WorkItem = { id: "w1", projectId: "p", externalId: "FG-1", title: "Work", status: "Done", source: "jira-csv", createdAt: time, updatedAt: time };
const test: TestCase = { id: "t1", projectId: "p", externalId: "T.one", name: "testOne_REQ_2", status: "passed", source: "junit-xml", createdAt: time, updatedAt: time };

describe("baselineDiffDetails", () => {
  it("lists added, removed, and changed requirements with word-level changes and affected evidence", () => {
    const from: ProjectSnapshot = {
      requirements: [requirement("a1", "REQ-1", "Old"), requirement("a2", "REQ-2", "Process within 5 seconds.")],
      workItems: [],
      testCases: [],
      traceLinks: [],
      findings: [finding("REQ-1 has no linked work item"), finding("REQ-2 has no linked work item")]
    };
    const to: ProjectSnapshot = {
      requirements: [requirement("b2", "REQ-2", "Process within 2 seconds.", "Changed"), requirement("b3", "REQ-3", "New")],
      workItems: [work],
      testCases: [test],
      traceLinks: [link("l1", "b2", "workItem", "w1", "implements"), link("l2", "b2", "testCase", "t1", "verifies")],
      findings: [finding("REQ-3 has no linked work item")]
    };

    const details = baselineDiffDetails(from, to);

    expect(details.addedRequirements).toEqual([{ externalId: "REQ-3", title: "REQ-3 title" }]);
    expect(details.removedRequirements).toEqual([{ externalId: "REQ-1", title: "REQ-1 title" }]);
    expect(details.changedRequirements).toHaveLength(1);
    const [changed] = details.changedRequirements;
    expect(changed.externalId).toBe("REQ-2");
    expect(changed.changes.map((change) => change.field)).toEqual(["text", "status"]);
    expect(changed.changes[0].wordDiff?.filter((token) => token.type !== "unchanged").map((token) => token.value)).toEqual(["5", "2"]);
    expect(changed.affectedWorkItems).toEqual(["FG-1"]);
    expect(changed.affectedTests).toEqual(["testOne_REQ_2 (passed)"]);
    expect(details.newFindings.map((item) => item.title)).toEqual(["REQ-3 has no linked work item"]);
    expect(details.resolvedFindings.map((item) => item.title)).toEqual([
      "REQ-1 has no linked work item",
      "REQ-2 has no linked work item"
    ]);
    expect(details.addedLinks).toEqual(["REQ-2 → FG-1 (implements)", "REQ-2 → T.one (verifies)"]);
    expect(details.removedLinks).toEqual([]);
  });

  it("compares links by external ID so re-imported records with new internal ids are not reported as changes", () => {
    const from: ProjectSnapshot = {
      requirements: [requirement("a", "REQ-1", "Same")],
      workItems: [{ ...work, id: "old-work" }],
      testCases: [],
      traceLinks: [link("l", "a", "workItem", "old-work", "implements")],
      findings: []
    };
    const to: ProjectSnapshot = {
      requirements: [requirement("b", "REQ-1", "Same")],
      workItems: [{ ...work, id: "new-work" }],
      testCases: [],
      traceLinks: [link("m", "b", "workItem", "new-work", "implements")],
      findings: []
    };

    const details = baselineDiffDetails(from, to);
    expect(details.addedLinks).toEqual([]);
    expect(details.removedLinks).toEqual([]);
    expect(details.changedRequirements).toEqual([]);
  });
});

describe("baselineDiffReport", () => {
  it("names both sides and renders an offline HTML report", () => {
    const from: ProjectSnapshot = {
      requirements: [requirement("a1", "REQ-1", "Old <text>")],
      workItems: [],
      testCases: [],
      traceLinks: [],
      findings: []
    };
    const to: ProjectSnapshot = { ...from, requirements: [requirement("b1", "REQ-1", "New <text>"), requirement("b2", "REQ-2", "Added")] };

    const report = baselineDiffReport(from, to, "Review 1", "Current state");
    expect(report).toMatchObject({ baselineAName: "Review 1", baselineBName: "Current state" });
    expect(report.summary).toMatchObject({ added: 1, changed: 1, deleted: 0 });

    const html = generateBaselineDiffHtmlReport(report, {
      projectName: "Falcon Telemetry Gateway",
      recordChanges: baselineRecordChanges(diffBaselines(from, to), baselineDiffDetails(from, to))
    });
    expect(html).toContain("Project: Falcon Telemetry Gateway");
    expect(html).toContain("Changes from Review 1 to Current state");
    expect(html).toContain("&lt;text&gt;");
    expect(html).not.toMatch(/<(script|link)\b|https?:\/\//i);
  });
});

describe("baselineRecordChanges", () => {
  it("collects the findings, link, work item, and test changes the Baselines page shows", () => {
    const from: ProjectSnapshot = {
      requirements: [requirement("a1", "REQ-1", "Same")],
      workItems: [{ ...work, id: "w-old", externalId: "FG-10" }],
      testCases: [
        { ...test, id: "t-a", externalId: "T.two", status: "failed" },
        { ...test, id: "t-b", externalId: "T.gone" }
      ],
      traceLinks: [link("l1", "a1", "workItem", "w-old", "implements")],
      findings: [finding("REQ-1 has no linked work item")]
    };
    const to: ProjectSnapshot = {
      requirements: [requirement("b1", "REQ-1", "Same")],
      workItems: [
        { ...work, id: "w-new", externalId: "FG-9" },
        { ...work, id: "w-2", externalId: "FG-2" }
      ],
      testCases: [
        { ...test, id: "t-c", externalId: "T.two", status: "passed" },
        { ...test, id: "t-d", externalId: "T.new" }
      ],
      traceLinks: [link("l2", "b1", "workItem", "w-new", "implements")],
      findings: [finding("REQ-9 needs review", "weak_wording")]
    };

    const changes = baselineRecordChanges(diffBaselines(from, to), baselineDiffDetails(from, to));

    expect(changes.workItemsAdded).toEqual(["FG-2", "FG-9"]);
    expect(changes.workItemsRemoved).toEqual(["FG-10"]);
    expect(changes.testsAdded).toEqual(["T.new"]);
    expect(changes.testsRemoved).toEqual(["T.gone"]);
    expect(changes.testStatusChanges).toEqual([{ externalId: "T.two", before: "failed", after: "passed" }]);
    expect(changes.addedLinks).toEqual(["REQ-1 → FG-9 (implements)"]);
    expect(changes.removedLinks).toEqual(["REQ-1 → FG-10 (implements)"]);
    expect(changes.newFindings).toEqual([{ category: "weak_wording", severity: "warning", title: "REQ-9 needs review" }]);
    expect(changes.resolvedFindings.map((item) => item.title)).toEqual(["REQ-1 has no linked work item"]);
  });
});
