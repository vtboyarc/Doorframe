import {
  ENTITY_NOUNS,
  formatFileSize,
  MAX_IMPORT_FILE_BYTES,
  MISSING_IDS_SHOWN,
  type ImportEntityType,
  type ImportResponse,
  type ImportSourceType,
  type MissingRecords,
  type RemoveRecordsResponse
} from "./import-types";

/**
 * Plain-language text for the import flow. Pure functions only, shared by the
 * import API routes and the imports page.
 */

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

export function entityCount(entityType: ImportEntityType, count: number): string {
  const noun = ENTITY_NOUNS[entityType];
  return plural(count, noun.one, noun.many);
}

// Results -------------------------------------------------------------------

/** "Imported 42 requirements (41 updated, 1 new) from file.csv." */
export function importedSentence(result: Pick<
  ImportResponse,
  "entityType" | "recordCount" | "createdCount" | "updatedCount" | "filename"
>): string {
  const parts = [
    result.updatedCount > 0 ? `${result.updatedCount.toLocaleString("en-US")} updated` : null,
    result.createdCount > 0 ? `${result.createdCount.toLocaleString("en-US")} new` : null
  ].filter(Boolean);
  const breakdown = parts.length > 0 ? ` (${parts.join(", ")})` : "";

  return `Imported ${entityCount(result.entityType, result.recordCount)}${breakdown} from ${result.filename}.`;
}

export function linksSentence(linkCount: number): string {
  return linkCount > 0 ? `Created ${plural(linkCount, "trace link")}.` : "No new trace links.";
}

/** The finding count is the project total, not what this import added. */
export function findingsSentence(findingCount: number): string {
  return `The project now has ${plural(findingCount, "finding")}.`;
}

export function importSummaryText(result: ImportResponse): string {
  return [importedSentence(result), linksSentence(result.linkCount), findingsSentence(result.findingCount)].join(" ");
}

/** "1 requirement from earlier imports is not in this file: REQ-042." */
export function missingRecordsText(missing: MissingRecords): string {
  const shown = missing.externalIds.slice(0, MISSING_IDS_SHOWN);
  const verb = missing.count === 1 ? "is" : "are";
  const subject = `${entityCount(missing.entityType, missing.count)} from earlier imports ${verb} not in this file`;

  if (shown.length === 0) {
    return `${subject}.`;
  }

  const more = missing.count - shown.length;
  const list = shown.join(", ");
  return more > 0 ? `${subject}: ${list}, and ${more.toLocaleString("en-US")} more.` : `${subject}: ${list}.`;
}

export function removeMissingLabel(count: number): string {
  return count === 1 ? "Remove it" : `Remove these ${count.toLocaleString("en-US")}`;
}

export function removeConfirmText(missing: MissingRecords): string {
  const noun = ENTITY_NOUNS[missing.entityType];
  const what = missing.count === 1 ? `this ${noun.one}` : `these ${plural(missing.count, noun.one, noun.many)}`;
  return `Remove ${what} and ${missing.count === 1 ? "its" : "their"} trace links from the project? This cannot be undone. Re-importing a file that contains ${missing.count === 1 ? "it" : "them"} adds ${missing.count === 1 ? "it" : "them"} back.`;
}

export function removedSummaryText(result: RemoveRecordsResponse): string {
  const ids =
    result.removedExternalIds.length > 0 && result.removedExternalIds.length <= 5
      ? ` (${result.removedExternalIds.join(", ")})`
      : "";
  const links = result.removedLinkCount > 0 ? ` and ${plural(result.removedLinkCount, "trace link")}` : "";

  return `Removed ${entityCount(result.entityType, result.removedCount)}${ids}${links}. ${findingsSentence(result.findingCount)}`;
}

// Empty and failed imports --------------------------------------------------

export const NO_CSV_ROWS_MESSAGE = "No rows found. Check that the file is a comma-separated CSV with a header row.";

export function delimiterMessage(kind: "semicolon" | "tab"): string {
  const separator = kind === "semicolon" ? "semicolons" : "tabs";
  return `This file appears to use ${separator} between columns. Save it as comma-separated CSV (UTF-8) and try again.`;
}

export function fileTooLargeMessage(bytes?: number): string {
  const size = bytes ? `This file is ${formatFileSize(bytes)}. ` : "";
  return `${size}The web app imports files up to ${formatFileSize(MAX_IMPORT_FILE_BYTES)}. Split the export, or generate the report from very large exports with the Doorframe CLI (doorframe analyze).`;
}

/**
 * Explain an import that finished without saving any record. `csvDataRows` is
 * the number of data rows in a CSV file, when known.
 */
export function describeEmptyImport(
  sourceType: ImportSourceType,
  parserErrors: string[],
  csvDataRows?: number
): FailureDescription {
  const xmlError = parserErrors.find((error) => /ReqIF XML parse failed/i.test(error));

  switch (sourceType) {
    case "junit-xml":
      return { message: "No test cases found. Is this a JUnit XML file?" };
    case "reqif":
      return xmlError
        ? { message: "The file could not be read as XML. Check that it is a complete ReqIF file.", detail: xmlError }
        : { message: "No requirements found. Is this a ReqIF file?" };
    case "reqifz":
      if (parserErrors.some((error) => /no \.reqif file/i.test(error))) {
        return { message: "The archive does not contain a .reqif file. Is this a ReqIFZ archive?" };
      }
      return xmlError
        ? { message: "A .reqif file in the archive could not be read as XML.", detail: xmlError }
        : { message: "No requirements found. Is this a ReqIFZ archive?" };
    case "requirements-csv":
    case "jira-csv": {
      if (csvDataRows === 0) {
        return { message: NO_CSV_ROWS_MESSAGE };
      }

      const missingColumn = parserErrors.find((error) => /^Missing required .* column/i.test(error));
      if (missingColumn) {
        return { message: `${friendlyParserMessage(sourceType, missingColumn)} Check the column mapping and try again.` };
      }

      const noun = sourceType === "jira-csv" ? "work items" : "requirements";
      return { message: `No ${noun} were imported. The messages below list the rows that were skipped.` };
    }
  }
}

const EMPTY_VALUE_ISSUE = /^(Too small: expected string to have >=1 characters|String must contain at least 1 character\(s\))$/;

/** Rewrite known parser messages in plain language; unknown messages pass through. */
export function friendlyParserMessage(sourceType: ImportSourceType, message: string): string {
  if (/^Missing required requirements CSV column for requirement ID\.?$/i.test(message)) {
    return "No column is mapped to Requirement ID.";
  }

  if (/^Missing required requirements CSV column for requirement text\.?$/i.test(message)) {
    return "No column is mapped to Text.";
  }

  if (/^Missing required Jira CSV column for issue key\.?$/i.test(message)) {
    return "No column is mapped to Issue key.";
  }

  const row = /^Row (\d+): (.+)$/.exec(message);
  if (row && (sourceType === "requirements-csv" || sourceType === "jira-csv")) {
    const issues = row[2].split(", ");
    if (issues.every((issue) => EMPTY_VALUE_ISSUE.test(issue))) {
      const field = sourceType === "jira-csv" ? "Issue key" : "Requirement ID";
      return `Row ${row[1]}: ${field} is empty; row skipped.`;
    }
  }

  return message;
}

export function friendlyParserMessages(sourceType: ImportSourceType, messages: string[]): string[] {
  return messages.map((message) => friendlyParserMessage(sourceType, message));
}

export interface FailureDescription {
  message: string;
  detail?: string;
}

function lineHint(text: string): string {
  const line = /at line (\d+)/.exec(text)?.[1];
  return line ? ` near line ${line}` : "";
}

/** Map an error thrown while reading an import file (csv-parse, JSZip, XML) to plain language. */
export function describeImportFailure(sourceType: ImportSourceType, error: unknown): FailureDescription {
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  const text = detail ?? "";

  if (code === "CSV_QUOTE_NOT_CLOSED" || /^Quote Not Closed/i.test(text)) {
    return {
      message: `A quoted cell is never closed${lineHint(text)}. Check the file for a stray double quote (").`,
      detail
    };
  }

  if (code === "CSV_INVALID_OPENING_QUOTE" || /^Invalid Opening Quote/i.test(text)) {
    return {
      message: `A cell contains a double quote in an unexpected place${lineHint(text)}. Cells with quotes must be wrapped in quotes, with each inner quote doubled ("").`,
      detail
    };
  }

  if (
    code === "CSV_INVALID_CLOSING_QUOTE" ||
    code === "CSV_NON_TRIMABLE_CHAR_AFTER_CLOSING_QUOTE" ||
    /^Invalid Closing Quote/i.test(text)
  ) {
    return {
      message: `A quoted cell has extra characters after its closing quote${lineHint(text)}. Check the quoting on that line.`,
      detail
    };
  }

  if (code.startsWith("CSV_")) {
    return { message: "The file could not be read as a comma-separated CSV.", detail };
  }

  if (/is this a zip file|end of central directory/i.test(text)) {
    return { message: "This file is not a ReqIFZ (zip) archive. Choose ReqIF for .reqif files.", detail };
  }

  if (/corrupted zip/i.test(text)) {
    return { message: "The ReqIFZ archive is damaged or incomplete. Export it again and retry.", detail };
  }

  if (sourceType === "junit-xml") {
    return { message: "The file could not be read as XML. Check that it is a complete JUnit XML report.", detail };
  }

  if (sourceType === "reqif" || sourceType === "reqifz") {
    return { message: "The file could not be read as XML. Check that it is a complete ReqIF file.", detail };
  }

  return { message: "The file could not be read. Check that it is a comma-separated CSV with a header row.", detail };
}

// Browser-side failures -----------------------------------------------------

export const SERVER_UNREACHABLE_MESSAGE =
  "Could not reach the local Doorframe server. Check that it is still running, then try again.";

export const FILE_CHANGED_MESSAGE = "The file changed after you chose it. Choose it again and retry.";

/** Message for a response whose body is not the JSON the page expects. */
export function unexpectedResponseMessage(status: number): string {
  if (status === 413) {
    return fileTooLargeMessage();
  }

  return `The local Doorframe server returned an unexpected response (HTTP ${status}). Try again; if it keeps happening, check the server log.`;
}
