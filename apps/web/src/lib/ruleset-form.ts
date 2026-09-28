import {
  customRuleSchema,
  requirementIdPatternSchema,
  type CustomRule,
  type FindingCategory,
  type Ruleset
} from "@doorframe/core";

/** The ruleset editor's form state: text fields exactly as typed. */
export interface RulesetFormValues {
  vagueTerms: string;
  jaccardThreshold: string;
  nonVerifiableMinSignals: string;
  closedStatuses: string;
  draftStatuses: string;
  disabledCategories: FindingCategory[];
  requirementIdPatterns: string;
  customRules: string;
}

export type RulesetFormField = Exclude<keyof RulesetFormValues, "disabledCategories">;

/** Number of measurable signals the non-verifiable rule checks. */
export const NON_VERIFIABLE_SIGNAL_COUNT = 6;

export function formValuesFromRuleset(ruleset: Ruleset): RulesetFormValues {
  return {
    vagueTerms: ruleset.analyzer.vagueTerms.join(", "),
    jaccardThreshold: String(ruleset.analyzer.jaccardThreshold),
    nonVerifiableMinSignals: String(ruleset.analyzer.nonVerifiableMinSignals),
    closedStatuses: ruleset.analyzer.closedStatuses.join(", "),
    draftStatuses: ruleset.analyzer.draftStatuses.join(", "),
    disabledCategories: [...ruleset.analyzer.disabledCategories],
    requirementIdPatterns: JSON.stringify(ruleset.requirementIdPatterns, null, 2),
    customRules: JSON.stringify(ruleset.customRules, null, 2)
  };
}

/** Split a comma- or newline-separated list, trimming and dropping blanks and duplicates. */
export function splitList(value: string): string[] {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
}

/** Statuses are compared case-insensitively by the analyzer, which expects lowercase entries. */
export function normalizeStatusList(statuses: string[]): string[] {
  return [...new Set(statuses.map((status) => status.trim().toLowerCase()).filter(Boolean))];
}

function regexError(pattern: string, flags: string): string | null {
  try {
    new RegExp(pattern, flags);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message.replace(/^Invalid regular expression: /, "") : "invalid regular expression";
  }
}

/** Problems a schema check cannot catch: broken regexes, rules that can never match, duplicate rule ids. */
export function rulesetProblems(ruleset: Pick<Ruleset, "requirementIdPatterns" | "customRules">): {
  requirementIdPatterns: string[];
  customRules: string[];
} {
  const patternProblems = ruleset.requirementIdPatterns.flatMap((pattern) => {
    const error = regexError(pattern.regex, "gi");
    return error ? [`Pattern "${pattern.name}": invalid regular expression (${error}).`] : [];
  });

  const seenIds = new Set<string>();
  const ruleProblems = ruleset.customRules.flatMap((rule: CustomRule) => {
    const problems: string[] = [];
    if (seenIds.has(rule.id)) {
      problems.push(`Rule id "${rule.id}" is used more than once.`);
    }
    seenIds.add(rule.id);
    if (!rule.condition.matches && !rule.condition.notMatches) {
      problems.push(`Rule "${rule.title}" needs condition.matches or condition.notMatches.`);
    }
    (["matches", "notMatches"] as const).forEach((key) => {
      const pattern = rule.condition[key];
      const error = pattern ? regexError(pattern, "i") : null;
      if (error) {
        problems.push(`Rule "${rule.title}": condition.${key} is not a valid regular expression (${error}).`);
      }
    });
    return problems;
  });

  return { requirementIdPatterns: patternProblems, customRules: ruleProblems };
}

/** Ranges the API enforces for the numeric analyzer settings (the schema alone allows 0 and any integer). */
export function analyzerRangeProblems(
  analyzer: Pick<Ruleset["analyzer"], "jaccardThreshold" | "nonVerifiableMinSignals">
): string[] {
  const problems: string[] = [];
  if (!(analyzer.jaccardThreshold > 0 && analyzer.jaccardThreshold <= 1)) {
    problems.push("Duplicate similarity threshold must be greater than 0 and at most 1.");
  }
  const signals = analyzer.nonVerifiableMinSignals;
  if (!Number.isInteger(signals) || signals < 0 || signals > NON_VERIFIABLE_SIGNAL_COUNT) {
    problems.push(`Measurable signals required must be a whole number from 0 to ${NON_VERIFIABLE_SIGNAL_COUNT}.`);
  }
  return problems;
}

function parseJsonField(value: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(value) };
  } catch (error) {
    return { error: `Not valid JSON${error instanceof Error ? `: ${error.message}` : ""}. Check for a missing quote or a trailing comma.` };
  }
}

function issuePath(path: PropertyKey[]): string {
  return path
    .map((part) => (typeof part === "number" ? `[${part}]` : `.${String(part)}`))
    .join("")
    .replace(/^\./, "");
}

/**
 * Validate the editor form and build a ruleset. Returns per-field messages so
 * the editor can show each problem next to the field that caused it.
 */
export function parseRulesetForm(values: RulesetFormValues): {
  ruleset: Ruleset | null;
  errors: Partial<Record<RulesetFormField, string>>;
} {
  const errors: Partial<Record<RulesetFormField, string>> = {};

  const jaccard = Number(values.jaccardThreshold.trim());
  if (!values.jaccardThreshold.trim() || !Number.isFinite(jaccard) || jaccard <= 0 || jaccard > 1) {
    errors.jaccardThreshold = "Enter a number greater than 0 and at most 1, for example 0.82.";
  }

  const minSignals = Number(values.nonVerifiableMinSignals.trim());
  if (
    !values.nonVerifiableMinSignals.trim() ||
    !Number.isInteger(minSignals) ||
    minSignals < 0 ||
    minSignals > NON_VERIFIABLE_SIGNAL_COUNT
  ) {
    errors.nonVerifiableMinSignals = `Enter a whole number from 0 to ${NON_VERIFIABLE_SIGNAL_COUNT}.`;
  }

  const patternsJson = parseJsonField(values.requirementIdPatterns);
  let requirementIdPatterns: Ruleset["requirementIdPatterns"] = [];
  if (patternsJson.error) {
    errors.requirementIdPatterns = patternsJson.error;
  } else {
    const parsed = requirementIdPatternSchema.array().safeParse(patternsJson.value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.requirementIdPatterns = `Expected a list of {"name", "regex"} objects (${issuePath(issue.path) || "value"}: ${issue.message}).`;
    } else {
      requirementIdPatterns = parsed.data;
    }
  }

  const rulesJson = parseJsonField(values.customRules);
  let customRules: Ruleset["customRules"] = [];
  if (rulesJson.error) {
    errors.customRules = rulesJson.error;
  } else {
    const parsed = customRuleSchema.array().safeParse(rulesJson.value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.customRules = `Rule ${issuePath(issue.path) || "value"}: ${issue.message}.`;
    } else {
      customRules = parsed.data;
    }
  }

  const problems = rulesetProblems({ requirementIdPatterns, customRules });
  if (!errors.requirementIdPatterns && problems.requirementIdPatterns.length > 0) {
    errors.requirementIdPatterns = problems.requirementIdPatterns.join(" ");
  }
  if (!errors.customRules && problems.customRules.length > 0) {
    errors.customRules = problems.customRules.join(" ");
  }

  if (Object.keys(errors).length > 0) {
    return { ruleset: null, errors };
  }

  return {
    ruleset: {
      requirementIdPatterns,
      analyzer: {
        vagueTerms: splitList(values.vagueTerms),
        jaccardThreshold: jaccard,
        nonVerifiableMinSignals: minSignals,
        closedStatuses: normalizeStatusList(splitList(values.closedStatuses)),
        draftStatuses: normalizeStatusList(splitList(values.draftStatuses)),
        disabledCategories: values.disabledCategories
      },
      customRules
    },
    errors
  };
}
