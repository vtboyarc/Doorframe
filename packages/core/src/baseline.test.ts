import { describe, expect, it } from "vitest";
import { diffBaselines, type ProjectSnapshot } from "./baseline";
import type { Finding, Requirement, TestCase } from "./types";

function req(externalId: string, overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: externalId,
    projectId: "p1",
    externalId,
    title: overrides.title ?? externalId,
    text: overrides.text ?? "text",
    source: "manual",
    status: overrides.status,
    createdAt: "now",
    updatedAt: "now",
    ...overrides
  };
}

function test(externalId: string, status: TestCase["status"]): TestCase {
  return {
    id: externalId,
    projectId: "p1",
    externalId,
    name: externalId,
    status,
    source: "junit-xml",
    createdAt: "now",
    updatedAt: "now"
  };
}

function finding(category: Finding["category"], title: string): Finding {
  return {
    id: title,
    projectId: "p1",
    severity: "warning",
    category,
    title,
    description: title,
    entityType: "requirement",
    entityId: "REQ-1",
    createdAt: "now",
    updatedAt: "now"
  };
}

function snapshot(partial: Partial<ProjectSnapshot>): ProjectSnapshot {
  return {
    requirements: partial.requirements ?? [],
    workItems: partial.workItems ?? [],
    testCases: partial.testCases ?? [],
    traceLinks: partial.traceLinks ?? [],
    findings: partial.findings ?? []
  };
}

describe("diffBaselines", () => {
  it("detects added, removed, and modified requirements", () => {
    const base = snapshot({
      requirements: [req("REQ-1", { text: "old" }), req("REQ-2")]
    });
    const against = snapshot({
      requirements: [req("REQ-1", { text: "new" }), req("REQ-3")]
    });

    const diff = diffBaselines(base, against);
    expect(diff.requirements.added).toEqual(["REQ-3"]);
    expect(diff.requirements.removed).toEqual(["REQ-2"]);
    expect(diff.requirements.modified).toHaveLength(1);
    expect(diff.requirements.modified[0].externalId).toBe("REQ-1");
    expect(diff.requirements.modified[0].changes[0]).toMatchObject({ field: "text", before: "old", after: "new" });
  });

  it("detects test status changes and finding deltas", () => {
    const base = snapshot({
      testCases: [test("T1", "failed")],
      findings: [finding("weak_wording", "a"), finding("missing_verification", "b")]
    });
    const against = snapshot({
      testCases: [test("T1", "passed")],
      findings: [finding("weak_wording", "a"), finding("non_verifiable", "c")]
    });

    const diff = diffBaselines(base, against);
    expect(diff.testCases.statusChanged).toEqual([{ externalId: "T1", before: "failed", after: "passed" }]);
    expect(diff.findings.added).toBe(1);
    expect(diff.findings.resolved).toBe(1);
    expect(diff.findings.byCategory.non_verifiable.added).toBe(1);
    expect(diff.findings.byCategory.missing_verification.removed).toBe(1);
  });
});
