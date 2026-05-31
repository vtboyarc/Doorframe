import { describe, expect, it } from "vitest";
import type { RequirementInput } from "@doorframe/core";
import { compareRequirementBaselines } from "./baseline-diff";

function req(externalId: string, text: string, overrides: Partial<RequirementInput> = {}): RequirementInput {
  return {
    externalId,
    title: externalId,
    text,
    source: "requirements-csv",
    status: "Approved",
    priority: "Medium",
    verificationMethod: "Test",
    ...overrides
  };
}

describe("compareRequirementBaselines", () => {
  it("detects added, deleted, changed, and unchanged requirements", () => {
    const result = compareRequirementBaselines({
      baselineAName: "a",
      baselineBName: "b",
      requirementsA: [
        req("REQ-001", "The system shall display status within 2 seconds."),
        req("REQ-002", "The system shall log failures within 2 seconds."),
        req("REQ-003", "The system shall export a report within 60 seconds.")
      ],
      requirementsB: [
        req("REQ-001", "The system shall display status within 1 second."),
        req("REQ-002", "The system shall log failures within 2 seconds."),
        req("REQ-004", "The system shall show import warnings within 2 seconds.")
      ]
    });

    expect(result.summary).toMatchObject({
      added: 1,
      deleted: 1,
      changed: 1,
      unchanged: 1
    });
    expect(result.added.map((requirement) => requirement.externalId)).toEqual(["REQ-004"]);
    expect(result.deleted.map((requirement) => requirement.externalId)).toEqual(["REQ-003"]);
    expect(result.changed[0]?.externalId).toBe("REQ-001");
  });

  it("flags numeric threshold changes as high concern", () => {
    const result = compareRequirementBaselines({
      baselineAName: "a",
      baselineBName: "b",
      requirementsA: [req("REQ-014", "The system shall process telemetry packets within 5 seconds.")],
      requirementsB: [req("REQ-014", "The system shall process telemetry packets within 2 seconds.")],
      testCases: [
        {
          externalId: "TelemetryPacketProcessorTests.testPacketProcessedWithinFiveSeconds_REQ_014",
          name: "testPacketProcessedWithinFiveSeconds_REQ_014",
          status: "passed",
          requirementIds: ["REQ-014"]
        }
      ]
    });

    expect(result.changed[0]?.concern).toBe("high");
    expect(result.changed[0]?.concernReasons.join("\n")).toContain("numeric timing or threshold");
  });

  it("surfaces affected work items and tests when context is provided", () => {
    const result = compareRequirementBaselines({
      baselineAName: "a",
      baselineBName: "b",
      requirementsA: [req("REQ-014", "The system shall process telemetry packets within 5 seconds.")],
      requirementsB: [req("REQ-014", "The system shall process telemetry packets within 2 seconds.")],
      workItems: [{ externalId: "FG-27", title: "Update timing", status: "Done", requirementIds: ["REQ-014"] }],
      testCases: [{ externalId: "T1", name: "testPacketProcessedWithinFiveSeconds_REQ_014", status: "failed", requirementIds: ["REQ-014"] }]
    });

    expect(result.changed[0]?.affectedWorkItems).toEqual(["FG-27"]);
    expect(result.changed[0]?.affectedTests).toEqual(["testPacketProcessedWithinFiveSeconds_REQ_014 (failed)"]);
  });
});
