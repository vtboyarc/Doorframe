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

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Find the first header whose normalized form matches one of the given aliases.
 * Exact alias matches win over substring (`includes`) matches.
 */
function matchHeader(headers: string[], aliases: string[]): string | undefined {
  const normalized = headers.map((header) => ({ header, key: normalizeHeader(header) }));

  for (const alias of aliases) {
    const exact = normalized.find((entry) => entry.key === alias);
    if (exact) {
      return exact.header;
    }
  }

  for (const alias of aliases) {
    const partial = normalized.find((entry) => entry.key.includes(alias));
    if (partial) {
      return partial.header;
    }
  }

  return undefined;
}

/** Best-effort inference of a requirements CSV column mapping from headers. */
export function inferRequirementsCsvMapping(headers: string[]): Partial<RequirementsCsvMapping> {
  const mapping: Partial<RequirementsCsvMapping> = {};

  const id = matchHeader(headers, ["id", "reqid", "requirementid", "identifier", "key"]);
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

  const parent = matchHeader(headers, ["parentid", "parent", "parentkey", "derivedfrom"]);
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
