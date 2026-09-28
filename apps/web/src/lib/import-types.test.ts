import { describe, expect, it } from "vitest";
import {
  checkMapping,
  completeMapping,
  entityTypeForSource,
  fileExtension,
  fileTypeHint,
  formatFileSize,
  isImportSourceType,
  jiraExportColumn,
  JIRA_MAPPING_FIELDS,
  REQUIREMENT_MAPPING_FIELDS,
  sourceTypeForFile
} from "./import-types";

describe("sourceTypeForFile", () => {
  it("picks the type from the extension", () => {
    expect(sourceTypeForFile("results.XML", "requirements-csv")).toBe("junit-xml");
    expect(sourceTypeForFile("spec.reqif", "jira-csv")).toBe("reqif");
    expect(sourceTypeForFile("spec.reqifz", "requirements-csv")).toBe("reqifz");
    expect(sourceTypeForFile("spec.zip", "requirements-csv")).toBe("reqifz");
  });

  it("keeps a CSV type for CSV files and defaults to Requirements CSV otherwise", () => {
    expect(sourceTypeForFile("jira.csv", "jira-csv")).toBe("jira-csv");
    expect(sourceTypeForFile("export.csv", "junit-xml")).toBe("requirements-csv");
  });

  it("keeps ReqIF for .xml files and the current type for unknown extensions", () => {
    expect(sourceTypeForFile("spec.xml", "reqif")).toBe("reqif");
    expect(sourceTypeForFile("notes.txt", "jira-csv")).toBe("jira-csv");
  });
});

describe("fileTypeHint", () => {
  it("is null when the extension fits the type", () => {
    expect(fileTypeHint("a.csv", "requirements-csv")).toBeNull();
    expect(fileTypeHint("a.xml", "reqif")).toBeNull();
  });

  it("explains a mismatch", () => {
    expect(fileTypeHint("requirements.csv", "junit-xml")).toBe(
      "This is a .csv file, but JUnit XML imports expect .xml. Check the import type."
    );
    expect(fileTypeHint("README", "reqifz")).toMatch(/^This is a file without an extension, but ReqIFZ imports expect \.reqifz or \.zip/);
  });
});

describe("checkMapping", () => {
  it("requires Requirement ID and Text", () => {
    const check = checkMapping(REQUIREMENT_MAPPING_FIELDS, completeMapping(REQUIREMENT_MAPPING_FIELDS, { title: "Title" }));
    expect(check.missingRequired).toEqual(["Requirement ID", "Text"]);
    expect(check.canImport).toBe(false);
  });

  it("warns about a shared optional column but allows the import", () => {
    const check = checkMapping(JIRA_MAPPING_FIELDS, { issueKey: "Key", summary: "Summary", description: "Summary" });
    expect(check.sharedColumns).toEqual([{ column: "Summary", fields: ["Summary", "Description"], includesRequired: false }]);
    expect(check.canImport).toBe(true);
  });

  it("blocks when a required field shares a column", () => {
    const check = checkMapping(REQUIREMENT_MAPPING_FIELDS, { requirementId: "ID", text: "Text", title: "Text" });
    expect(check.sharedColumns[0]).toMatchObject({ column: "Text", includesRequired: true });
    expect(check.canImport).toBe(false);
  });
});

describe("small helpers", () => {
  it("reads extensions, sizes, and source types", () => {
    expect(fileExtension("Export.CSV")).toBe(".csv");
    expect(fileExtension("archive.tar.gz")).toBe(".gz");
    expect(fileExtension("README")).toBe("");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(isImportSourceType("jira-csv")).toBe(true);
    expect(isImportSourceType("demo")).toBe(false);
    expect(isImportSourceType(["jira-csv"])).toBe(false);
    expect(entityTypeForSource("junit-xml")).toBe("testCase");
    expect(entityTypeForSource("demo")).toBeNull();
  });
});

describe("jiraExportColumn", () => {
  it("finds the Issue key column of a Jira export, however it is spelled", () => {
    expect(
      jiraExportColumn(["Summary", "Issue key", "Issue id", "Parent id", "Issue Type", "Status", "Description"])
    ).toBe("Issue key");
    expect(jiraExportColumn(["ISSUE_KEY", "Summary"])).toBe("ISSUE_KEY");
  });

  it("falls back to other Jira-only columns", () => {
    expect(jiraExportColumn(["Summary", "Issue id", "Description"])).toBe("Issue id");
    expect(jiraExportColumn(["Key", "Summary", "Issue Type"])).toBe("Issue Type");
  });

  it("returns null for requirements files", () => {
    expect(jiraExportColumn(["ID", "Title", "Text", "Status", "Type", "Priority", "Verification Method", "Parent ID"])).toBeNull();
    expect(jiraExportColumn(["Requirement ID", "Description", "Issue notes"])).toBeNull();
    expect(jiraExportColumn([])).toBeNull();
  });
});
