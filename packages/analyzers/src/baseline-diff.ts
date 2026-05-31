import { normalizeText, type RawAttributes, type RequirementInput, type TestStatus } from "@doorframe/core";

export type BaselineDiffField =
  | "title"
  | "text"
  | "status"
  | "type"
  | "priority"
  | "verificationMethod"
  | "parentExternalId"
  | "rawAttributes";

export type ChangeConcern = "high" | "medium" | "low";

export interface BaselineDiffWorkItemContext {
  externalId: string;
  title: string;
  status?: string;
  requirementIds: string[];
}

export interface BaselineDiffTestContext {
  externalId: string;
  name: string;
  status: TestStatus;
  requirementIds: string[];
}

export interface BaselineDiffInput {
  baselineAName: string;
  baselineBName: string;
  requirementsA: RequirementInput[];
  requirementsB: RequirementInput[];
  workItems?: BaselineDiffWorkItemContext[];
  testCases?: BaselineDiffTestContext[];
}

export interface BaselineWordDiffToken {
  value: string;
  type: "unchanged" | "added" | "removed";
}

export interface BaselineFieldChange {
  field: BaselineDiffField;
  before?: string;
  after?: string;
  wordDiff?: BaselineWordDiffToken[];
}

export interface BaselineChangedRequirement {
  externalId: string;
  title: string;
  concern: ChangeConcern;
  concernReasons: string[];
  changes: BaselineFieldChange[];
  affectedWorkItems: string[];
  affectedTests: string[];
  recommendations: string[];
}

export interface BaselineDiffReport {
  generatedAt: string;
  baselineAName: string;
  baselineBName: string;
  summary: {
    baselineARequirements: number;
    baselineBRequirements: number;
    added: number;
    deleted: number;
    changed: number;
    unchanged: number;
    highConcern: number;
    mediumConcern: number;
    lowConcern: number;
  };
  added: RequirementInput[];
  deleted: RequirementInput[];
  changed: BaselineChangedRequirement[];
  unchanged: string[];
}

const CHANGE_FIELDS: BaselineDiffField[] = [
  "title",
  "text",
  "status",
  "type",
  "priority",
  "verificationMethod",
  "parentExternalId",
  "rawAttributes"
];

const CONCERN_TERMS = [
  "shall",
  "within",
  "must",
  "operator",
  "safety",
  "authentication",
  "audit",
  "encrypt",
  "log",
  "alert",
  "timeout",
  "override"
];

function byExternalId(requirements: RequirementInput[]): Map<string, RequirementInput> {
  return new Map(requirements.map((requirement) => [requirement.externalId, requirement]));
}

function rawString(rawAttributes: RawAttributes | undefined): string {
  return JSON.stringify(rawAttributes ?? {}, Object.keys(rawAttributes ?? {}).sort());
}

function fieldValue(requirement: RequirementInput, field: BaselineDiffField): string {
  if (field === "rawAttributes") {
    return rawString(requirement.rawAttributes);
  }
  return requirement[field] ?? "";
}

function tokenize(value: string): string[] {
  return value.match(/\S+/g) ?? [];
}

export function wordDiff(before: string, after: string): BaselineWordDiffToken[] {
  const beforeWords = tokenize(before);
  const afterWords = tokenize(after);
  const length = Math.max(beforeWords.length, afterWords.length);
  const tokens: BaselineWordDiffToken[] = [];

  for (let index = 0; index < length; index += 1) {
    const beforeWord = beforeWords[index];
    const afterWord = afterWords[index];
    if (beforeWord === afterWord && beforeWord) {
      tokens.push({ value: beforeWord, type: "unchanged" });
    } else {
      if (beforeWord) {
        tokens.push({ value: beforeWord, type: "removed" });
      }
      if (afterWord) {
        tokens.push({ value: afterWord, type: "added" });
      }
    }
  }

  return tokens;
}

function numericThresholdChanged(before: string, after: string): boolean {
  const numberPattern = /\b\d+(?:\.\d+)?\b/g;
  const beforeNumbers = before.match(numberPattern) ?? [];
  const afterNumbers = after.match(numberPattern) ?? [];
  return beforeNumbers.join("|") !== afterNumbers.join("|");
}

function linkedWorkItems(requirementId: string, workItems: BaselineDiffWorkItemContext[]): BaselineDiffWorkItemContext[] {
  return workItems.filter((workItem) => workItem.requirementIds.includes(requirementId));
}

function linkedTests(requirementId: string, testCases: BaselineDiffTestContext[]): BaselineDiffTestContext[] {
  return testCases.filter((testCase) => testCase.requirementIds.includes(requirementId));
}

function isClosed(status: string | undefined): boolean {
  return ["done", "closed", "resolved", "complete", "completed"].includes((status ?? "").trim().toLowerCase());
}

function concernForChange(
  before: RequirementInput,
  after: RequirementInput,
  changes: BaselineFieldChange[],
  workItems: BaselineDiffWorkItemContext[],
  testCases: BaselineDiffTestContext[]
): { concern: ChangeConcern; reasons: string[]; recommendations: string[] } {
  const reasons: string[] = [];
  const recommendations = new Set<string>();
  const textChanged = changes.some((change) => change.field === "text");
  const verificationChanged = changes.some((change) => change.field === "verificationMethod");
  const linked = linkedTests(after.externalId, testCases);
  const linkedPassing = linked.some((testCase) => testCase.status === "passed");
  const linkedFailed = linked.some((testCase) => testCase.status === "failed" || testCase.status === "errored");
  const linkedClosedWork = linkedWorkItems(after.externalId, workItems).filter((workItem) => isClosed(workItem.status));
  const changedText = `${before.text}\n${after.text}`;
  const normalizedChangedText = normalizeText(changedText);

  if (textChanged && !linkedPassing) {
    reasons.push("Requirement text changed and no linked passing test evidence was found.");
    recommendations.add("Confirm verification evidence against the changed requirement text.");
  }

  if (textChanged && numericThresholdChanged(before.text, after.text)) {
    reasons.push("A numeric timing or threshold value changed.");
    recommendations.add("Review tests and acceptance criteria for the changed threshold.");
  }

  if (verificationChanged) {
    reasons.push("Verification method changed.");
    recommendations.add("Confirm the review plan still matches the verification method.");
  }

  if (linkedFailed) {
    reasons.push("The requirement is linked to failed or errored test evidence.");
    recommendations.add("Resolve failed or errored linked tests before review.");
  }

  if (linkedClosedWork.length > 0 && !linkedPassing) {
    reasons.push("Closed work is linked but no passing updated test evidence was found.");
    recommendations.add("Check closed work against current verification evidence.");
  }

  const matchedTerms = CONCERN_TERMS.filter((term) => new RegExp(`\\b${term}\\b`, "i").test(normalizedChangedText));
  if (matchedTerms.length > 0 && textChanged) {
    reasons.push(`Changed text includes review-sensitive terms: ${matchedTerms.join(", ")}.`);
    recommendations.add("Review the changed requirement with the responsible reviewer.");
  }

  if (reasons.length === 0) {
    reasons.push("Changed requirement fields should be reviewed before the next baseline is accepted.");
    recommendations.add("Confirm the change is intentional and trace links remain current.");
  }

  const concern: ChangeConcern =
    reasons.some((reason) => /no linked passing|numeric|failed|errored|closed work/i.test(reason))
      ? "high"
      : reasons.some((reason) => /verification|review-sensitive/i.test(reason))
        ? "medium"
        : "low";

  return { concern, reasons, recommendations: Array.from(recommendations) };
}

export function compareRequirementBaselines(input: BaselineDiffInput): BaselineDiffReport {
  const beforeById = byExternalId(input.requirementsA);
  const afterById = byExternalId(input.requirementsB);
  const added = input.requirementsB.filter((requirement) => !beforeById.has(requirement.externalId));
  const deleted = input.requirementsA.filter((requirement) => !afterById.has(requirement.externalId));
  const changed: BaselineChangedRequirement[] = [];
  const unchanged: string[] = [];
  const workItems = input.workItems ?? [];
  const testCases = input.testCases ?? [];

  input.requirementsB.forEach((after) => {
    const before = beforeById.get(after.externalId);
    if (!before) {
      return;
    }

    const changes = CHANGE_FIELDS.flatMap((field): BaselineFieldChange[] => {
      const beforeValue = fieldValue(before, field);
      const afterValue = fieldValue(after, field);
      if (beforeValue === afterValue) {
        return [];
      }
      return [
        {
          field,
          before: beforeValue || undefined,
          after: afterValue || undefined,
          wordDiff: field === "text" ? wordDiff(beforeValue, afterValue) : undefined
        }
      ];
    });

    if (changes.length === 0) {
      unchanged.push(after.externalId);
      return;
    }

    const concern = concernForChange(before, after, changes, workItems, testCases);
    changed.push({
      externalId: after.externalId,
      title: after.title,
      concern: concern.concern,
      concernReasons: concern.reasons,
      changes,
      affectedWorkItems: linkedWorkItems(after.externalId, workItems).map((workItem) => workItem.externalId),
      affectedTests: linkedTests(after.externalId, testCases).map((testCase) => `${testCase.name} (${testCase.status})`),
      recommendations: concern.recommendations
    });
  });

  const summary = {
    baselineARequirements: input.requirementsA.length,
    baselineBRequirements: input.requirementsB.length,
    added: added.length,
    deleted: deleted.length,
    changed: changed.length,
    unchanged: unchanged.length,
    highConcern: changed.filter((change) => change.concern === "high").length,
    mediumConcern: changed.filter((change) => change.concern === "medium").length,
    lowConcern: changed.filter((change) => change.concern === "low").length
  };

  return {
    generatedAt: new Date().toISOString(),
    baselineAName: input.baselineAName,
    baselineBName: input.baselineBName,
    summary,
    added,
    deleted,
    changed,
    unchanged
  };
}
