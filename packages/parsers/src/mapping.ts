import { parse } from "csv-parse/sync";
import type { JiraCsvMapping, RequirementsCsvMapping } from "./types";

/** Read just the header row of a CSV as an ordered list of column names. */
export function readCsvHeaders(input: string): string[] {
  const rows = parse(input, {
    bom: true,
    to_line: 1,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true
  }) as string[][];
  return rows[0] ?? [];
}

/** The first rows of a CSV, parsed with the same settings as the importers. */
export interface CsvPreview {
  headers: string[];
  /** Up to `maxRows` data rows; cells are positional, so read them by index. */
  rows: string[][];
  /** Data rows in the file, not counting the header or blank rows. */
  totalRows: number;
}

/**
 * Parse a CSV for display before import. Uses the importer's csv-parse settings
 * (BOM stripping, quoted multi-line cells, "" escapes, trimming) so the preview
 * matches what will be saved. Throws the csv-parse error for malformed input.
 */
export function readCsvPreview(input: string, maxRows = 5): CsvPreview {
  const records = parse(input, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true
  }) as string[][];
  const [headers = [], ...dataRows] = records;
  const rows = dataRows.filter((row) => row.some((cell) => cell !== ""));

  return {
    headers,
    rows: rows.slice(0, Math.max(0, maxRows)),
    totalRows: rows.length
  };
}

/**
 * Detect a CSV saved with semicolons or tabs between columns: the comma parser
 * then sees a single header that still contains the real separator.
 */
export function detectNonCommaDelimiter(headers: string[]): "semicolon" | "tab" | null {
  if (headers.length !== 1) {
    return null;
  }

  const [header] = headers;
  if (header.includes("\t")) {
    return "tab";
  }

  return header.includes(";") ? "semicolon" : null;
}

/** How much of a file {@link detectCsvDelimiter} reads while looking for the end of the header row. */
const DELIMITER_SCAN_CHARS = 64 * 1024;

/**
 * Detect a CSV saved with semicolons or tabs between columns by scanning the
 * raw header row, outside double quotes. Unlike {@link detectNonCommaDelimiter}
 * this needs no comma parse, so it also works when the file has quoted cells
 * such as `"Text; more"` that make the comma parser fail first.
 */
export function detectCsvDelimiter(input: string): "semicolon" | "tab" | null {
  let inQuotes = false;
  let seenContent = false;
  let semicolons = 0;
  let tabs = 0;
  const end = Math.min(input.length, DELIMITER_SCAN_CHARS);

  for (let index = input.charCodeAt(0) === 0xfeff ? 1 : 0; index < end; index += 1) {
    const char = input[index];
    if (char === '"') {
      inQuotes = !inQuotes;
      seenContent = true;
    } else if (inQuotes) {
      continue;
    } else if (char === "\n" || char === "\r") {
      if (seenContent) {
        break;
      }
      // A line with only separators or spaces before the header says nothing about the header.
      semicolons = 0;
      tabs = 0;
    } else if (char === ",") {
      return null;
    } else if (char === "\t") {
      tabs += 1;
    } else if (char === ";") {
      semicolons += 1;
    } else if (char.trim() !== "") {
      seenContent = true;
    }
  }

  if (tabs > 0) {
    return "tab";
  }

  return semicolons > 0 ? "semicolon" : null;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface MatchOptions {
  /**
   * Also accept headers that merely contain an alias (default true). Turn it
   * off for identifier fields, where "Issue id" or "Custom field (Requirement
   * IDs)" containing "id" does not make the column a requirement ID.
   */
  partial?: boolean;
}

/**
 * Find the first header whose normalized form matches one of the given aliases.
 * Exact alias matches win over substring (`includes`) matches.
 */
function matchHeader(headers: string[], aliases: string[], options: MatchOptions = {}): string | undefined {
  const normalized = headers.map((header) => ({ header, key: normalizeHeader(header) }));

  for (const alias of aliases) {
    const exact = normalized.find((entry) => entry.key === alias);
    if (exact) {
      return exact.header;
    }
  }

  if (options.partial === false) {
    return undefined;
  }

  for (const alias of aliases) {
    const partial = normalized.find((entry) => entry.key.includes(alias));
    if (partial) {
      return partial.header;
    }
  }

  return undefined;
}

/** Normalized headers (lowercase letters and digits only) accepted as the requirement ID column. */
const REQUIREMENT_ID_ALIASES = [
  "id",
  "reqid",
  "requirementid",
  "identifier",
  "requirementidentifier",
  "objectidentifier",
  "key",
  "requirementkey",
  "requirementnumber",
  "reqno",
  "uniqueid",
  "globalid",
  "itemid"
];

/** Normalized headers accepted as the parent requirement ID column. */
const PARENT_ID_ALIASES = [
  "parentid",
  "parent",
  "parentkey",
  "parentrequirement",
  "parentrequirementid",
  "parentreqid",
  "parentids",
  "parents",
  "parentrequirements",
  "derivedfrom"
];

/** Best-effort inference of a requirements CSV column mapping from headers. */
export function inferRequirementsCsvMapping(headers: string[]): Partial<RequirementsCsvMapping> {
  const mapping: Partial<RequirementsCsvMapping> = {};

  // Identifier columns match exactly, so a Jira export's "Issue id", "Parent id", or
  // "Custom field (Requirement IDs)" is never taken for the requirement ID.
  const id = matchHeader(headers, REQUIREMENT_ID_ALIASES, { partial: false });
  if (id) mapping.requirementId = id;

  const title = matchHeader(headers, ["title", "name", "summary", "heading"]);
  if (title) mapping.title = title;

  const text = matchHeader(headers, ["text", "description", "statement", "requirementtext", "body"]);
  if (text) mapping.text = text;

  const status = matchHeader(headers, ["status", "state"]);
  if (status) mapping.status = status;

  const type = matchHeader(headers, ["type", "category", "kind"]);
  if (type) mapping.type = type;

  const priority = matchHeader(headers, ["priority", "severity", "criticality"]);
  if (priority) mapping.priority = priority;

  const verification = matchHeader(headers, ["verificationmethod", "verification", "verifymethod", "verifiedby"]);
  if (verification) mapping.verificationMethod = verification;

  const parent = matchHeader(headers, PARENT_ID_ALIASES, { partial: false });
  if (parent) mapping.parentId = parent;

  return mapping;
}

/** Best-effort inference of a Jira CSV column mapping from headers. */
export function inferJiraCsvMapping(headers: string[]): Partial<JiraCsvMapping> {
  const mapping: Partial<JiraCsvMapping> = {};

  const key = matchHeader(headers, ["key", "issuekey", "id"]);
  if (key) mapping.issueKey = key;

  const summary = matchHeader(headers, ["summary", "title", "name"]);
  if (summary) mapping.summary = summary;

  const description = matchHeader(headers, ["description", "text", "details"]);
  if (description) mapping.description = description;

  const status = matchHeader(headers, ["status", "state"]);
  if (status) mapping.status = status;

  const issueType = matchHeader(headers, ["issuetype", "type"]);
  if (issueType) mapping.issueType = issueType;

  const assignee = matchHeader(headers, ["assignee", "owner", "responsible"]);
  if (assignee) mapping.assignee = assignee;

  const requirementIds = matchHeader(headers, ["requirementids", "requirementid", "requirements", "traces"]);
  if (requirementIds) mapping.requirementIds = requirementIds;

  return mapping;
}
