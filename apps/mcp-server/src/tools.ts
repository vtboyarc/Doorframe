import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_RULESET, type EntityType, type Finding, type ProjectData, type Requirement, type TestCase, type TraceLink, type WorkItem } from "@doorframe/core";
import type { ReadOnlyProjectDatabase } from "@doorframe/storage";
import {
  cappedNote,
  clampLimit,
  countBy,
  excerpt,
  fromPublicSeverity,
  limitItems,
  severityOrder,
  toPublicSeverity,
  toolResult,
  type PublicSeverity
} from "./formatters";

type ProjectDb = Pick<ReadOnlyProjectDatabase, "loadProjectData">;

export type GapType =
  | "missing_work"
  | "missing_tests"
  | "closed_work_without_verification"
  | "failed_tests"
  | "weak_requirement_language"
  | "all";

export type ReviewType =
  | "requirements_review"
  | "sprint_review"
  | "pi_planning"
  | "test_readiness_review"
  | "audit"
  | "general";

export interface RequirementListItem {
  id: string;
  externalId: string;
  title: string;
  textExcerpt: string;
  status?: string;
  verificationMethod?: string;
  linkedWorkCount: number;
  linkedTestCount: number;
  findingCount: number;
}

interface RequirementFact {
  requirement: Requirement;
  linkedWorkItems: WorkItem[];
  linkedTestCases: TestCase[];
  linkedTraceLinks: TraceLink[];
  findings: Finding[];
  passingTests: TestCase[];
  failedTests: TestCase[];
  skippedTests: TestCase[];
}

interface EntityReference {
  id: string;
  externalId: string;
  title: string;
  status?: string;
  type?: string;
  source?: string;
}

interface RequirementDetailTraceLink {
  id: string;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  linkType: TraceLink["linkType"];
  confidence: number;
  source: string;
}

export type RequirementDetailData =
  | {
      found: false;
      message: string;
    }
  | {
      found: true;
      requirement: {
        id: string;
        externalId: string;
        title: string;
        text: string;
        status?: string;
        verificationMethod?: string;
        type?: string;
        priority?: string;
        source: string;
      };
      linkedWorkItems: EntityReference[];
      linkedTestCases: EntityReference[];
      traceLinks: RequirementDetailTraceLink[];
      findings: Array<ReturnType<typeof findingToData>>;
      traceSummary: {
        linkedWorkCount: number;
        linkedTestCount: number;
        passingTests: number;
        failedTests: number;
        skippedTests: number;
        findingCount: number;
      };
    };

export type TraceLinksForRequirementData =
  | {
      found: false;
      message: string;
    }
  | {
      found: true;
      requirement: RequirementDetailData extends infer Detail
        ? Detail extends { found: true; requirement: infer Req }
          ? Req
          : never
        : never;
      linkedWorkItems: EntityReference[];
      linkedTestCases: EntityReference[];
      traceLinks: Array<Omit<RequirementDetailTraceLink, "id">>;
    };

export interface TraceabilityGap {
  gapType: Exclude<GapType, "all">;
  severity: PublicSeverity;
  requirement: {
    id: string;
    externalId: string;
    title: string;
    status?: string;
  };
  description: string;
  linkedWorkItems?: EntityReference[];
  linkedTestCases?: EntityReference[];
  findings?: Array<ReturnType<typeof findingToData>>;
}

const severitySchema = z.enum(["high", "medium", "low"]);
const entityTypeSchema = z.enum(["requirement", "workItem", "testCase", "traceLink"]);
const gapTypeSchema = z.enum([
  "missing_work",
  "missing_tests",
  "closed_work_without_verification",
  "failed_tests",
  "weak_requirement_language",
  "all"
]);
const reviewTypeSchema = z.enum([
  "requirements_review",
  "sprint_review",
  "pi_planning",
  "test_readiness_review",
  "audit",
  "general"
]);

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isClosedStatus(status: string | undefined): boolean {
  const normalized = normalize(status);
  return DEFAULT_RULESET.analyzer.closedStatuses.some((closedStatus) => normalized === closedStatus);
}

function isChangedRequirement(status: string | undefined): boolean {
  const normalized = normalize(status);
  return DEFAULT_RULESET.analyzer.draftStatuses.some((draftStatus) => normalized.includes(draftStatus));
}

function linkTouchesRequirement(link: TraceLink, requirement: Requirement, entityType?: EntityType): boolean {
  const sourceMatches =
    link.sourceType === "requirement" && link.sourceId === requirement.id && (!entityType || link.targetType === entityType);
  const targetMatches =
    link.targetType === "requirement" && link.targetId === requirement.id && (!entityType || link.sourceType === entityType);

  return sourceMatches || targetMatches;
}

function linkedIds(requirement: Requirement, traceLinks: TraceLink[], entityType: EntityType): string[] {
  return traceLinks
    .filter((link) => linkTouchesRequirement(link, requirement, entityType))
    .map((link) => (link.sourceId === requirement.id ? link.targetId : link.sourceId));
}

function compactWorkItem(workItem: WorkItem): EntityReference {
  return {
    id: workItem.id,
    externalId: workItem.externalId,
    title: workItem.title,
    status: workItem.status,
    type: workItem.type,
    source: workItem.source
  };
}

function compactTestCase(testCase: TestCase): EntityReference {
  return {
    id: testCase.id,
    externalId: testCase.externalId,
    title: testCase.name,
    status: testCase.status,
    type: testCase.classname,
    source: testCase.source
  };
}

function entityLabel(data: ProjectData, entityType: EntityType, entityId: string): string {
  if (entityType === "requirement") {
    const requirement = data.requirements.find((item) => item.id === entityId);
    return requirement ? `${requirement.externalId}: ${requirement.title}` : entityId;
  }

  if (entityType === "workItem") {
    const workItem = data.workItems.find((item) => item.id === entityId);
    return workItem ? `${workItem.externalId}: ${workItem.title}` : entityId;
  }

  const testCase = data.testCases.find((item) => item.id === entityId);
  return testCase ? `${testCase.externalId}: ${testCase.name}` : entityId;
}

function findingToData(finding: Finding, data: ProjectData) {
  return {
    id: finding.id,
    severity: toPublicSeverity(finding.severity),
    category: finding.category,
    title: finding.title,
    description: finding.description,
    entityType: finding.entityType,
    entityId: finding.entityId,
    entityLabel: entityLabel(data, finding.entityType, finding.entityId),
    recommendation: finding.recommendation
  };
}

function buildRequirementFacts(data: ProjectData): RequirementFact[] {
  const workById = new Map(data.workItems.map((workItem) => [workItem.id, workItem]));
  const testsById = new Map(data.testCases.map((testCase) => [testCase.id, testCase]));

  return data.requirements.map((requirement) => {
    const workIds = linkedIds(requirement, data.traceLinks, "workItem");
    const testIds = linkedIds(requirement, data.traceLinks, "testCase");
    const linkedWorkItems = workIds.flatMap((id) => {
      const workItem = workById.get(id);
      return workItem ? [workItem] : [];
    });
    const linkedTestCases = testIds.flatMap((id) => {
      const testCase = testsById.get(id);
      return testCase ? [testCase] : [];
    });

    return {
      requirement,
      linkedWorkItems,
      linkedTestCases,
      linkedTraceLinks: data.traceLinks.filter((link) => linkTouchesRequirement(link, requirement)),
      findings: data.findings.filter((finding) => finding.entityType === "requirement" && finding.entityId === requirement.id),
      passingTests: linkedTestCases.filter((testCase) => testCase.status === "passed"),
      failedTests: linkedTestCases.filter((testCase) => testCase.status === "failed" || testCase.status === "errored"),
      skippedTests: linkedTestCases.filter((testCase) => testCase.status === "skipped")
    };
  });
}

function requirementListItem(fact: RequirementFact): RequirementListItem {
  return {
    id: fact.requirement.id,
    externalId: fact.requirement.externalId,
    title: fact.requirement.title,
    textExcerpt: excerpt(fact.requirement.text),
    status: fact.requirement.status,
    verificationMethod: fact.requirement.verificationMethod,
    linkedWorkCount: fact.linkedWorkItems.length,
    linkedTestCount: fact.linkedTestCases.length,
    findingCount: fact.findings.length
  };
}

function sortGaps(gaps: TraceabilityGap[]): TraceabilityGap[] {
  return [...gaps].sort((left, right) => {
    const severityDiff = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }

    return left.requirement.externalId.localeCompare(right.requirement.externalId);
  });
}

function emptyProjectWarning(data: ProjectData): string | undefined {
  const hasData =
    data.requirements.length > 0 ||
    data.workItems.length > 0 ||
    data.testCases.length > 0 ||
    data.traceLinks.length > 0 ||
    data.findings.length > 0;

  return hasData ? undefined : "The project appears empty. Import requirements, work items, tests, or findings before asking review questions.";
}

function makeGap(
  fact: RequirementFact,
  gapType: Exclude<GapType, "all">,
  severity: PublicSeverity,
  description: string,
  findings: Finding[],
  data: ProjectData
): TraceabilityGap {
  return {
    gapType,
    severity,
    requirement: {
      id: fact.requirement.id,
      externalId: fact.requirement.externalId,
      title: fact.requirement.title,
      status: fact.requirement.status
    },
    description,
    linkedWorkItems: fact.linkedWorkItems.map(compactWorkItem),
    linkedTestCases: fact.linkedTestCases.map(compactTestCase),
    findings: findings.map((finding) => findingToData(finding, data))
  };
}

function allTraceabilityGaps(data: ProjectData): TraceabilityGap[] {
  const facts = buildRequirementFacts(data);
  const gaps: TraceabilityGap[] = [];

  facts.forEach((fact) => {
    const missingWorkFindings = fact.findings.filter((finding) => finding.category === "missing_work_trace");
    const missingVerificationFindings = fact.findings.filter((finding) => finding.category === "missing_verification");
    const weakLanguageFindings = fact.findings.filter((finding) => finding.category === "weak_wording");
    const closedWorkItems = fact.linkedWorkItems.filter((workItem) => isClosedStatus(workItem.status));

    if (fact.linkedWorkItems.length === 0) {
      gaps.push(
        makeGap(
          fact,
          "missing_work",
          "medium",
          `${fact.requirement.externalId} has no linked work item.`,
          missingWorkFindings,
          data
        )
      );
    }

    if (fact.linkedTestCases.length === 0) {
      gaps.push(
        makeGap(
          fact,
          "missing_tests",
          "high",
          `${fact.requirement.externalId} has no linked verification test case.`,
          missingVerificationFindings,
          data
        )
      );
    }

    if (fact.failedTests.length > 0) {
      gaps.push(
        makeGap(
          fact,
          "failed_tests",
          "high",
          `${fact.requirement.externalId} has ${fact.failedTests.length} linked failed test(s).`,
          [],
          data
        )
      );
    }

    if (closedWorkItems.length > 0 && fact.passingTests.length === 0) {
      const findings = data.findings.filter(
        (finding) => finding.category === "closed_work_without_verification" && closedWorkItems.some((workItem) => workItem.id === finding.entityId)
      );
      gaps.push(
        makeGap(
          fact,
          "closed_work_without_verification",
          "high",
          `${fact.requirement.externalId} is linked to closed work without passing verification evidence.`,
          findings,
          data
        )
      );
    }

    if (weakLanguageFindings.length > 0) {
      gaps.push(
        makeGap(
          fact,
          "weak_requirement_language",
          "medium",
          `${fact.requirement.externalId} has weak wording findings.`,
          weakLanguageFindings,
          data
        )
      );
    }
  });

  return sortGaps(gaps);
}

export function getProjectSummaryData(projectDb: ProjectDb) {
  const data = projectDb.loadProjectData();
  const facts = buildRequirementFacts(data);
  const findingsBySeverity = {
    high: data.findings.filter((finding) => toPublicSeverity(finding.severity) === "high").length,
    medium: data.findings.filter((finding) => toPublicSeverity(finding.severity) === "medium").length,
    low: data.findings.filter((finding) => toPublicSeverity(finding.severity) === "low").length
  };
  const requirementsWithoutWork = facts.filter((fact) => fact.linkedWorkItems.length === 0).length;
  const requirementsWithoutTests = facts.filter((fact) => fact.linkedTestCases.length === 0).length;
  const requirementsWithoutPassingTests = facts.filter((fact) => fact.passingTests.length === 0).length;
  const changedRequirementsWithoutPassingTests = facts.filter(
    (fact) => isChangedRequirement(fact.requirement.status) && fact.passingTests.length === 0
  ).length;
  const failedTestsLinkedToRequirements = facts.reduce((count, fact) => count + fact.failedTests.length, 0);
  const closedWorkWithoutVerification = allTraceabilityGaps(data).filter(
    (gap) => gap.gapType === "closed_work_without_verification"
  ).length;
  const weakRequirements = data.findings.filter((finding) => finding.category === "weak_wording").length;

  return {
    project: {
      id: data.project.id,
      name: data.project.name,
      updatedAt: data.project.updatedAt
    },
    counts: {
      requirements: data.requirements.length,
      workItems: data.workItems.length,
      testCases: data.testCases.length,
      traceLinks: data.traceLinks.length,
      findings: data.findings.length
    },
    findingsBySeverity,
    findingsByCategory: countBy(data.findings, (finding) => finding.category),
    concerns: {
      requirementsWithoutWork,
      requirementsWithoutTests,
      requirementsWithoutPassingTests,
      changedRequirementsWithoutPassingTests,
      failedTestsLinkedToRequirements,
      closedWorkWithoutVerification,
      weakRequirements
    },
    warning: emptyProjectWarning(data)
  };
}

export function formatProjectSummaryText(summary: ReturnType<typeof getProjectSummaryData>): string {
  const concerns = [
    `${summary.concerns.requirementsWithoutTests} requirement(s) have no linked verification evidence.`,
    `${summary.concerns.closedWorkWithoutVerification} closed work item link(s) lack passing verification.`,
    `${summary.concerns.weakRequirements} requirement(s) contain weak wording.`
  ];

  if (summary.concerns.changedRequirementsWithoutPassingTests > 0) {
    concerns.push(
      `${summary.concerns.changedRequirementsWithoutPassingTests} changed requirement(s) have no passing tests.`
    );
  }

  return [
    "Doorframe project summary:",
    `Project: ${summary.project.name}`,
    `Requirements: ${summary.counts.requirements}`,
    `Work items: ${summary.counts.workItems}`,
    `Tests: ${summary.counts.testCases}`,
    `Trace links: ${summary.counts.traceLinks}`,
    `Findings: ${summary.counts.findings} (high ${summary.findingsBySeverity.high}, medium ${summary.findingsBySeverity.medium}, low ${summary.findingsBySeverity.low})`,
    "",
    "Highest concern:",
    ...concerns.map((concern) => `- ${concern}`),
    summary.warning ? `\n${summary.warning}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function searchRequirementsData(
  projectDb: ProjectDb,
  filters: {
    query?: string;
    status?: string;
    findingCategory?: string;
    missingWork?: boolean;
    missingTests?: boolean;
    weakLanguage?: boolean;
    limit?: number;
  }
) {
  const data = projectDb.loadProjectData();
  const query = normalize(filters.query);
  const status = normalize(filters.status);
  const limit = clampLimit(filters.limit, 20, 100);
  const facts = buildRequirementFacts(data);

  const matched = facts.filter((fact) => {
    const requirement = fact.requirement;
    const matchesQuery =
      !query ||
      [requirement.externalId, requirement.title, requirement.text, requirement.status, requirement.verificationMethod]
        .map(normalize)
        .some((value) => value.includes(query));
    const matchesStatus = !status || normalize(requirement.status).includes(status);
    const matchesCategory =
      !filters.findingCategory || fact.findings.some((finding) => finding.category === filters.findingCategory);
    const matchesMissingWork = !filters.missingWork || fact.linkedWorkItems.length === 0;
    const matchesMissingTests = !filters.missingTests || fact.linkedTestCases.length === 0;
    const matchesWeakLanguage =
      !filters.weakLanguage || fact.findings.some((finding) => finding.category === "weak_wording");

    return (
      matchesQuery &&
      matchesStatus &&
      matchesCategory &&
      matchesMissingWork &&
      matchesMissingTests &&
      matchesWeakLanguage
    );
  });
  const limited = limitItems(matched.map(requirementListItem), limit);

  return {
    requirements: limited.items,
    limit: limited.limit,
    warning: emptyProjectWarning(data)
  };
}

export function formatRequirementsSearchText(result: ReturnType<typeof searchRequirementsData>): string {
  const lines = [`Requirement search returned ${result.limit.returned} of ${result.limit.total} result(s).`];
  const note = cappedNote(result.limit);

  if (note) {
    lines.push(note);
  }

  result.requirements.forEach((requirement) => {
    lines.push(
      `- ${requirement.externalId}: ${requirement.title} | status ${requirement.status ?? "unknown"} | work ${requirement.linkedWorkCount} | tests ${requirement.linkedTestCount} | findings ${requirement.findingCount}`
    );
  });

  if (result.warning) {
    lines.push(result.warning);
  }

  return lines.join("\n");
}

export function getTraceabilityMatrixData(
  projectDb: ProjectDb,
  options: {
    limit?: number;
  } = {}
) {
  const data = projectDb.loadProjectData();
  const limit = clampLimit(options.limit, 100, 100);
  const rows = buildRequirementFacts(data).map((fact) => ({
    requirementId: fact.requirement.externalId,
    title: fact.requirement.title,
    linkedWorkCount: fact.linkedWorkItems.length,
    linkedTestCount: fact.linkedTestCases.length,
    testStatusSummary: {
      passed: fact.passingTests.length,
      failed: fact.failedTests.length,
      skipped: fact.skippedTests.length
    },
    findingCount: fact.findings.length
  }));
  const limited = limitItems(rows, limit);

  return {
    rows: limited.items,
    limit: limited.limit,
    summary: {
      requirements: data.requirements.length,
      matrixIsCapped: limited.limit.capped,
      guidance: limited.limit.capped
        ? "This project is large. Use search_requirements, get_requirement_detail, or get_traceability_gaps for focused queries."
        : undefined
    },
    warning: emptyProjectWarning(data)
  };
}

export function getRequirementDetailData(projectDb: ProjectDb, requirementId: string): RequirementDetailData {
  const data = projectDb.loadProjectData();
  const requestedId = normalize(requirementId);
  const fact = buildRequirementFacts(data).find(
    (candidate) =>
      normalize(candidate.requirement.id) === requestedId ||
      normalize(candidate.requirement.externalId) === requestedId
  );

  if (!fact) {
    return {
      found: false,
      message: `Requirement "${requirementId}" was not found. Use search_requirements to find valid requirement IDs.`
    };
  }

  return {
    found: true,
    requirement: {
      id: fact.requirement.id,
      externalId: fact.requirement.externalId,
      title: fact.requirement.title,
      text: fact.requirement.text,
      status: fact.requirement.status,
      verificationMethod: fact.requirement.verificationMethod,
      type: fact.requirement.type,
      priority: fact.requirement.priority,
      source: fact.requirement.source
    },
    linkedWorkItems: fact.linkedWorkItems.map(compactWorkItem),
    linkedTestCases: fact.linkedTestCases.map(compactTestCase),
    traceLinks: fact.linkedTraceLinks.map((link) => ({
      id: link.id,
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      targetType: link.targetType,
      targetId: link.targetId,
      linkType: link.linkType,
      confidence: link.confidence,
      source: link.source
    })),
    findings: fact.findings.map((finding) => findingToData(finding, data)),
    traceSummary: {
      linkedWorkCount: fact.linkedWorkItems.length,
      linkedTestCount: fact.linkedTestCases.length,
      passingTests: fact.passingTests.length,
      failedTests: fact.failedTests.length,
      skippedTests: fact.skippedTests.length,
      findingCount: fact.findings.length
    }
  };
}

export function formatRequirementDetailText(result: ReturnType<typeof getRequirementDetailData>): string {
  if (!result.found) {
    return result.message;
  }

  const lines = [
    `${result.requirement.externalId}: ${result.requirement.title}`,
    `Status: ${result.requirement.status ?? "unknown"}`,
    `Verification method: ${result.requirement.verificationMethod ?? "none"}`,
    "",
    result.requirement.text,
    "",
    `Linked work items: ${result.traceSummary.linkedWorkCount}`,
    `Linked tests: ${result.traceSummary.linkedTestCount} (passed ${result.traceSummary.passingTests}, failed ${result.traceSummary.failedTests}, skipped ${result.traceSummary.skippedTests})`,
    `Findings: ${result.traceSummary.findingCount}`
  ];

  result.findings.slice(0, 5).forEach((finding) => {
    lines.push(`- ${finding.severity} ${finding.category}: ${finding.title}`);
  });

  return lines.join("\n");
}

export function listFindingsData(
  projectDb: ProjectDb,
  filters: {
    severity?: PublicSeverity;
    category?: string;
    entityType?: EntityType | "traceLink";
    limit?: number;
  }
) {
  const data = projectDb.loadProjectData();
  const limit = clampLimit(filters.limit, 25, 100);
  const coreSeverity = filters.severity ? fromPublicSeverity(filters.severity) : undefined;
  const findings = data.findings
    .filter((finding) => !coreSeverity || finding.severity === coreSeverity)
    .filter((finding) => !filters.category || finding.category === filters.category)
    .filter((finding) => !filters.entityType || finding.entityType === filters.entityType)
    .map((finding) => findingToData(finding, data))
    .sort((left, right) => {
      const severityDiff = severityOrder[left.severity] - severityOrder[right.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      return left.title.localeCompare(right.title);
    });
  const limited = limitItems(findings, limit);

  return {
    findings: limited.items,
    limit: limited.limit,
    grouped: {
      bySeverity: countBy(findings, (finding) => finding.severity),
      byCategory: countBy(findings, (finding) => finding.category)
    },
    warning: emptyProjectWarning(data)
  };
}

export function formatFindingsText(result: ReturnType<typeof listFindingsData>): string {
  const lines = [`Findings: ${result.limit.returned} of ${result.limit.total} result(s).`];
  const note = cappedNote(result.limit);

  if (note) {
    lines.push(note);
  }

  result.findings.forEach((finding) => {
    lines.push(`- ${finding.severity} ${finding.category}: ${finding.title} (${finding.entityLabel})`);
  });

  if (result.warning) {
    lines.push(result.warning);
  }

  return lines.join("\n");
}

export function getTraceabilityGapsData(
  projectDb: ProjectDb,
  filters: {
    gapType?: GapType;
    severity?: PublicSeverity;
    limit?: number;
  }
) {
  const data = projectDb.loadProjectData();
  const gapType = filters.gapType ?? "all";
  const limit = clampLimit(filters.limit, 25, 100);
  const filtered = allTraceabilityGaps(data)
    .filter((gap) => gapType === "all" || gap.gapType === gapType)
    .filter((gap) => !filters.severity || gap.severity === filters.severity);
  const limited = limitItems(filtered, limit);

  return {
    gaps: limited.items,
    limit: limited.limit,
    grouped: {
      bySeverity: countBy(filtered, (gap) => gap.severity),
      byType: countBy(filtered, (gap) => gap.gapType)
    },
    warning: emptyProjectWarning(data)
  };
}

export function formatTraceabilityGapsText(result: ReturnType<typeof getTraceabilityGapsData>): string {
  const lines = [`Traceability gaps: ${result.limit.returned} of ${result.limit.total} result(s).`];
  const note = cappedNote(result.limit);

  if (note) {
    lines.push(note);
  }

  result.gaps.forEach((gap) => {
    lines.push(`- ${gap.severity} ${gap.gapType}: ${gap.description}`);
  });

  if (result.warning) {
    lines.push(result.warning);
  }

  return lines.join("\n");
}

function discussionPointsFor(gaps: TraceabilityGap[], reviewType: ReviewType): string[] {
  const points: string[] = [];
  const byType = countBy(gaps, (gap) => gap.gapType);

  if ((byType.missing_tests ?? 0) > 0) {
    points.push("Which requirements need verification evidence before the review can close?");
  }

  if ((byType.failed_tests ?? 0) > 0) {
    points.push("Which failed linked tests are blocking readiness?");
  }

  if ((byType.closed_work_without_verification ?? 0) > 0) {
    points.push("Which closed work items should be reopened or linked to passing evidence?");
  }

  if ((byType.weak_requirement_language ?? 0) > 0 || reviewType === "requirements_review") {
    points.push("Which weakly worded requirements need clarification before approval?");
  }

  if ((byType.missing_work ?? 0) > 0 && reviewType !== "test_readiness_review") {
    points.push("Which requirements need implementation ownership or work-item mapping?");
  }

  return points;
}

export function getReviewRiskSummaryData(
  projectDb: ProjectDb,
  options: {
    reviewType?: ReviewType;
    limit?: number;
  }
) {
  const reviewType = options.reviewType ?? "general";
  const limit = clampLimit(options.limit, 10, 100);
  const data = projectDb.loadProjectData();
  const gaps = getTraceabilityGapsData(projectDb, { gapType: "all", limit }).gaps;
  const affectedRequirements = Array.from(
    new Map(gaps.map((gap) => [gap.requirement.id, gap.requirement])).values()
  ).slice(0, limit);
  const summary =
    gaps.length === 0
      ? "No high-priority review risks were found in Doorframe findings and traceability data."
      : `${gaps.length} top review risk item(s) were found from Doorframe findings and traceability data.`;
  const suggestedDiscussionPoints = discussionPointsFor(gaps, reviewType);
  const recommendedNextChecks = [
    "Use get_requirement_detail on affected requirements before making readiness claims.",
    "Confirm whether missing verification is intentionally handled outside imported test evidence.",
    "Review failed or skipped linked tests before closing review actions."
  ];

  return {
    reviewType,
    summary,
    topRisks: gaps,
    affectedRequirements,
    suggestedDiscussionPoints,
    recommendedNextChecks,
    warning: emptyProjectWarning(data)
  };
}

export function formatReviewRiskSummaryText(result: ReturnType<typeof getReviewRiskSummaryData>): string {
  const lines = [`Review risk summary (${result.reviewType}):`, result.summary];

  if (result.topRisks.length > 0) {
    lines.push("", "Top risks:");
    result.topRisks.forEach((gap) => {
      lines.push(`- ${gap.severity} ${gap.requirement.externalId}: ${gap.description}`);
    });
  }

  if (result.suggestedDiscussionPoints.length > 0) {
    lines.push("", "Suggested discussion points:");
    result.suggestedDiscussionPoints.forEach((point) => lines.push(`- ${point}`));
  }

  if (result.warning) {
    lines.push("", result.warning);
  }

  return lines.join("\n");
}

export function getTraceLinksForRequirementData(
  projectDb: ProjectDb,
  requirementId: string
): TraceLinksForRequirementData {
  const detail = getRequirementDetailData(projectDb, requirementId);

  if (!detail.found) {
    return detail;
  }

  return {
    found: true,
    requirement: detail.requirement,
    linkedWorkItems: detail.linkedWorkItems,
    linkedTestCases: detail.linkedTestCases,
    traceLinks: detail.traceLinks.map((link) => ({
      linkType: link.linkType,
      confidence: link.confidence,
      source: link.source,
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      targetType: link.targetType,
      targetId: link.targetId
    }))
  };
}

export function formatTraceLinksForRequirementText(result: ReturnType<typeof getTraceLinksForRequirementData>): string {
  if (!result.found) {
    return result.message;
  }

  const lines = [`Trace links for ${result.requirement.externalId}:`, `Links: ${result.traceLinks.length}`];
  result.traceLinks.forEach((link) => {
    lines.push(`- ${link.linkType} ${link.sourceType}:${link.sourceId} -> ${link.targetType}:${link.targetId} (${link.confidence})`);
  });
  return lines.join("\n");
}

export function findOrphanItemsData(
  projectDb: ProjectDb,
  options: {
    entityType: "requirements" | "workItems" | "testCases" | "all";
    limit?: number;
  }
) {
  const data = projectDb.loadProjectData();
  const limit = clampLimit(options.limit, 25, 100);
  const isLinked = (entityType: EntityType, entityId: string) =>
    data.traceLinks.some(
      (link) =>
        (link.sourceType === entityType && link.sourceId === entityId) ||
        (link.targetType === entityType && link.targetId === entityId)
    );
  const items = [
    ...(options.entityType === "requirements" || options.entityType === "all"
      ? data.requirements
          .filter((requirement) => !isLinked("requirement", requirement.id))
          .map((requirement) => ({
            entityType: "requirement" as const,
            id: requirement.id,
            externalId: requirement.externalId,
            title: requirement.title,
            status: requirement.status
          }))
      : []),
    ...(options.entityType === "workItems" || options.entityType === "all"
      ? data.workItems
          .filter((workItem) => !isLinked("workItem", workItem.id))
          .map((workItem) => ({
            entityType: "workItem" as const,
            id: workItem.id,
            externalId: workItem.externalId,
            title: workItem.title,
            status: workItem.status
          }))
      : []),
    ...(options.entityType === "testCases" || options.entityType === "all"
      ? data.testCases
          .filter((testCase) => !isLinked("testCase", testCase.id))
          .map((testCase) => ({
            entityType: "testCase" as const,
            id: testCase.id,
            externalId: testCase.externalId,
            title: testCase.name,
            status: testCase.status
          }))
      : [])
  ].sort((left, right) => `${left.entityType}:${left.externalId}`.localeCompare(`${right.entityType}:${right.externalId}`));
  const limited = limitItems(items, limit);

  return {
    items: limited.items,
    limit: limited.limit,
    grouped: countBy(items, (item) => item.entityType),
    warning: emptyProjectWarning(data)
  };
}

export function formatOrphanItemsText(result: ReturnType<typeof findOrphanItemsData>): string {
  const lines = [`Orphan items: ${result.limit.returned} of ${result.limit.total} result(s).`];
  const note = cappedNote(result.limit);

  if (note) {
    lines.push(note);
  }

  result.items.forEach((item) => {
    lines.push(`- ${item.entityType} ${item.externalId}: ${item.title}`);
  });

  if (result.warning) {
    lines.push(result.warning);
  }

  return lines.join("\n");
}

function safeTool(callback: () => CallToolResult): CallToolResult {
  try {
    return callback();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Doorframe MCP tool failed.";
    return {
      isError: true,
      structuredContent: {
        error: message
      },
      content: [
        {
          type: "text",
          text: message
        }
      ]
    };
  }
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};

export function registerDoorframeTools(server: McpServer, projectDb: ProjectDb): void {
  server.registerTool(
    "get_project_summary",
    {
      title: "Get project summary",
      description:
        "Get a summary of the current Doorframe project, including counts for requirements, work items, tests, trace links, and findings.",
      inputSchema: {},
      annotations: readOnlyAnnotations
    },
    () =>
      safeTool(() => {
        const data = getProjectSummaryData(projectDb);
        return toolResult(formatProjectSummaryText(data), data);
      })
  );

  server.registerTool(
    "search_requirements",
    {
      title: "Search requirements",
      description: "Search requirements by ID, title, text, status, verification method, or finding category.",
      inputSchema: {
        query: z.string().optional(),
        status: z.string().optional(),
        findingCategory: z.string().optional(),
        missingWork: z.boolean().optional(),
        missingTests: z.boolean().optional(),
        weakLanguage: z.boolean().optional(),
        limit: z.number().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool(() => {
        const data = searchRequirementsData(projectDb, args);
        return toolResult(formatRequirementsSearchText(data), data);
      })
  );

  server.registerTool(
    "get_requirement_detail",
    {
      title: "Get requirement detail",
      description: "Get one requirement with linked work items, linked tests, trace links, and findings.",
      inputSchema: {
        requirementId: z.string()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool(() => {
        const data = getRequirementDetailData(projectDb, args.requirementId);
        return toolResult(formatRequirementDetailText(data), data);
      })
  );

  server.registerTool(
    "list_findings",
    {
      title: "List findings",
      description: "List Doorframe findings with filters.",
      inputSchema: {
        severity: severitySchema.optional(),
        category: z.string().optional(),
        entityType: entityTypeSchema.optional(),
        limit: z.number().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool(() => {
        const data = listFindingsData(projectDb, args);
        return toolResult(formatFindingsText(data), data);
      })
  );

  server.registerTool(
    "get_traceability_gaps",
    {
      title: "Get traceability gaps",
      description: "Return the most important traceability gaps in the project.",
      inputSchema: {
        gapType: gapTypeSchema.optional(),
        severity: severitySchema.optional(),
        limit: z.number().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool(() => {
        const data = getTraceabilityGapsData(projectDb, args);
        return toolResult(formatTraceabilityGapsText(data), data);
      })
  );

  server.registerTool(
    "get_review_risk_summary",
    {
      title: "Get review risk summary",
      description:
        "Summarize the highest-risk issues before a requirements review, sprint review, PI planning event, test readiness review, or audit.",
      inputSchema: {
        reviewType: reviewTypeSchema.optional(),
        limit: z.number().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool(() => {
        const data = getReviewRiskSummaryData(projectDb, args);
        return toolResult(formatReviewRiskSummaryText(data), data);
      })
  );

  server.registerTool(
    "get_trace_links_for_requirement",
    {
      title: "Get trace links for requirement",
      description: "Get the trace links for one requirement.",
      inputSchema: {
        requirementId: z.string()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool(() => {
        const data = getTraceLinksForRequirementData(projectDb, args.requirementId);
        return toolResult(formatTraceLinksForRequirementText(data), data);
      })
  );

  server.registerTool(
    "find_orphan_items",
    {
      title: "Find orphan items",
      description: "Find requirements, work items, or tests that are not linked.",
      inputSchema: {
        entityType: z.enum(["requirements", "workItems", "testCases", "all"]),
        limit: z.number().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool(() => {
        const data = findOrphanItemsData(projectDb, args);
        return toolResult(formatOrphanItemsText(data), data);
      })
  );
}
