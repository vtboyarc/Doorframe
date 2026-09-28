import { describe, expect, it } from "vitest";
import { DEFAULT_RULESET } from "@doorframe/core";
import {
  analyzerRangeProblems,
  formValuesFromRuleset,
  normalizeStatusList,
  parseRulesetForm,
  rulesetProblems,
  splitList
} from "./ruleset-form";

const defaults = formValuesFromRuleset(DEFAULT_RULESET);

describe("parseRulesetForm", () => {
  it("round-trips the default ruleset", () => {
    const { ruleset, errors } = parseRulesetForm(defaults);

    expect(errors).toEqual({});
    expect(ruleset).toEqual(DEFAULT_RULESET);
  });

  it("rejects blank and out-of-range numbers instead of saving 0", () => {
    const { ruleset, errors } = parseRulesetForm({ ...defaults, jaccardThreshold: " ", nonVerifiableMinSignals: "7" });

    expect(ruleset).toBeNull();
    expect(errors.jaccardThreshold).toMatch(/greater than 0/);
    expect(errors.nonVerifiableMinSignals).toMatch(/0 to 6/);
    expect(parseRulesetForm({ ...defaults, nonVerifiableMinSignals: "1.5" }).errors.nonVerifiableMinSignals).toBeDefined();
    expect(parseRulesetForm({ ...defaults, jaccardThreshold: "0" }).errors.jaccardThreshold).toBeDefined();
  });

  it("lowercases and de-duplicates statuses so Jira-style capitalization still matches", () => {
    const { ruleset } = parseRulesetForm({ ...defaults, closedStatuses: "Done, CLOSED, done", draftStatuses: "In Review\nDraft" });

    expect(ruleset?.analyzer.closedStatuses).toEqual(["done", "closed"]);
    expect(ruleset?.analyzer.draftStatuses).toEqual(["in review", "draft"]);
  });

  it("reports invalid JSON and broken regexes against the right field", () => {
    expect(parseRulesetForm({ ...defaults, customRules: "[{]" }).errors.customRules).toMatch(/Not valid JSON/);
    expect(
      parseRulesetForm({ ...defaults, requirementIdPatterns: JSON.stringify([{ name: "Bad", regex: "(REQ-\\d+" }]) }).errors
        .requirementIdPatterns
    ).toMatch(/Pattern "Bad": invalid regular expression/);
  });
});

describe("rulesetProblems", () => {
  const rule = {
    id: "r1",
    title: "Needs a unit",
    description: "",
    severity: "warning" as const,
    category: "custom_rule" as const,
    condition: { field: "text" as const, notMatches: "\\b(ms|seconds)\\b" }
  };

  it("accepts a well-formed rule", () => {
    expect(rulesetProblems({ requirementIdPatterns: [], customRules: [rule] }).customRules).toEqual([]);
  });

  it("flags rules without a condition, broken regexes, and duplicate ids", () => {
    const problems = rulesetProblems({
      requirementIdPatterns: [],
      customRules: [rule, { ...rule, condition: { field: "text" } }, { ...rule, id: "r2", condition: { field: "text", matches: "(" } }]
    }).customRules;

    expect(problems.some((problem) => problem.includes("used more than once"))).toBe(true);
    expect(problems.some((problem) => problem.includes("needs condition.matches"))).toBe(true);
    expect(problems.some((problem) => problem.includes("not a valid regular expression"))).toBe(true);
  });
});

describe("list helpers", () => {
  it("splits on commas and newlines", () => {
    expect(splitList("a, b\nc,,a")).toEqual(["a", "b", "c"]);
    expect(normalizeStatusList([" Done ", "done", "In Review"])).toEqual(["done", "in review"]);
  });
});

describe("analyzerRangeProblems", () => {
  it("accepts the defaults and rejects values the form would refuse", () => {
    expect(analyzerRangeProblems(DEFAULT_RULESET.analyzer)).toEqual([]);
    expect(analyzerRangeProblems({ jaccardThreshold: 1, nonVerifiableMinSignals: 0 })).toEqual([]);
    expect(analyzerRangeProblems({ jaccardThreshold: 0, nonVerifiableMinSignals: 2 })).toEqual([
      "Duplicate similarity threshold must be greater than 0 and at most 1."
    ]);
    expect(analyzerRangeProblems({ jaccardThreshold: 0.8, nonVerifiableMinSignals: 9 })).toHaveLength(1);
    expect(analyzerRangeProblems({ jaccardThreshold: 1.5, nonVerifiableMinSignals: 1.5 })).toHaveLength(2);
  });
});
