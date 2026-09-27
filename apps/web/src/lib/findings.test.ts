import { describe, expect, it } from "vitest";
import type { Finding, Requirement, WorkItem } from "@doorframe/core";
import {
  compareFindings,
  findingsListView,
  flaggedTerms,
  isFindingCategory,
  isFindingSeverity,
  mentionedEntities
} from "./findings";

const time = "2026-01-01T00:00:00.000Z";

function finding(overrides: Partial<Finding>): Finding {
  return {
    id: "finding-1",
    projectId: "project-1",
    severity: "warning",
    category: "missing_work_trace",
    title: "REQ-1 has no linked work item",
    description: "No Jira or work item trace was found for this requirement.",
    entityType: "requirement",
    entityId: "req-1",
    createdAt: time,
    updatedAt: time,
    ...overrides
  };
}

function requirement(id: string, externalId: string): Requirement {
  return { id, projectId: "project-1", externalId, title: externalId, text: "", source: "requirements-csv", createdAt: time, updatedAt: time };
}

function workItem(id: string, externalId: string): WorkItem {
  return { id, projectId: "project-1", externalId, title: externalId, source: "jira-csv", createdAt: time, updatedAt: time };
}

describe("finding filters", () => {
  it("validates category and severity values from the URL", () => {
    expect(isFindingCategory("custom_rule")).toBe(true);
    expect(isFindingCategory("bogus")).toBe(false);
    expect(isFindingCategory(["weak_wording"])).toBe(false);
    expect(isFindingSeverity("error")).toBe(true);
    expect(isFindingSeverity("high")).toBe(false);
  });

  it("sorts by severity, then category, then natural title order", () => {
    const findings = [
      finding({ id: "c", title: "REQ-10 has no linked work item" }),
      finding({ id: "b", title: "REQ-2 has no linked work item" }),
      finding({ id: "a", severity: "error", category: "missing_verification", title: "REQ-9 has no linked test case" })
    ];

    expect([...findings].sort(compareFindings).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("filters, pages, and counts", () => {
    const findings = Array.from({ length: 7 }, (_, index) =>
      finding({ id: `f${index}`, title: `REQ-${index} has no linked work item`, severity: index < 2 ? "error" : "warning" })
    );
    const view = findingsListView(findings, { severity: "warning", page: 2 }, 3);

    expect(view.total).toBe(5);
    expect(view.pageCount).toBe(2);
    expect(view.items.map((item) => item.id)).toEqual(["f5", "f6"]);
    expect(view.severityCounts).toEqual({ error: 2, warning: 5, info: 0 });
    expect(view.categoryCounts.missing_work_trace).toBe(5);
  });

  it("clamps out-of-range pages", () => {
    expect(findingsListView([finding({})], { page: 99 }).page).toBe(1);
    expect(findingsListView([], { page: -3 }).pageCount).toBe(1);
  });
});

describe("mentionedEntities", () => {
  it("finds the other requirement in a duplicate candidate and the work item in a stale link", () => {
    const data = {
      requirements: [requirement("req-1", "REQ-001"), requirement("req-4", "REQ-004"), requirement("req-14", "REQ-014")],
      workItems: [workItem("work-27", "FG-27")]
    };

    const duplicate = mentionedEntities(
      finding({ category: "duplicate_candidate", title: "REQ-001 resembles REQ-004", entityId: "req-1" }),
      data
    );
    expect(duplicate.requirements.map((item) => item.externalId)).toEqual(["REQ-004"]);

    const stale = mentionedEntities(
      finding({ category: "stale_link", title: "FG-27 may be stale for REQ-014.", entityId: "req-14" }),
      data
    );
    expect(stale.workItems.map((item) => item.externalId)).toEqual(["FG-27"]);
    expect(stale.requirements).toEqual([]);
  });

  it("matches whole IDs only", () => {
    const data = { requirements: [requirement("req-1", "REQ-1")], workItems: [] };

    expect(mentionedEntities(finding({ title: "REQ-10 has no linked work item", entityId: "x" }), data).requirements).toEqual([]);
  });
});

describe("flaggedTerms", () => {
  it("reads the vague terms from a weak wording finding", () => {
    expect(
      flaggedTerms(finding({ category: "weak_wording", description: "The requirement contains vague wording: quickly, as needed." }))
    ).toEqual(["quickly", "as needed"]);
    expect(flaggedTerms(finding({}))).toEqual([]);
  });
});
