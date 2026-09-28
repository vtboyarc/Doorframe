import { describe, expect, it } from "vitest";
import type { ParsedRequirement, ParsedWorkItem } from "@doorframe/parsers";
import {
  blankUnmappedJiraFields,
  blankUnmappedRequirementFields,
  countCreatedAndUpdated,
  missingExternalIds,
  parseClientMapping,
  parseRemoveRecordsRequest,
  summarizeMissing
} from "./import-records";
import { MAX_REMOVABLE_RECORDS } from "./import-types";

describe("countCreatedAndUpdated", () => {
  it("splits imported IDs into new and updated records", () => {
    expect(countCreatedAndUpdated(new Set(["REQ-001", "REQ-002"]), ["REQ-002", "REQ-003", "REQ-003"])).toEqual({
      recordCount: 2,
      createdCount: 1,
      updatedCount: 1
    });
  });
});

describe("missingExternalIds", () => {
  it("returns earlier IDs that are not in the new file, in natural order", () => {
    expect(missingExternalIds(["REQ-10", "REQ-2", "REQ-1", "REQ-3"], ["REQ-3"])).toEqual(["REQ-1", "REQ-2", "REQ-10"]);
  });

  it("returns nothing when the file contains every earlier record", () => {
    expect(missingExternalIds(["REQ-1"], ["REQ-1", "REQ-2"])).toEqual([]);
  });
});

describe("summarizeMissing", () => {
  it("reports the full count and caps the IDs", () => {
    const ids = Array.from({ length: 5 }, (_, index) => `REQ-${index + 1}`);
    expect(summarizeMissing("requirement", ids, 10, 3)).toEqual({
      entityType: "requirement",
      count: 5,
      externalIds: ["REQ-1", "REQ-2", "REQ-3"]
    });
  });

  it("never reports missing records when nothing was imported", () => {
    expect(summarizeMissing("requirement", ["REQ-1"], 0)).toBeNull();
    expect(summarizeMissing("workItem", [], 4)).toBeNull();
  });
});

describe("parseClientMapping", () => {
  it("keeps string values only", () => {
    expect(parseClientMapping(JSON.stringify({ requirementId: "ID", title: "", bad: 3 }))).toEqual({
      requirementId: "ID",
      title: ""
    });
  });

  it("ignores missing or malformed mappings", () => {
    expect(parseClientMapping(null)).toEqual({});
    expect(parseClientMapping("{not json")).toEqual({});
    expect(parseClientMapping("[1,2]")).toEqual({});
  });
});

const requirement: ParsedRequirement = {
  externalId: "REQ-001",
  title: "Sensor status display",
  text: "The system shall display sensor status.",
  source: "requirements-csv",
  status: "Approved",
  type: "Functional",
  priority: "High",
  verificationMethod: "Test",
  parentExternalId: "REQ-000"
};

describe("blankUnmappedRequirementFields", () => {
  it("blanks optional fields the form set to Not imported", () => {
    const [record] = blankUnmappedRequirementFields([requirement], {
      requirementId: "ID",
      text: "Text",
      title: "",
      status: "",
      type: "",
      priority: "",
      verificationMethod: "",
      parentId: ""
    });

    expect(record).toMatchObject({
      externalId: "REQ-001",
      title: "REQ-001",
      text: requirement.text,
      status: undefined,
      type: undefined,
      priority: undefined,
      verificationMethod: undefined,
      parentExternalId: undefined
    });
  });

  it("keeps fields that were mapped or not sent", () => {
    const [record] = blankUnmappedRequirementFields([requirement], { status: "Status" });
    expect(record).toEqual(requirement);
  });
});

describe("blankUnmappedJiraFields", () => {
  const workItem: ParsedWorkItem = {
    externalId: "FG-12",
    title: "Implement telemetry status panel",
    description: "Implements REQ-001.",
    status: "Done",
    type: "Story",
    assignee: "Avery Chen",
    source: "jira-csv",
    requirementIds: ["REQ-001"]
  };

  it("blanks optional Jira fields but keeps detected requirement IDs", () => {
    const [record] = blankUnmappedJiraFields([workItem], {
      issueKey: "Issue key",
      summary: "",
      description: "",
      status: "",
      issueType: "",
      assignee: "",
      requirementIds: ""
    });

    expect(record).toMatchObject({
      externalId: "FG-12",
      title: "FG-12",
      description: undefined,
      status: undefined,
      type: undefined,
      assignee: undefined,
      requirementIds: ["REQ-001"]
    });
  });
});

describe("parseRemoveRecordsRequest", () => {
  it("accepts IDs longer than 500 characters, such as parameterized JUnit test IDs", () => {
    const fields = Array.from({ length: 30 }, (_, index) => `field${index}=value${index}`).join(",");
    const longId = `com.example.gateway.telemetry.ParameterizedFrameDecoderTests.testDecodesTelemetryFrame[${fields}]`;

    expect(longId.length).toBeGreaterThan(500);
    expect(parseRemoveRecordsRequest({ entityType: "testCase", externalIds: [longId, "short.test"] })).toEqual({
      entityType: "testCase",
      externalIds: [longId, "short.test"]
    });
  });

  it("keeps IDs exactly as sent so they match the stored IDs", () => {
    expect(parseRemoveRecordsRequest({ entityType: "requirement", externalIds: [" REQ-1 "] })?.externalIds).toEqual([
      " REQ-1 "
    ]);
  });

  it("rejects malformed requests", () => {
    expect(parseRemoveRecordsRequest(null)).toBeNull();
    expect(parseRemoveRecordsRequest({ entityType: "baseline", externalIds: ["REQ-1"] })).toBeNull();
    expect(parseRemoveRecordsRequest({ entityType: "requirement", externalIds: [] })).toBeNull();
    expect(parseRemoveRecordsRequest({ entityType: "requirement", externalIds: [""] })).toBeNull();
    expect(parseRemoveRecordsRequest({ entityType: "requirement", externalIds: [42] })).toBeNull();
    expect(
      parseRemoveRecordsRequest({
        entityType: "requirement",
        externalIds: Array.from({ length: MAX_REMOVABLE_RECORDS + 1 }, (_, index) => `REQ-${index}`)
      })
    ).toBeNull();
  });
});
