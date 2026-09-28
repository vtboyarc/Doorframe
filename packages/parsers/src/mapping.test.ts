import { describe, expect, it } from "vitest";
import {
  detectCsvDelimiter,
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

  it("does not take Jira identifier columns for the requirement ID", () => {
    const mapping = inferRequirementsCsvMapping([
      "Summary",
      "Issue key",
      "Issue id",
      "Parent id",
      "Issue Type",
      "Status",
      "Assignee",
      "Labels",
      "Description",
      "Custom field (Requirement IDs)"
    ]);

    expect(mapping.requirementId).toBeUndefined();
    expect(mapping.title).toBe("Summary");
    expect(mapping.text).toBe("Description");
  });

  it("leaves the requirement ID unmapped for the Falcon Jira sample headers", () => {
    const mapping = inferRequirementsCsvMapping(
      readCsvHeaders(
        "Issue key,Summary,Description,Status,Issue Type,Assignee,Labels,Fix Version/s,Components,Custom field (Requirement IDs)\n"
      )
    );

    expect(mapping.requirementId).toBeUndefined();
    expect(mapping.parentId).toBeUndefined();
  });

  it("matches identifier columns exactly, not by substring", () => {
    expect(inferRequirementsCsvMapping(["Requirement IDs", "Text"]).requirementId).toBeUndefined();
    expect(inferRequirementsCsvMapping(["Work item id", "Text"]).requirementId).toBeUndefined();
    expect(inferRequirementsCsvMapping(["Parent Requirement ID", "Text"]).requirementId).toBeUndefined();
    expect(inferRequirementsCsvMapping(["Req ID", "Text"]).requirementId).toBe("Req ID");
    expect(inferRequirementsCsvMapping(["REQ_ID", "Text"]).requirementId).toBe("REQ_ID");
    expect(inferRequirementsCsvMapping(["Object Identifier", "Text"]).requirementId).toBe("Object Identifier");
    expect(inferRequirementsCsvMapping(["Unique ID", "Text"]).requirementId).toBe("Unique ID");
    expect(inferRequirementsCsvMapping(["Item ID", "Text"]).requirementId).toBe("Item ID");
    expect(inferRequirementsCsvMapping(["Global ID", "ID", "Text"]).requirementId).toBe("ID");
  });

  it("matches common parent columns exactly", () => {
    expect(inferRequirementsCsvMapping(["ID", "Parent Requirement ID"]).parentId).toBe("Parent Requirement ID");
    expect(inferRequirementsCsvMapping(["ID", "Parent Key"]).parentId).toBe("Parent Key");
    expect(inferRequirementsCsvMapping(["ID", "Parent IDs"]).parentId).toBe("Parent IDs");
    expect(inferRequirementsCsvMapping(["ID", "Parent Requirements"]).parentId).toBe("Parent Requirements");
    expect(inferRequirementsCsvMapping(["ID", "Parent summary"]).parentId).toBeUndefined();
    expect(inferRequirementsCsvMapping(["ID", "Parent link type"]).parentId).toBeUndefined();
  });

  it("maps the Falcon requirements sample headers as before", () => {
    const mapping = inferRequirementsCsvMapping(
      readCsvHeaders("ID,Title,Text,Status,Type,Priority,Verification Method,Parent ID\n")
    );

    expect(mapping).toEqual({
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

describe("detectCsvDelimiter", () => {
  it("detects semicolon files whose cells are quoted, which the comma parser rejects", () => {
    const quotedCell = 'ID;Title;Text;Status\nSYS-010;Semi one;Plain text;Draft\nSYS-011;Semi two;"The system shall export; with semicolons";Draft\n';
    const allQuoted = '"ID";"Title";"Text"\n"SYS-1";"A";"The system shall log, then retry."\n';

    expect(() => readCsvPreview(quotedCell)).toThrow();
    expect(detectCsvDelimiter(quotedCell)).toBe("semicolon");
    expect(detectCsvDelimiter(allQuoted)).toBe("semicolon");
  });

  it("detects tab separated files", () => {
    expect(detectCsvDelimiter('ID\tTitle\tText\nREQ-1\tA\t"B\tC"\n')).toBe("tab");
  });

  it("ignores separators inside quoted header cells and skips a byte-order mark and blank lines", () => {
    expect(detectCsvDelimiter('\uFEFF\r\n\r\nID;"Title, short";Text\n')).toBe("semicolon");
    expect(detectCsvDelimiter("\t\t\nID;Title;Text\n")).toBe("semicolon");
    expect(detectCsvDelimiter('ID,"Title; notes",Text\nREQ-1,A;B,C\n')).toBeNull();
  });

  it("returns null for comma separated files and single plain columns", () => {
    expect(detectCsvDelimiter("ID,Title,Text\nREQ-1;x,A,B\n")).toBeNull();
    expect(detectCsvDelimiter("ID\nREQ-1\n")).toBeNull();
    expect(detectCsvDelimiter("")).toBeNull();
  });

  it("reads only the header row", () => {
    expect(detectCsvDelimiter("ID\nREQ-1;A;B\n")).toBeNull();
  });
});
