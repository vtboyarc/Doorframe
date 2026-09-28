// Unsaved ruleset edits, kept in this browser tab's sessionStorage so leaving Settings with
// browser Back (which no prompt can intercept) does not lose them. Every storage call is
// guarded: storage can be missing or throw, and the editor must work the same without it.

import type { RulesetFormValues } from "./ruleset-form";
import type { StorageLike } from "./session-store";

interface RulesetDraft {
  /** The saved ruleset the edits started from. */
  saved: RulesetFormValues;
  /** The edited form values. */
  values: RulesetFormValues;
}

const TEXT_FIELDS = [
  "vagueTerms",
  "jaccardThreshold",
  "nonVerifiableMinSignals",
  "closedStatuses",
  "draftStatuses",
  "requirementIdPatterns",
  "customRules"
] as const satisfies ReadonlyArray<keyof RulesetFormValues>;

export function rulesetDraftKey(projectId: string): string {
  return `doorframe:ruleset-draft:${projectId}`;
}

function isFormValues(value: unknown): value is RulesetFormValues {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    TEXT_FIELDS.every((field) => typeof record[field] === "string") &&
    Array.isArray(record.disabledCategories) &&
    record.disabledCategories.every((category) => typeof category === "string")
  );
}

function sameValues(a: RulesetFormValues, b: RulesetFormValues): boolean {
  return (
    TEXT_FIELDS.every((field) => a[field] === b[field]) &&
    a.disabledCategories.length === b.disabledCategories.length &&
    a.disabledCategories.every((category, index) => b.disabledCategories[index] === category)
  );
}

/**
 * The edited values to restore, or null. A draft is used only when it started from the ruleset
 * that is saved now (otherwise someone saved in between and the draft is stale) and still
 * differs from it.
 */
export function readRulesetDraft(
  storage: StorageLike | null,
  projectId: string,
  saved: RulesetFormValues
): RulesetFormValues | null {
  try {
    const raw = storage?.getItem(rulesetDraftKey(projectId));
    if (!raw) {
      return null;
    }
    const draft = JSON.parse(raw) as Partial<RulesetDraft> | null;
    if (!draft || !isFormValues(draft.saved) || !isFormValues(draft.values)) {
      return null;
    }
    if (!sameValues(draft.saved, saved) || sameValues(draft.values, saved)) {
      return null;
    }
    return draft.values;
  } catch {
    return null;
  }
}

/** Store the edits, or remove the draft when there are none. */
export function writeRulesetDraft(
  storage: StorageLike | null,
  projectId: string,
  saved: RulesetFormValues,
  values: RulesetFormValues
): void {
  try {
    if (sameValues(values, saved)) {
      storage?.removeItem(rulesetDraftKey(projectId));
    } else {
      storage?.setItem(rulesetDraftKey(projectId), JSON.stringify({ saved, values } satisfies RulesetDraft));
    }
  } catch {
    // Storage is full or blocked; the edits stay on the page but are not kept for Back.
  }
}

export function clearRulesetDraft(storage: StorageLike | null, projectId: string): void {
  try {
    storage?.removeItem(rulesetDraftKey(projectId));
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
