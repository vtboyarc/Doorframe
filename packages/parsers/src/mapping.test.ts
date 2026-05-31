import { describe, expect, it } from "vitest";
import { inferJiraCsvMapping, inferRequirementsCsvMapping, readCsvHeaders } from "./mapping";

describe("readCsvHeaders", () => {
  it("reads the header row only", () => {
    const headers = readCsvHeaders("ID,Title,Text\nREQ-1,A,B\nREQ-2,C,D");
    expect(headers).toEqual(["ID", "Title", "Text"]);
  });
});

describe("inferRequirementsCsvMapping", () => {
  it("matches canonical headers", () => {
    const mapping = inferRequirementsCsvMapping([
      "ID",
      "Title",
      "Text",
      "Status",
      "Type",
      "Priority",
      "Verification Method",
      "Parent ID"
    ]);
    expect(mapping).toMatchObject({
      requirementId: "ID",
      title: "Title",
      text: "Text",
      status: "Status",
      type: "Type",
      priority: "Priority",
      verificationMethod: "Verification Method",
      parentId: "Parent ID"
    });
  });

  it("matches alias and reworded headers", () => {
    const mapping = inferRequirementsCsvMapping([
      "Requirement ID",
      "Name",
      "Description",
      "State",
      "Category",
      "Severity",
      "Verified By",
      "Derived From"
    ]);
    expect(mapping.requirementId).toBe("Requirement ID");
    expect(mapping.title).toBe("Name");
    expect(mapping.text).toBe("Description");
    expect(mapping.status).toBe("State");
    expect(mapping.priority).toBe("Severity");
    expect(mapping.verificationMethod).toBe("Verified By");
    expect(mapping.parentId).toBe("Derived From");
  });
});

describe("inferJiraCsvMapping", () => {
  it("matches typical Jira export headers", () => {
    const mapping = inferJiraCsvMapping([
      "Key",
      "Summary",
      "Description",
      "Status",
      "Issue Type",
      "Assignee",
      "Requirement IDs"
    ]);
    expect(mapping).toMatchObject({
      issueKey: "Key",
      summary: "Summary",
      description: "Description",
      status: "Status",
      issueType: "Issue Type",
      assignee: "Assignee",
      requirementIds: "Requirement IDs"
    });
  });
});
