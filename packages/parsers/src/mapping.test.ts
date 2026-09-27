import { describe, expect, it } from "vitest";
import {
  detectNonCommaDelimiter,
  inferJiraCsvMapping,
  inferRequirementsCsvMapping,
  readCsvHeaders,
  readCsvPreview
} from "./mapping";

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

describe("readCsvPreview", () => {
  it("returns headers, the first rows, and the total data row count", () => {
    const rows = Array.from({ length: 7 }, (_, index) => `REQ-${index + 1},Title ${index + 1},Text`);
    const preview = readCsvPreview(["ID,Title,Text", ...rows].join("\n"));

    expect(preview.headers).toEqual(["ID", "Title", "Text"]);
    expect(preview.rows).toHaveLength(5);
    expect(preview.rows[0]).toEqual(["REQ-1", "Title 1", "Text"]);
    expect(preview.totalRows).toBe(7);
  });

  it("keeps quoted multi-line cells and escaped quotes in one cell", () => {
    const preview = readCsvPreview('ID,Text\nREQ-1,"First line\nsecond line"\nREQ-2,"Say ""shall"" once"\n');

    expect(preview.rows).toEqual([
      ["REQ-1", "First line\nsecond line"],
      ["REQ-2", 'Say "shall" once']
    ]);
    expect(preview.totalRows).toBe(2);
  });

  it("keeps duplicate headers as separate positional columns", () => {
    const preview = readCsvPreview("ID,Notes,Notes\nREQ-1,a,b");

    expect(preview.headers).toEqual(["ID", "Notes", "Notes"]);
    expect(preview.rows[0]).toEqual(["REQ-1", "a", "b"]);
  });

  it("strips a UTF-8 byte order mark and skips blank rows", () => {
    const preview = readCsvPreview("\uFEFFID,Text\nREQ-1,A\n,\n\nREQ-2,B\n");

    expect(preview.headers).toEqual(["ID", "Text"]);
    expect(preview.totalRows).toBe(2);
  });

  it("returns no headers for an empty file", () => {
    expect(readCsvPreview("")).toEqual({ headers: [], rows: [], totalRows: 0 });
  });

  it("throws for an unclosed quote", () => {
    expect(() => readCsvPreview('ID,Text\nREQ-1,"open')).toThrow(/Quote Not Closed/);
  });
});

describe("detectNonCommaDelimiter", () => {
  it("detects semicolon and tab separated headers", () => {
    expect(detectNonCommaDelimiter(readCsvHeaders("ID;Title;Text\nREQ-1;A;B"))).toBe("semicolon");
    expect(detectNonCommaDelimiter(readCsvHeaders("ID\tTitle\tText\nREQ-1\tA\tB"))).toBe("tab");
  });

  it("accepts comma separated headers and single plain headers", () => {
    expect(detectNonCommaDelimiter(["ID", "Title; notes"])).toBeNull();
    expect(detectNonCommaDelimiter(["ID"])).toBeNull();
    expect(detectNonCommaDelimiter([])).toBeNull();
  });
});
