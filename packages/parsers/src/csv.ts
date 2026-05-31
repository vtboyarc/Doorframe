import { parse } from "csv-parse/sync";
import {
  normalizeRequirementId,
  type ParseResult,
  type RequirementIdPattern,
  requirementInputSchema,
  workItemInputSchema
} from "@doorframe/core";
import { extractRequirementIds } from "./ids";
import type {
  JiraCsvMapping,
  ParsedRequirement,
  ParsedWorkItem,
  RequirementsCsvMapping
} from "./types";
import {
  inferJiraCsvMapping,
  inferRequirementsCsvMapping,
  readCsvHeaders
} from "./mapping";

type CsvRow = Record<string, string>;

function parseRows(input: string): CsvRow[] {
  return parse(input, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true
  }) as CsvRow[];
}

function blankRow(row: CsvRow): boolean {
  return Object.values(row).every((entry) => String(entry ?? "").trim() === "");
}

function value(row: CsvRow, column: string | undefined): string {
  if (!column) {
    return "";
  }

  return String(row[column] ?? "").trim();
}

function hasColumn(headers: string[], column: string | undefined): boolean {
  if (!column) {
    return false;
  }
  return headers.includes(column);
}

function mergeRequirementsMapping(input: string, mapping: Partial<RequirementsCsvMapping>): {
  headers: string[];
  mapping: RequirementsCsvMapping;
  errors: string[];
} {
  const headers = readCsvHeaders(input);
  const inferred = inferRequirementsCsvMapping(headers);
  const merged = { ...mapping } as RequirementsCsvMapping;

  ([
    "requirementId",
    "title",
    "text",
    "status",
    "type",
    "priority",
    "verificationMethod",
    "parentId"
  ] as (keyof RequirementsCsvMapping)[]).forEach((field) => {
    if (!hasColumn(headers, merged[field]) && inferred[field]) {
      merged[field] = inferred[field];
    }
  });

  const errors: string[] = [];
  if (!hasColumn(headers, merged.requirementId)) {
    errors.push("Missing required requirements CSV column for requirement ID.");
  }
  if (!hasColumn(headers, merged.text)) {
    errors.push("Missing required requirements CSV column for requirement text.");
  }

  return { headers, mapping: merged, errors };
}

function mergeJiraMapping(input: string, mapping: Partial<JiraCsvMapping>): {
  headers: string[];
  mapping: JiraCsvMapping;
  errors: string[];
} {
  const headers = readCsvHeaders(input);
  const inferred = inferJiraCsvMapping(headers);
  const merged = { ...mapping } as JiraCsvMapping;

  ([
    "issueKey",
    "summary",
    "description",
    "status",
    "issueType",
    "assignee",
    "requirementIds"
  ] as (keyof JiraCsvMapping)[]).forEach((field) => {
    if (!hasColumn(headers, merged[field]) && inferred[field]) {
      merged[field] = inferred[field];
    }
  });

  const errors: string[] = [];
  if (!hasColumn(headers, merged.issueKey)) {
    errors.push("Missing required Jira CSV column for issue key.");
  }

  return { headers, mapping: merged, errors };
}

function rawAttributes(row: CsvRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, val]) => [key, val]));
}

export function parseRequirementsCsv(
  input: string,
  mapping: Partial<RequirementsCsvMapping>
): ParseResult<ParsedRequirement> {
  const resolved = mergeRequirementsMapping(input, mapping);
  const rows = parseRows(input);
  const records: ParsedRequirement[] = [];
  const errors: string[] = [...resolved.errors];
  const seen = new Set<string>();

  if (resolved.errors.length > 0) {
    return { records, errors };
  }

  rows.forEach((row, index) => {
    if (blankRow(row)) {
      return;
    }

    const externalId = normalizeRequirementId(value(row, resolved.mapping.requirementId));
    const title = value(row, resolved.mapping.title) || externalId;
    const text = value(row, resolved.mapping.text);

    if (seen.has(externalId)) {
      errors.push(`Row ${index + 2}: duplicate requirement ID ${externalId}; keeping the first row.`);
      return;
    }

    const candidate: ParsedRequirement = {
      externalId,
      title,
      text,
      source: "requirements-csv",
      type: value(row, resolved.mapping.type) || undefined,
      status: value(row, resolved.mapping.status) || undefined,
      priority: value(row, resolved.mapping.priority) || undefined,
      verificationMethod: value(row, resolved.mapping.verificationMethod) || undefined,
      parentExternalId: value(row, resolved.mapping.parentId)
        ? normalizeRequirementId(value(row, resolved.mapping.parentId))
        : undefined,
      rawAttributes: rawAttributes(row)
    };

    const validation = requirementInputSchema.safeParse(candidate);
    if (!validation.success) {
      errors.push(`Row ${index + 2}: ${validation.error.issues.map((issue) => issue.message).join(", ")}`);
      return;
    }

    seen.add(validation.data.externalId);
    records.push(validation.data);
  });

  return { records, errors };
}

export function parseJiraCsv(
  input: string,
  mapping: Partial<JiraCsvMapping>,
  patterns?: RequirementIdPattern[]
): ParseResult<ParsedWorkItem> {
  const resolved = mergeJiraMapping(input, mapping);
  const rows = parseRows(input);
  const records: ParsedWorkItem[] = [];
  const errors: string[] = [...resolved.errors];
  const seen = new Set<string>();

  if (resolved.errors.length > 0) {
    return { records, errors };
  }

  rows.forEach((row, index) => {
    if (blankRow(row)) {
      return;
    }

    const externalId = value(row, resolved.mapping.issueKey).toUpperCase();
    const title = value(row, resolved.mapping.summary) || externalId;
    const description = value(row, resolved.mapping.description);
    const mappedIds = extractRequirementIds(value(row, resolved.mapping.requirementIds), patterns);
    const searchableRawFields = Object.entries(row)
      .filter(([key]) => /label|component|fix\s*version|custom\s*field|requirement|trace/i.test(key))
      .map(([, val]) => val)
      .join("\n");
    const detectedIds = extractRequirementIds(`${title}\n${description}\n${searchableRawFields}`, patterns);

    if (seen.has(externalId)) {
      errors.push(`Row ${index + 2}: duplicate Jira issue key ${externalId}; keeping the first row.`);
      return;
    }

    const candidate: ParsedWorkItem = {
      externalId,
      title,
      description,
      status: value(row, resolved.mapping.status) || undefined,
      type: value(row, resolved.mapping.issueType) || undefined,
      assignee: value(row, resolved.mapping.assignee) || undefined,
      source: "jira-csv",
      rawAttributes: rawAttributes(row),
      requirementIds: Array.from(new Set([...mappedIds, ...detectedIds]))
    };

    const validation = workItemInputSchema.safeParse(candidate);
    if (!validation.success) {
      errors.push(`Row ${index + 2}: ${validation.error.issues.map((issue) => issue.message).join(", ")}`);
      return;
    }

    seen.add(candidate.externalId);
    records.push(candidate);
  });

  return { records, errors };
}
