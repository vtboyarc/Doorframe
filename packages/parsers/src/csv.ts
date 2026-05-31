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

function value(row: CsvRow, column: string | undefined): string {
  if (!column) {
    return "";
  }

  return String(row[column] ?? "").trim();
}

function rawAttributes(row: CsvRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, val]) => [key, val]));
}

export function parseRequirementsCsv(
  input: string,
  mapping: RequirementsCsvMapping
): ParseResult<ParsedRequirement> {
  const rows = parseRows(input);
  const records: ParsedRequirement[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const externalId = normalizeRequirementId(value(row, mapping.requirementId));
    const title = value(row, mapping.title) || externalId;
    const text = value(row, mapping.text);

    const candidate: ParsedRequirement = {
      externalId,
      title,
      text,
      source: "requirements-csv",
      type: value(row, mapping.type) || undefined,
      status: value(row, mapping.status) || undefined,
      priority: value(row, mapping.priority) || undefined,
      verificationMethod: value(row, mapping.verificationMethod) || undefined,
      parentExternalId: value(row, mapping.parentId)
        ? normalizeRequirementId(value(row, mapping.parentId))
        : undefined,
      rawAttributes: rawAttributes(row)
    };

    const validation = requirementInputSchema.safeParse(candidate);
    if (!validation.success) {
      errors.push(`Row ${index + 2}: ${validation.error.issues.map((issue) => issue.message).join(", ")}`);
      return;
    }

    records.push(validation.data);
  });

  return { records, errors };
}

export function parseJiraCsv(
  input: string,
  mapping: JiraCsvMapping,
  patterns?: RequirementIdPattern[]
): ParseResult<ParsedWorkItem> {
  const rows = parseRows(input);
  const records: ParsedWorkItem[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const externalId = value(row, mapping.issueKey).toUpperCase();
    const title = value(row, mapping.summary) || externalId;
    const description = value(row, mapping.description);
    const mappedIds = extractRequirementIds(value(row, mapping.requirementIds), patterns);
    const detectedIds = extractRequirementIds(`${title}\n${description}`, patterns);

    const candidate: ParsedWorkItem = {
      externalId,
      title,
      description,
      status: value(row, mapping.status) || undefined,
      type: value(row, mapping.issueType) || undefined,
      assignee: value(row, mapping.assignee) || undefined,
      source: "jira-csv",
      rawAttributes: rawAttributes(row),
      requirementIds: Array.from(new Set([...mappedIds, ...detectedIds]))
    };

    const validation = workItemInputSchema.safeParse(candidate);
    if (!validation.success) {
      errors.push(`Row ${index + 2}: ${validation.error.issues.map((issue) => issue.message).join(", ")}`);
      return;
    }

    records.push(candidate);
  });

  return { records, errors };
}
