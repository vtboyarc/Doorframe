import {
  normalizeText,
  type EntityType,
  type FindingInput,
  type Requirement,
  type TestCase,
  type TraceLink,
  type WorkItem
} from "@doorframe/core";

export interface AnalysisInput {
  requirements: Requirement[];
  workItems: WorkItem[];
  testCases: TestCase[];
  traceLinks: TraceLink[];
}

const VAGUE_TERMS = [
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

const CLOSED_STATUSES = ["done", "closed", "resolved", "complete", "completed"];
const DRAFT_REQUIREMENT_STATUSES = ["changed", "draft", "proposed", "in review", "review"];

function linkedEntityIds(
  requirement: Requirement,
  targetType: EntityType,
  traceLinks: TraceLink[]
): string[] {
  return traceLinks
    .filter((link) => {
      const requirementIsSource =
        link.sourceType === "requirement" &&
        link.sourceId === requirement.id &&
        link.targetType === targetType;
      const requirementIsTarget =
        link.targetType === "requirement" &&
        link.targetId === requirement.id &&
        link.sourceType === targetType;

      return requirementIsSource || requirementIsTarget;
    })
    .map((link) => (link.sourceId === requirement.id ? link.targetId : link.sourceId));
}

function isClosed(status: string | undefined): boolean {
  return CLOSED_STATUSES.includes((status ?? "").trim().toLowerCase());
}

function isDraftOrChanged(status: string | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return DRAFT_REQUIREMENT_STATUSES.some((candidate) => normalized.includes(candidate));
}

function hasPassingTest(requirement: Requirement, testCases: TestCase[], traceLinks: TraceLink[]): boolean {
  const linkedTestIds = linkedEntityIds(requirement, "testCase", traceLinks);
  return testCases.some((testCase) => linkedTestIds.includes(testCase.id) && testCase.status === "passed");
}

function requirementById(requirements: Requirement[]): Map<string, Requirement> {
  return new Map(requirements.map((requirement) => [requirement.id, requirement]));
}

function requirementsForWorkItem(workItem: WorkItem, requirements: Requirement[], traceLinks: TraceLink[]): Requirement[] {
  const byId = requirementById(requirements);
  const requirementIds = traceLinks
    .filter((link) => {
      const workIsSource =
        link.sourceType === "workItem" && link.sourceId === workItem.id && link.targetType === "requirement";
      const workIsTarget =
        link.targetType === "workItem" && link.targetId === workItem.id && link.sourceType === "requirement";

      return workIsSource || workIsTarget;
    })
    .map((link) => (link.sourceId === workItem.id ? link.targetId : link.sourceId));

  return requirementIds.flatMap((id) => {
    const requirement = byId.get(id);
    return requirement ? [requirement] : [];
  });
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((token) => token.length > 2)
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const intersection = Array.from(left).filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

export function findMissingVerification(input: AnalysisInput): FindingInput[] {
  return input.requirements.flatMap((requirement) => {
    const linkedTests = linkedEntityIds(requirement, "testCase", input.traceLinks);
    const findings: FindingInput[] = [];

    if (!requirement.verificationMethod?.trim()) {
      findings.push({
        severity: "error",
        category: "missing_verification",
        title: `${requirement.externalId} has no verification method`,
        description: "This requirement does not state how it will be verified.",
        entityType: "requirement",
        entityId: requirement.id,
        recommendation: "Add a verification method such as test, inspection, analysis, or demonstration."
      });
    }

    if (linkedTests.length === 0) {
      findings.push({
        severity: "error",
        category: "missing_verification",
        title: `${requirement.externalId} has no linked test case`,
        description: "No JUnit test case is linked to this requirement.",
        entityType: "requirement",
        entityId: requirement.id,
        recommendation: "Link passing test evidence or mark why verification is handled outside automated tests."
      });
    }

    return findings;
  });
}

export function findMissingWorkTrace(input: AnalysisInput): FindingInput[] {
  return input.requirements
    .filter((requirement) => linkedEntityIds(requirement, "workItem", input.traceLinks).length === 0)
    .map((requirement) => ({
      severity: "warning",
      category: "missing_work_trace",
      title: `${requirement.externalId} has no linked work item`,
      description: "No Jira or work item trace was found for this requirement.",
      entityType: "requirement",
      entityId: requirement.id,
      recommendation: "Add the requirement ID to the related Jira issue or map a work item during import."
    }));
}

export function findWeakRequirements(input: AnalysisInput): FindingInput[] {
  return input.requirements.flatMap((requirement) => {
    const text = requirement.text.toLowerCase();
    const matches = VAGUE_TERMS.filter((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`, "i").test(text);
    });

    if (matches.length === 0) {
      return [];
    }

    return [
      {
        severity: "warning",
        category: "weak_wording",
        title: `${requirement.externalId} uses vague language`,
        description: `The requirement contains vague wording: ${matches.join(", ")}.`,
        entityType: "requirement",
        entityId: requirement.id,
        recommendation: "Replace vague wording with observable behavior, measurable thresholds, or explicit conditions."
      }
    ];
  });
}

export function findMultiShallRequirements(input: AnalysisInput): FindingInput[] {
  return input.requirements
    .filter((requirement) => (requirement.text.match(/\bshall\b/gi) ?? []).length > 1)
    .map((requirement) => ({
      severity: "warning",
      category: "multi_requirement",
      title: `${requirement.externalId} may contain multiple requirements`,
      description: "This requirement contains more than one 'shall' statement.",
      entityType: "requirement",
      entityId: requirement.id,
      recommendation: "Split combined behavior into separate atomic requirements where practical."
    }));
}

export function findNonVerifiableRequirements(input: AnalysisInput): FindingInput[] {
  return input.requirements
    .filter((requirement) => {
      const text = requirement.text.toLowerCase();
      const signals = [
        /\d/.test(text),
        /\b(within|less than|greater than|at least|no more than|between|before|after|during)\b/.test(text),
        /\b(when|if|given|while|upon)\b/.test(text),
        /\b(input|output|display|return|response|error|message|signal|file)\b/.test(text),
        /\b(user|operator|administrator|system|service|device|interface)\b/.test(text),
        /\b(ms|millisecond|second|minute|hour|percent|%)\b/.test(text)
      ];

      return signals.filter(Boolean).length < 2;
    })
    .map((requirement) => ({
      severity: "warning",
      category: "non_verifiable",
      title: `${requirement.externalId} may not be verifiable`,
      description: "The requirement does not appear to include enough measurable criteria, conditions, inputs, outputs, timing, thresholds, or actors.",
      entityType: "requirement",
      entityId: requirement.id,
      recommendation: "Add concrete acceptance criteria and make the expected system behavior observable."
    }));
}

export function findDuplicateCandidates(input: AnalysisInput): FindingInput[] {
  const findings: FindingInput[] = [];
  const tokenized = input.requirements.map((requirement) => ({
    requirement,
    tokens: tokenSet(requirement.text)
  }));

  for (let i = 0; i < tokenized.length; i += 1) {
    for (let j = i + 1; j < tokenized.length; j += 1) {
      const score = jaccard(tokenized[i].tokens, tokenized[j].tokens);

      if (score >= 0.82) {
        findings.push({
          severity: "info",
          category: "duplicate_candidate",
          title: `${tokenized[i].requirement.externalId} resembles ${tokenized[j].requirement.externalId}`,
          description: `The normalized requirement text is ${Math.round(score * 100)}% similar.`,
          entityType: "requirement",
          entityId: tokenized[i].requirement.id,
          recommendation: "Review whether these requirements are duplicates or need clearer differentiation."
        });
      }
    }
  }

  return findings;
}

export function findClosedWorkWithoutVerification(input: AnalysisInput): FindingInput[] {
  return input.workItems.flatMap((workItem) => {
    if (!isClosed(workItem.status)) {
      return [];
    }

    const linkedRequirements = requirementsForWorkItem(workItem, input.requirements, input.traceLinks);
    const unverifiedRequirements = linkedRequirements.filter(
      (requirement) => !hasPassingTest(requirement, input.testCases, input.traceLinks)
    );

    if (linkedRequirements.length === 0 || unverifiedRequirements.length === 0) {
      return [];
    }

    return [
      {
        severity: "error",
        category: "closed_work_without_verification",
        title: `${workItem.externalId} is closed without passing verification`,
        description: `Closed work is linked to requirements without passing test evidence: ${unverifiedRequirements
          .map((requirement) => requirement.externalId)
          .join(", ")}.`,
        entityType: "workItem",
        entityId: workItem.id,
        recommendation: "Link passing JUnit evidence before treating the work as fully verified."
      }
    ];
  });
}

export function findPossibleStaleLinks(input: AnalysisInput): FindingInput[] {
  return input.workItems.flatMap((workItem) => {
    if (!isClosed(workItem.status)) {
      return [];
    }

    return requirementsForWorkItem(workItem, input.requirements, input.traceLinks)
      .filter((requirement) => isDraftOrChanged(requirement.status))
      .map((requirement) => ({
        severity: "warning",
        category: "stale_link",
        title: `${workItem.externalId} may be stale for ${requirement.externalId}`,
        description: "The linked work item is closed, but the requirement appears to be draft, changed, or under review.",
        entityType: "requirement",
        entityId: requirement.id,
        recommendation: "Confirm whether the closed work still satisfies the current requirement text."
      }));
  });
}

export function generateFindings(input: AnalysisInput): FindingInput[] {
  return [
    ...findMissingVerification(input),
    ...findMissingWorkTrace(input),
    ...findWeakRequirements(input),
    ...findMultiShallRequirements(input),
    ...findNonVerifiableRequirements(input),
    ...findDuplicateCandidates(input),
    ...findClosedWorkWithoutVerification(input),
    ...findPossibleStaleLinks(input)
  ];
}
