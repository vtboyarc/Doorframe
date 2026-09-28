import { describe, expect, it } from "vitest";
import type { Requirement, TestCase, TraceLink, WorkItem } from "@doorframe/core";
import {
  canReachThreshold,
  findClosedWorkWithoutVerification,
  findDuplicateCandidates,
  findMissingVerification,
  findMissingWorkTrace,
  findPossibleStaleLinks,
  generateFindings,
  isClosedWith,
  isDraftOrChangedWith,
  jaccard,
  MAX_DUPLICATE_CANDIDATES_PER_REQUIREMENT
} from "./rules";

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

describe("findDuplicateCandidates", () => {
  it("caps the candidates reported for one requirement so templated exports stay bounded", () => {
    const requirements = Array.from({ length: 40 }, (_, index) =>
      requirement({
        id: `req_${index}`,
        externalId: `REQ-${index}`,
        text: "The gateway shall record the telemetry packet timestamp in the local log."
      })
    );

    const findings = findDuplicateCandidates({ requirements, workItems: [], testCases: [], traceLinks: [] }, 0.8);
    const perRequirement = new Map<string, number>();
    findings.forEach((finding) => perRequirement.set(finding.entityId, (perRequirement.get(finding.entityId) ?? 0) + 1));

    expect(Math.max(...perRequirement.values())).toBe(MAX_DUPLICATE_CANDIDATES_PER_REQUIREMENT);
    expect(findings.length).toBeLessThanOrEqual(requirements.length * MAX_DUPLICATE_CANDIDATES_PER_REQUIREMENT);
    expect(findings[0].title).toBe("REQ-0 resembles REQ-1");
  });

  it("reports a pair whose similarity is exactly the threshold, and skips it just above", () => {
    const requirements = [
      requirement({ id: "req_a", externalId: "REQ-A", text: "alpha bravo charlie delta echo" }),
      requirement({ id: "req_b", externalId: "REQ-B", text: "alpha bravo charlie delta" })
    ];
    const input = { requirements, workItems: [], testCases: [], traceLinks: [] };

    const atThreshold = findDuplicateCandidates(input, 0.8);
    expect(atThreshold.map((finding) => finding.title)).toEqual(["REQ-A resembles REQ-B"]);
    expect(atThreshold[0].description).toBe("The normalized requirement text is 80% similar.");
    expect(findDuplicateCandidates(input, 0.81)).toEqual([]);
  });

  it("keeps the zero-threshold behavior for requirements without comparable words", () => {
    const requirements = [
      requirement({ id: "req_a", externalId: "REQ-A", text: "" }),
      requirement({ id: "req_b", externalId: "REQ-B", text: "ok" })
    ];

    const findings = findDuplicateCandidates({ requirements, workItems: [], testCases: [], traceLinks: [] }, 0);
    expect(findings.map((finding) => finding.description)).toEqual(["The normalized requirement text is 0% similar."]);
  });
});

describe("jaccard", () => {
  it("divides shared tokens by all distinct tokens", () => {
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]))).toBe(0.5);
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
  });

  it("never exceeds the size bound used to skip pairs", () => {
    expect(canReachThreshold(4, 5, 0.8)).toBe(true);
    expect(canReachThreshold(4, 5, 0.81)).toBe(false);
    // 7 < 0.28 * 25 in floating point, so a multiplied bound would wrongly skip this exact match.
    expect(canReachThreshold(7, 25, 0.28)).toBe(true);
    const tokens = (count: number) => new Set(Array.from({ length: count }, (_, index) => `t${index}`));
    expect(jaccard(tokens(7), tokens(25))).toBe(0.28);
    expect(canReachThreshold(9, 3, 0.34)).toBe(false);
    expect(canReachThreshold(0, 0, 0.5)).toBe(true);
    expect(canReachThreshold(0, 3, 0)).toBe(true);
  });
});

describe("trace link direction", () => {
  const linkedFromOtherSide = {
    requirements: [
      requirement({ id: "req_1", externalId: "REQ-1", status: "Draft", text: "The system shall display an error within 2 seconds.", verificationMethod: "Test" }),
      requirement({ id: "req_2", externalId: "REQ-2", status: "Approved", text: "The system shall log the error within 2 seconds.", verificationMethod: "Test" })
    ],
    workItems: [workItem({ status: "Done" })],
    testCases: [testCase({ id: "test_1", status: "passed" }), testCase({ id: "test_2", status: "failed" })],
    traceLinks: [
      traceLink({ id: "l1", sourceType: "workItem", sourceId: "work_1", targetType: "requirement", targetId: "req_1", linkType: "implements" }),
      traceLink({ id: "l2", sourceType: "requirement", sourceId: "req_2", targetType: "workItem", targetId: "work_1", linkType: "implements" }),
      traceLink({ id: "l3", sourceType: "testCase", sourceId: "test_1", targetType: "requirement", targetId: "req_1" }),
      traceLink({ id: "l4", sourceType: "requirement", sourceId: "req_2", targetType: "testCase", targetId: "test_2" }),
      traceLink({ id: "l5", sourceType: "requirement", sourceId: "req_1", targetType: "requirement", targetId: "req_2", linkType: "parent" })
    ]
  };

  it("treats links recorded in either direction as the same trace", () => {
    expect(findMissingWorkTrace(linkedFromOtherSide)).toEqual([]);
    expect(findMissingVerification(linkedFromOtherSide).map((finding) => finding.title)).toEqual([
      "REQ-2 has no passing linked test evidence"
    ]);

    const closed = findClosedWorkWithoutVerification(linkedFromOtherSide);
    expect(closed).toHaveLength(1);
    expect(closed[0].description).toBe("Closed work is linked to requirements without passing test evidence: REQ-2.");

    expect(findPossibleStaleLinks(linkedFromOtherSide).map((finding) => finding.title)).toEqual([
      "ENG-1 may be stale for REQ-1"
    ]);
  });

  it("ignores links to records that are not in the project", () => {
    const input = {
      ...linkedFromOtherSide,
      traceLinks: [traceLink({ id: "l9", sourceType: "workItem", sourceId: "work_1", targetType: "requirement", targetId: "req_missing" })]
    };

    expect(findClosedWorkWithoutVerification(input)).toEqual([]);
    expect(findPossibleStaleLinks(input)).toEqual([]);
  });
});

describe("status matching", () => {
  it("ignores case and blank entries in the configured status lists", () => {
    expect(isClosedWith("done", ["Done", "Closed"])).toBe(true);
    expect(isClosedWith(" CLOSED ", ["closed"])).toBe(true);
    expect(isClosedWith("In Progress", ["Done", ""])).toBe(false);
    expect(isDraftOrChangedWith("Changed by review", ["Changed"])).toBe(true);
    expect(isDraftOrChangedWith("Approved", ["", "  "])).toBe(false);
  });
});
