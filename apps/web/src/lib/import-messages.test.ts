import { describe, expect, it } from "vitest";
import { parseRequirementsCsv, readCsvPreview } from "@doorframe/parsers";
import {
  delimiterMessage,
  describeEmptyImport,
  describeImportFailure,
  fileTooLargeMessage,
  friendlyParserMessage,
  importSummaryText,
  missingRecordsText,
  NO_CSV_ROWS_MESSAGE,
  removedSummaryText,
  removeMissingLabel,
  unexpectedResponseMessage
} from "./import-messages";
import type { ImportResponse } from "./import-types";

function thrownBy(work: () => unknown): unknown {
  try {
    work();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to throw.");
}

const result: ImportResponse = {
  status: "imported",
  sourceType: "requirements-csv",
  entityType: "requirement",
  filename: "requirements.csv",
  recordCount: 42,
  createdCount: 1,
  updatedCount: 41,
  linkCount: 3,
  findingCount: 12,
  errors: [],
  missing: null
};

describe("import result text", () => {
  it("describes updated and new records, links, and the project finding total", () => {
    expect(importSummaryText(result)).toBe(
      "Imported 42 requirements (41 updated, 1 new) from requirements.csv. Created 3 trace links. The project now has 12 findings."
    );
  });

  it("uses singular nouns and says when no links were created", () => {
    expect(
      importSummaryText({
        ...result,
        entityType: "testCase",
        recordCount: 1,
        createdCount: 1,
        updatedCount: 0,
        linkCount: 0,
        findingCount: 1
      })
    ).toBe("Imported 1 test case (1 new) from requirements.csv. No new trace links. The project now has 1 finding.");
  });

  it("lists missing records and labels the remove action", () => {
    expect(missingRecordsText({ entityType: "requirement", count: 1, externalIds: ["REQ-042"] })).toBe(
      "1 requirement from earlier imports is not in this file: REQ-042."
    );
    expect(removeMissingLabel(1)).toBe("Remove it");
    expect(removeMissingLabel(3)).toBe("Remove these 3");
  });

  it("lists at most 50 missing IDs", () => {
    const ids = Array.from({ length: 60 }, (_, index) => `FG-${index + 1}`);
    const text = missingRecordsText({ entityType: "workItem", count: 60, externalIds: ids });
    expect(text).toMatch(/^60 work items from earlier imports are not in this file: FG-1, /);
    expect(text).toMatch(/FG-50, and 10 more\.$/);
  });

  it("summarizes a removal", () => {
    expect(
      removedSummaryText({
        entityType: "requirement",
        removedCount: 1,
        removedExternalIds: ["REQ-042"],
        removedLinkCount: 2,
        findingCount: 40
      })
    ).toBe("Removed 1 requirement (REQ-042) and 2 trace links. The project now has 40 findings.");
  });
});

describe("describeEmptyImport", () => {
  it("gives a type-specific message", () => {
    expect(describeEmptyImport("junit-xml", []).message).toBe("No test cases found. Is this a JUnit XML file?");
    expect(describeEmptyImport("reqif", []).message).toBe("No requirements found. Is this a ReqIF file?");
    expect(describeEmptyImport("requirements-csv", [], 0).message).toBe(NO_CSV_ROWS_MESSAGE);
  });

  it("explains an unreadable ReqIF file and keeps the parser text as detail", () => {
    const failure = describeEmptyImport("reqif", ["ReqIF XML parse failed: Unexpected end"]);
    expect(failure.message).toMatch(/could not be read as XML/);
    expect(failure.detail).toBe("ReqIF XML parse failed: Unexpected end");
  });

  it("points at the mapping when a required CSV column is missing", () => {
    expect(describeEmptyImport("jira-csv", ["Missing required Jira CSV column for issue key."], 3).message).toBe(
      "No column is mapped to Issue key. Check the column mapping and try again."
    );
    expect(
      describeEmptyImport(
        "requirements-csv",
        [
          "Missing required requirements CSV column for requirement ID.",
          "Missing required requirements CSV column for requirement text."
        ],
        3
      ).message
    ).toBe("No column is mapped to Requirement ID or Text. Check the column mapping and try again.");
  });
});

describe("friendlyParserMessage", () => {
  it("rewrites the empty requirement ID schema message", () => {
    const parsed = parseRequirementsCsv("ID,Title,Text\n,A,B\nREQ-2,,C\n", { requirementId: "ID", text: "Text" });
    expect(parsed.errors).toHaveLength(1);
    expect(friendlyParserMessage("requirements-csv", parsed.errors[0])).toBe("Row 2: Requirement ID is empty; row skipped.");
  });

  it("names the Jira key for Jira rows and passes other messages through", () => {
    expect(friendlyParserMessage("jira-csv", "Row 7: Too small: expected string to have >=1 characters")).toBe(
      "Row 7: Issue key is empty; row skipped."
    );
    expect(friendlyParserMessage("requirements-csv", "Row 3: duplicate requirement ID REQ-1; keeping the first row.")).toBe(
      "Row 3: duplicate requirement ID REQ-1; keeping the first row."
    );
  });
});

describe("describeImportFailure", () => {
  it("maps csv-parse quote errors to plain language with the line", () => {
    const unclosed = describeImportFailure("requirements-csv", thrownBy(() => readCsvPreview('ID,Text\nREQ-1,"open')));
    expect(unclosed.message).toMatch(/^A quoted cell is never closed near line 2\./);
    expect(unclosed.detail).toMatch(/Quote Not Closed/);

    const opening = describeImportFailure("requirements-csv", thrownBy(() => readCsvPreview('ID,Text\nREQ-1,a"b\n')));
    expect(opening.message).toMatch(/double quote in an unexpected place near line 2/);
  });

  it("explains a file that is not a zip archive", () => {
    const failure = describeImportFailure(
      "reqifz",
      new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/")
    );
    expect(failure.message).toBe("This file is not a ReqIFZ (zip) archive. Choose ReqIF for .reqif files.");
    expect(failure.detail).toMatch(/central directory/);
  });

  it("falls back to an XML message for XML import types", () => {
    expect(describeImportFailure("junit-xml", new Error("readTagExp returned undefined")).message).toMatch(
      /could not be read as XML/
    );
  });
});

describe("other messages", () => {
  it("explains semicolon and tab delimited files", () => {
    expect(delimiterMessage("semicolon")).toBe(
      "This file appears to use semicolons between columns. Save it as comma-separated CSV (UTF-8) and try again."
    );
    expect(delimiterMessage("tab")).toMatch(/use tabs between columns/);
  });

  it("mentions the size limit and the CLI for large files", () => {
    expect(fileTooLargeMessage(30 * 1024 * 1024)).toMatch(/^This file is 30\.0 MB\. The web app imports files up to 25\.0 MB\./);
    expect(fileTooLargeMessage()).toMatch(/doorframe analyze/);
    expect(unexpectedResponseMessage(413)).toMatch(/up to 25\.0 MB/);
    expect(unexpectedResponseMessage(500)).toMatch(/HTTP 500/);
  });
});
