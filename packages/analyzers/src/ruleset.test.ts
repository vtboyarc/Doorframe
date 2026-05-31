import { describe, expect, it } from "vitest";
import { DEFAULT_RULESET, type Requirement, type Ruleset } from "@doorframe/core";
import { evaluateCustomRules, generateFindings, type AnalysisInput } from "./rules";

function requirement(partial: Partial<Requirement> & { externalId: string; text: string }): Requirement {
  return {
    id: partial.externalId,
    projectId: "p1",
    externalId: partial.externalId,
    title: partial.title ?? partial.externalId,
    text: partial.text,
    source: "manual",
    status: partial.status,
    type: partial.type,
    priority: partial.priority,
    verificationMethod: partial.verificationMethod,
    createdAt: "now",
    updatedAt: "now"
  };
}

function input(requirements: Requirement[]): AnalysisInput {
  return { requirements, workItems: [], testCases: [], traceLinks: [] };
}

describe("generateFindings configuration", () => {
  it("honors disabled categories", () => {
    const reqs = [requirement({ externalId: "REQ-1", text: "The system shall do a thing quickly." })];
    const ruleset: Ruleset = {
      ...DEFAULT_RULESET,
      analyzer: { ...DEFAULT_RULESET.analyzer, disabledCategories: ["weak_wording", "missing_work_trace"] }
    };

    const findings = generateFindings(input(reqs), ruleset);
    expect(findings.some((f) => f.category === "weak_wording")).toBe(false);
    expect(findings.some((f) => f.category === "missing_work_trace")).toBe(false);
  });

  it("uses a custom vague-term list", () => {
    const reqs = [requirement({ externalId: "REQ-1", text: "The system shall be snazzy." })];
    const ruleset: Ruleset = {
      ...DEFAULT_RULESET,
      analyzer: { ...DEFAULT_RULESET.analyzer, vagueTerms: ["snazzy"] }
    };

    const findings = generateFindings(input(reqs), ruleset);
    expect(findings.some((f) => f.category === "weak_wording")).toBe(true);
  });
});

describe("evaluateCustomRules", () => {
  it("flags requirements whose field matches a regex", () => {
    const reqs = [
      requirement({ externalId: "REQ-1", text: "Includes a TBD section." }),
      requirement({ externalId: "REQ-2", text: "Fully specified." })
    ];
    const findings = evaluateCustomRules(input(reqs), [
      {
        id: "no-tbd",
        title: "Contains TBD",
        description: "Requirement text still contains TBD.",
        severity: "warning",
        category: "custom_rule",
        condition: { field: "text", matches: "tbd" }
      }
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0].entityId).toBe("REQ-1");
    expect(findings[0].category).toBe("custom_rule");
  });

  it("flags requirements whose field does NOT match (notMatches)", () => {
    const reqs = [
      requirement({ externalId: "REQ-1", text: "The system shall respond." }),
      requirement({ externalId: "REQ-2", text: "No keyword here." })
    ];
    const findings = evaluateCustomRules(input(reqs), [
      {
        id: "must-shall",
        title: "Missing shall",
        description: "Requirement does not use 'shall'.",
        severity: "error",
        category: "custom_rule",
        condition: { field: "text", notMatches: "shall" }
      }
    ]);

    expect(findings.map((f) => f.entityId)).toEqual(["REQ-2"]);
  });

  it("skips disabled rules and invalid regexes", () => {
    const reqs = [requirement({ externalId: "REQ-1", text: "anything" })];
    const findings = evaluateCustomRules(input(reqs), [
      {
        id: "off",
        title: "disabled",
        description: "",
        severity: "info",
        category: "custom_rule",
        condition: { field: "text", matches: "any" },
        enabled: false
      },
      {
        id: "bad",
        title: "bad regex",
        description: "",
        severity: "info",
        category: "custom_rule",
        condition: { field: "text", matches: "(" }
      }
    ]);

    expect(findings).toHaveLength(0);
  });
});
