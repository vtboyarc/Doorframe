import type { FindingCategory, FindingSeverity } from "./types";

/**
 * A named, serialized regular expression used to detect requirement IDs in free
 * text (Jira summaries, JUnit test names, etc.). The `regex` is stored as a
 * string so rulesets can be persisted as JSON and edited in the UI. Capture
 * group 1 must contain the raw requirement ID.
 */
export interface RequirementIdPattern {
  name: string;
  regex: string;
}

/** Tunable knobs for the built-in deterministic analyzer rules. */
export interface AnalyzerConfig {
  vagueTerms: string[];
  jaccardThreshold: number;
  closedStatuses: string[];
  draftStatuses: string[];
  nonVerifiableMinSignals: number;
  /** Built-in finding categories the project wants suppressed. */
  disabledCategories: FindingCategory[];
}

export type CustomRuleField = "text" | "title" | "status" | "type" | "priority" | "verificationMethod";

export interface CustomRuleCondition {
  field: CustomRuleField;
  /** Flag when the field value matches this (case-insensitive) regex. */
  matches?: string;
  /** Flag when the field value does NOT match this (case-insensitive) regex. */
  notMatches?: string;
}

/**
 * A declarative, project-defined analyzer rule. Evaluated against requirements
 * and emitted as findings alongside the built-in rules.
 */
export interface CustomRule {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  category: FindingCategory;
  condition: CustomRuleCondition;
  recommendation?: string;
  enabled?: boolean;
}

/** Per-project configuration controlling ID detection and analysis. */
export interface Ruleset {
  requirementIdPatterns: RequirementIdPattern[];
  analyzer: AnalyzerConfig;
  customRules: CustomRule[];
}

/** Default ID patterns mirroring Doorframe's original hardcoded detection. */
export const DEFAULT_REQUIREMENT_ID_PATTERNS: RequirementIdPattern[] = [
  {
    name: "Common prefixes (REQ/SYS/SRS/DOORS)",
    regex: "(?:^|[^A-Z0-9])((?:REQ|SYS|SRS|DOORS)[\\s_-]?\\d+[A-Z0-9._-]*)"
  },
  {
    name: "Shall statements",
    regex: "(?:^|[^A-Z0-9])((?:SHALL)[\\s_-]?\\d+)"
  }
];

export const DEFAULT_VAGUE_TERMS: string[] = [
  "quickly",
  "robust",
  "user-friendly",
  "as needed",
  "appropriate",
  "sufficient",
  "adequate",
  "easy",
  "fast",
  "efficient",
  "minimize",
  "maximize",
  "should",
  "may",
  "where possible",
  "if practical"
];

export const DEFAULT_CLOSED_STATUSES = ["done", "closed", "resolved", "complete", "completed"];
export const DEFAULT_DRAFT_REQUIREMENT_STATUSES = ["changed", "draft", "proposed", "in review", "review"];

export const DEFAULT_ANALYZER_CONFIG: AnalyzerConfig = {
  vagueTerms: DEFAULT_VAGUE_TERMS,
  jaccardThreshold: 0.82,
  closedStatuses: DEFAULT_CLOSED_STATUSES,
  draftStatuses: DEFAULT_DRAFT_REQUIREMENT_STATUSES,
  nonVerifiableMinSignals: 2,
  disabledCategories: []
};

export const DEFAULT_RULESET: Ruleset = {
  requirementIdPatterns: DEFAULT_REQUIREMENT_ID_PATTERNS,
  analyzer: DEFAULT_ANALYZER_CONFIG,
  customRules: []
};

/** Merge a partial/persisted ruleset over the defaults, filling any gaps. */
export function normalizeRuleset(input?: Partial<Ruleset> | null): Ruleset {
  if (!input) {
    return DEFAULT_RULESET;
  }

  return {
    requirementIdPatterns:
      input.requirementIdPatterns && input.requirementIdPatterns.length > 0
        ? input.requirementIdPatterns
        : DEFAULT_REQUIREMENT_ID_PATTERNS,
    analyzer: { ...DEFAULT_ANALYZER_CONFIG, ...(input.analyzer ?? {}) },
    customRules: input.customRules ?? []
  };
}
