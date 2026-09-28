import type { ParsedRequirement, ParsedWorkItem } from "@doorframe/parsers";
import { z } from "zod";
import {
  MAX_REMOVABLE_RECORDS,
  type ColumnMapping,
  type ImportEntityType,
  type MissingRecords,
  type RemoveRecordsRequest
} from "./import-types";
import { compareExternalIds } from "./sort";

/** Pure helpers the import route and lib/imports.ts use to describe what an import changed. */

export interface CreatedUpdatedCounts {
  recordCount: number;
  createdCount: number;
  updatedCount: number;
}

/** Split the imported IDs into records that are new and records that replaced an earlier import. */
export function countCreatedAndUpdated(
  existingExternalIds: ReadonlySet<string>,
  importedExternalIds: string[]
): CreatedUpdatedCounts {
  const unique = new Set(importedExternalIds);
  let updatedCount = 0;
  unique.forEach((externalId) => {
    if (existingExternalIds.has(externalId)) {
      updatedCount += 1;
    }
  });

  return { recordCount: unique.size, createdCount: unique.size - updatedCount, updatedCount };
}

/** IDs that were in the project before the import but are not in the uploaded file, sorted naturally. */
export function missingExternalIds(existingExternalIds: Iterable<string>, importedExternalIds: string[]): string[] {
  const imported = new Set(importedExternalIds);
  return Array.from(existingExternalIds)
    .filter((externalId) => !imported.has(externalId))
    .sort(compareExternalIds);
}

/**
 * Summarize missing records for the import response. Returns null when nothing
 * is missing, or when nothing was imported: an empty or unreadable file must
 * never suggest removing every record in the project.
 */
export function summarizeMissing(
  entityType: ImportEntityType,
  missingIds: string[],
  importedCount: number,
  limit = MAX_REMOVABLE_RECORDS
): MissingRecords | null {
  if (importedCount === 0 || missingIds.length === 0) {
    return null;
  }

  return { entityType, count: missingIds.length, externalIds: missingIds.slice(0, limit) };
}

/**
 * IDs are matched exactly against stored external IDs, so they are neither
 * trimmed nor length-capped: imports accept IDs of any length (a JUnit ID is
 * `classname.name`, and parameterized test names can run past 500 characters).
 * The list itself is capped at {@link MAX_REMOVABLE_RECORDS}.
 */
const removeRecordsRequestSchema = z.object({
  entityType: z.enum(["requirement", "workItem", "testCase"]),
  externalIds: z.array(z.string().min(1)).min(1).max(MAX_REMOVABLE_RECORDS)
});

/** Validate the body of a "remove missing records" request; null when it is malformed. */
export function parseRemoveRecordsRequest(body: unknown): RemoveRecordsRequest | null {
  const parsed = removeRecordsRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Read the mapping form field defensively: only string values survive. */
export function parseClientMapping(value: unknown): ColumnMapping {
  if (typeof value !== "string" || !value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
}

/** True when the form explicitly chose "Not imported" (an empty string) for the field. */
function notImported(mapping: ColumnMapping, key: string): boolean {
  return Object.hasOwn(mapping, key) && mapping[key].trim() === "";
}

/**
 * The CSV parser infers a column for every field the mapping leaves empty. When
 * the form explicitly chose "Not imported" for an optional field, blank that
 * value again so the choice sticks. Required fields are never touched.
 */
export function blankUnmappedRequirementFields(
  records: ParsedRequirement[],
  mapping: ColumnMapping
): ParsedRequirement[] {
  const blankTitle = notImported(mapping, "title");
  const blankStatus = notImported(mapping, "status");
  const blankType = notImported(mapping, "type");
  const blankPriority = notImported(mapping, "priority");
  const blankVerification = notImported(mapping, "verificationMethod");
  const blankParent = notImported(mapping, "parentId");

  return records.map((record) => ({
    ...record,
    title: blankTitle ? record.externalId : record.title,
    status: blankStatus ? undefined : record.status,
    type: blankType ? undefined : record.type,
    priority: blankPriority ? undefined : record.priority,
    verificationMethod: blankVerification ? undefined : record.verificationMethod,
    parentExternalId: blankParent ? undefined : record.parentExternalId
  }));
}

/** Jira version of {@link blankUnmappedRequirementFields}. Requirement IDs are always detected. */
export function blankUnmappedJiraFields(records: ParsedWorkItem[], mapping: ColumnMapping): ParsedWorkItem[] {
  const blankSummary = notImported(mapping, "summary");
  const blankDescription = notImported(mapping, "description");
  const blankStatus = notImported(mapping, "status");
  const blankIssueType = notImported(mapping, "issueType");
  const blankAssignee = notImported(mapping, "assignee");

  return records.map((record) => ({
    ...record,
    title: blankSummary ? record.externalId : record.title,
    description: blankDescription ? undefined : record.description,
    status: blankStatus ? undefined : record.status,
    type: blankIssueType ? undefined : record.type,
    assignee: blankAssignee ? undefined : record.assignee
  }));
}
