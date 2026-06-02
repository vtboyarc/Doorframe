import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  DEFAULT_RULESET,
  snapshotFromProjectData,
  type Baseline,
  type EntityType,
  type Finding,
  type Project,
  type ProjectData,
  type ProjectSnapshot,
  type Requirement,
  type RequirementInput,
  type TestCase,
  type TraceLink,
  type WorkItem
} from "@doorframe/core";
import {
  compareRequirementBaselines,
  type BaselineChangedRequirement,
  type BaselineDiffReport,
  type BaselineFieldChange,
  type ChangeConcern
} from "@doorframe/analyzers";
import type { ReadOnlyProjectDatabase } from "@doorframe/storage";
import {
  resultCountFromToolResult,
  sanitizeParameters,
  writeAuditLogEntry
} from "./audit";
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
import {
  canReturnFullText,
  dataPolicy,
  normalizeDoorframeMcpOptions,
  resultLimit,
  shouldHideRawText,
  type DoorframeMcpOptions
} from "./options";

type ProjectDb = Pick<ReadOnlyProjectDatabase, "loadProjectData"> &
  Partial<Pick<ReadOnlyProjectDatabase, "listBaselines">>;

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
  textExcerpt?: string;
  rawTextHidden?: boolean;
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
        text?: string;
        textExcerpt?: string;
        rawTextHidden?: boolean;
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
const changeTypeSchema = z.enum(["added", "deleted", "changed", "all"]);
const concernLevelSchema = z.enum(["high", "medium", "low"]);
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

function requirementListItem(
  fact: RequirementFact,
  options: Partial<DoorframeMcpOptions> = {}
): RequirementListItem {
  const hideText = shouldHideRawText(options);

  return {
    id: fact.requirement.id,
    externalId: fact.requirement.externalId,
    title: fact.requirement.title,
    textExcerpt: hideText ? undefined : excerpt(fact.requirement.text),
    rawTextHidden: hideText || undefined,
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
  },
  options: Partial<DoorframeMcpOptions> = {}
) {
  const data = projectDb.loadProjectData();
  const query = normalize(filters.query);
  const status = normalize(filters.status);
  const limit = resultLimit(filters.limit, options, 20, 100);
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
  const limited = limitItems(matched.map((fact) => requirementListItem(fact, options)), limit);

  return {
    requirements: limited.items,
    limit: limited.limit,
    dataPolicy: dataPolicy(options),
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

export function getRequirementDetailData(
  projectDb: ProjectDb,
  requirementId: string,
  options: Partial<DoorframeMcpOptions> = {}
): RequirementDetailData {
  const data = projectDb.loadProjectData();
  const requestedId = normalize(requirementId);
  const hideText = shouldHideRawText(options);
  const includeFullText = canReturnFullText(options);
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
      text: includeFullText ? fact.requirement.text : undefined,
      textExcerpt: hideText ? undefined : excerpt(fact.requirement.text),
      rawTextHidden: hideText || undefined,
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
    result.requirement.text
      ? `\n${result.requirement.text}`
      : result.requirement.textExcerpt
        ? `\nExcerpt: ${result.requirement.textExcerpt}`
        : "\nRequirement text hidden by MCP data-minimization settings.",
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
  },
  options: Partial<DoorframeMcpOptions> = {}
) {
  const data = projectDb.loadProjectData();
  const gapType = filters.gapType ?? "all";
  const limit = resultLimit(filters.limit, options, 25, 100);
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
  args: {
    reviewType?: ReviewType;
    limit?: number;
  },
  options: Partial<DoorframeMcpOptions> = {}
) {
  const reviewType = args.reviewType ?? "general";
  const limit = resultLimit(args.limit, options, 10, 100);
  const data = projectDb.loadProjectData();
  const gaps = getTraceabilityGapsData(projectDb, { gapType: "all", limit }, options).gaps;
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
  requirementId: string,
  options: Partial<DoorframeMcpOptions> = {}
): TraceLinksForRequirementData {
  const detail = getRequirementDetailData(projectDb, requirementId, options);

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

interface BaselineDescriptor {
  id: string;
  label: string;
  createdAt?: string;
  source: "stored" | "current";
}

interface BaselineComparison {
  project: Pick<Project, "id" | "name">;
  baselineA: BaselineDescriptor;
  baselineB: BaselineDescriptor;
  snapshotA: ProjectSnapshot;
  snapshotB: ProjectSnapshot;
  report: BaselineDiffReport;
  warning?: string;
}

type RequirementChangeType = "added" | "deleted" | "changed";

interface StaleTraceCandidate {
  requirement: {
    externalId: string;
    title: string;
    changeType: RequirementChangeType;
    concern: ChangeConcern;
  };
  reasons: string[];
  staleIndicators: string[];
  linkedWorkItems: EntityReference[];
  linkedTestCases: EntityReference[];
  suggestedNextChecks: string[];
}

function snapshotProjectData(project: Project, snapshot: ProjectSnapshot): ProjectData {
  return {
    project,
    requirements: snapshot.requirements,
    workItems: snapshot.workItems,
    testCases: snapshot.testCases,
    traceLinks: snapshot.traceLinks,
    findings: snapshot.findings,
    importBatches: []
  };
}

function baselineDescriptor(baseline: Baseline): BaselineDescriptor {
  return {
    id: baseline.id,
    label: baseline.label,
    createdAt: baseline.createdAt,
    source: "stored"
  };
}

function currentBaselineDescriptor(): BaselineDescriptor {
  return {
    id: "current",
    label: "Current project data",
    source: "current"
  };
}

function findBaseline(baselines: Baseline[], requestedId: string | undefined): Baseline | undefined {
  if (!requestedId || requestedId === "current") {
    return undefined;
  }

  const normalized = normalize(requestedId);
  return baselines.find(
    (baseline) => normalize(baseline.id) === normalized || normalize(baseline.label) === normalized
  );
}

function requirementInputs(snapshot: ProjectSnapshot): RequirementInput[] {
  return snapshot.requirements.map((requirement) => ({
    externalId: requirement.externalId,
    title: requirement.title,
    text: requirement.text,
    source: requirement.source,
    type: requirement.type,
    status: requirement.status,
    priority: requirement.priority,
    verificationMethod: requirement.verificationMethod,
    parentExternalId: requirement.parentExternalId,
    rawAttributes: requirement.rawAttributes
  }));
}

function requirementExternalIdByInternalId(snapshot: ProjectSnapshot): Map<string, string> {
  return new Map(snapshot.requirements.map((requirement) => [requirement.id, requirement.externalId]));
}

function entityIdsForRequirement(snapshot: ProjectSnapshot, requirementExternalId: string, entityType: EntityType): string[] {
  const requirement = snapshot.requirements.find((candidate) => candidate.externalId === requirementExternalId);
  if (!requirement) {
    return [];
  }

  return snapshot.traceLinks
    .filter((link) => linkTouchesRequirement(link, requirement, entityType))
    .map((link) => (link.sourceId === requirement.id ? link.targetId : link.sourceId));
}

function linkedWorkItemsForSnapshot(snapshot: ProjectSnapshot, requirementExternalId: string): WorkItem[] {
  const ids = new Set(entityIdsForRequirement(snapshot, requirementExternalId, "workItem"));
  return snapshot.workItems.filter((workItem) => ids.has(workItem.id));
}

function linkedTestsForSnapshot(snapshot: ProjectSnapshot, requirementExternalId: string): TestCase[] {
  const ids = new Set(entityIdsForRequirement(snapshot, requirementExternalId, "testCase"));
  return snapshot.testCases.filter((testCase) => ids.has(testCase.id));
}

function workItemContexts(snapshot: ProjectSnapshot) {
  const requirementsByInternalId = requirementExternalIdByInternalId(snapshot);

  return snapshot.workItems.map((workItem) => ({
    externalId: workItem.externalId,
    title: workItem.title,
    status: workItem.status,
    requirementIds: snapshot.traceLinks
      .filter(
        (link) =>
          link.linkType === "implements" &&
          ((link.sourceType === "requirement" && link.targetType === "workItem" && link.targetId === workItem.id) ||
            (link.targetType === "requirement" && link.sourceType === "workItem" && link.sourceId === workItem.id))
      )
      .map((link) => requirementsByInternalId.get(link.sourceType === "requirement" ? link.sourceId : link.targetId))
      .filter((externalId): externalId is string => Boolean(externalId))
  }));
}

function testContexts(snapshot: ProjectSnapshot) {
  const requirementsByInternalId = requirementExternalIdByInternalId(snapshot);

  return snapshot.testCases.map((testCase) => ({
    externalId: testCase.externalId,
    name: testCase.name,
    status: testCase.status,
    requirementIds: snapshot.traceLinks
      .filter(
        (link) =>
          link.linkType === "verifies" &&
          ((link.sourceType === "requirement" && link.targetType === "testCase" && link.targetId === testCase.id) ||
            (link.targetType === "requirement" && link.sourceType === "testCase" && link.sourceId === testCase.id))
      )
      .map((link) => requirementsByInternalId.get(link.sourceType === "requirement" ? link.sourceId : link.targetId))
      .filter((externalId): externalId is string => Boolean(externalId))
  }));
}

function compareSnapshots(
  baselineA: BaselineDescriptor,
  baselineB: BaselineDescriptor,
  snapshotA: ProjectSnapshot,
  snapshotB: ProjectSnapshot
): BaselineDiffReport {
  return compareRequirementBaselines({
    baselineAName: baselineA.label,
    baselineBName: baselineB.label,
    requirementsA: requirementInputs(snapshotA),
    requirementsB: requirementInputs(snapshotB),
    workItems: workItemContexts(snapshotB),
    testCases: testContexts(snapshotB)
  });
}

function resolveBaselineComparison(
  projectDb: ProjectDb,
  args: { baselineAId?: string; baselineBId?: string } = {}
): BaselineComparison {
  const data = projectDb.loadProjectData();
  const currentSnapshot = snapshotFromProjectData(data);
  const baselines = [...(projectDb.listBaselines?.() ?? [])].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
  const requestedA = findBaseline(baselines, args.baselineAId);
  const requestedB = findBaseline(baselines, args.baselineBId);
  const wantsCurrentB = !args.baselineBId || args.baselineBId === "current";

  let baselineA: BaselineDescriptor;
  let baselineB: BaselineDescriptor;
  let snapshotA: ProjectSnapshot;
  let snapshotB: ProjectSnapshot;
  let warning: string | undefined;

  if (requestedA && (requestedB || wantsCurrentB)) {
    baselineA = baselineDescriptor(requestedA);
    snapshotA = requestedA.snapshot;
    baselineB = requestedB ? baselineDescriptor(requestedB) : currentBaselineDescriptor();
    snapshotB = requestedB ? requestedB.snapshot : currentSnapshot;
  } else if (!args.baselineAId && !args.baselineBId && baselines.length >= 2) {
    const [newer, older] = baselines;
    baselineA = baselineDescriptor(older);
    baselineB = baselineDescriptor(newer);
    snapshotA = older.snapshot;
    snapshotB = newer.snapshot;
  } else if (!args.baselineAId && !args.baselineBId && baselines.length === 1) {
    baselineA = baselineDescriptor(baselines[0]);
    baselineB = currentBaselineDescriptor();
    snapshotA = baselines[0].snapshot;
    snapshotB = currentSnapshot;
  } else {
    baselineA = currentBaselineDescriptor();
    baselineB = currentBaselineDescriptor();
    snapshotA = currentSnapshot;
    snapshotB = currentSnapshot;
    warning = args.baselineAId || args.baselineBId
      ? "Requested baseline was not found. Use stored baseline IDs or omit IDs to compare the latest available baselines."
      : "No stored baselines were found in this Doorframe project. Capture baselines in the local web app before asking baseline-diff questions.";
  }

  return {
    project: {
      id: data.project.id,
      name: data.project.name
    },
    baselineA,
    baselineB,
    snapshotA,
    snapshotB,
    report: compareSnapshots(baselineA, baselineB, snapshotA, snapshotB),
    warning
  };
}

function requirementSummary(requirement: RequirementInput, options: Partial<DoorframeMcpOptions>) {
  const hideText = shouldHideRawText(options);

  return {
    externalId: requirement.externalId,
    title: requirement.title,
    status: requirement.status,
    verificationMethod: requirement.verificationMethod,
    textExcerpt: hideText ? undefined : excerpt(requirement.text),
    rawTextHidden: hideText || undefined
  };
}

function changeFieldData(change: BaselineFieldChange, options: Partial<DoorframeMcpOptions>) {
  if (change.field !== "text") {
    return change;
  }

  if (shouldHideRawText(options)) {
    return {
      field: change.field,
      rawTextHidden: true
    };
  }

  if (canReturnFullText(options)) {
    return change;
  }

  return {
    field: change.field,
    beforeExcerpt: change.before ? excerpt(change.before) : undefined,
    afterExcerpt: change.after ? excerpt(change.after) : undefined
  };
}

function changedRequirementSummary(
  change: BaselineChangedRequirement,
  options: Partial<DoorframeMcpOptions>
) {
  return {
    changeType: "changed" as const,
    externalId: change.externalId,
    title: change.title,
    concern: change.concern,
    concernReasons: change.concernReasons,
    changedFields: change.changes.map((fieldChange) => changeFieldData(fieldChange, options)),
    affectedWorkItemCount: change.affectedWorkItems.length,
    affectedTestCount: change.affectedTests.length,
    recommendations: change.recommendations
  };
}

function traceSummaryForExternalId(snapshot: ProjectSnapshot, requirementExternalId: string) {
  const workItems = linkedWorkItemsForSnapshot(snapshot, requirementExternalId);
  const testCases = linkedTestsForSnapshot(snapshot, requirementExternalId);

  return {
    linkedWorkItems: workItems.map(compactWorkItem),
    linkedTestCases: testCases.map(compactTestCase),
    passingTests: testCases.filter((testCase) => testCase.status === "passed").length,
    failedTests: testCases.filter((testCase) => testCase.status === "failed" || testCase.status === "errored").length,
    skippedTests: testCases.filter((testCase) => testCase.status === "skipped").length
  };
}

function numbersInText(text: string | undefined): string[] {
  return text?.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
}

function numericThresholdChangedInField(change: BaselineFieldChange): boolean {
  const before = numbersInText(change.before);
  const after = numbersInText(change.after);
  return before.length > 0 && after.length > 0 && before.join("|") !== after.join("|");
}

function workItemChanged(before: WorkItem | undefined, after: WorkItem): boolean {
  if (!before) {
    return true;
  }

  return (
    before.title !== after.title ||
    (before.description ?? "") !== (after.description ?? "") ||
    (before.status ?? "") !== (after.status ?? "") ||
    (before.type ?? "") !== (after.type ?? "")
  );
}

function testText(testCase: TestCase): string {
  return [testCase.externalId, testCase.name, testCase.classname, testCase.failureMessage]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function removedWords(change: BaselineFieldChange): string[] {
  return (change.wordDiff ?? [])
    .filter((token) => token.type === "removed" && token.value.length >= 5)
    .map((token) => token.value.toLowerCase().replace(/[^a-z0-9.-]/g, ""))
    .filter(Boolean);
}

function testAppearsToReferenceOldText(change: BaselineFieldChange, testCases: TestCase[]): boolean {
  const oldNumbers = numbersInText(change.before);
  const newNumbers = new Set(numbersInText(change.after));
  const removed = removedWords(change);

  return testCases.some((testCase) => {
    const haystack = testText(testCase);
    const referencesOldNumber = oldNumbers.some((value) => !newNumbers.has(value) && haystack.includes(value));
    const referencesRemovedWord = removed.some((value) => haystack.includes(value));
    return referencesOldNumber || referencesRemovedWord;
  });
}

function candidateConcern(reasons: string[], fallback: ChangeConcern): ChangeConcern {
  if (reasons.some((reason) => /deleted|numeric|failed|errored|closed work|newer passing/i.test(reason))) {
    return "high";
  }

  if (reasons.some((reason) => /verification|old threshold|old wording|no linked/i.test(reason))) {
    return "medium";
  }

  return fallback;
}

function suggestedChecksForCandidate(candidate: Pick<StaleTraceCandidate, "reasons">): string[] {
  const checks = new Set<string>();

  candidate.reasons.forEach((reason) => {
    if (/work item/i.test(reason)) {
      checks.add("Confirm linked work still implements the current requirement text.");
    }
    if (/test|verification|threshold|wording/i.test(reason)) {
      checks.add("Review linked test evidence against the changed requirement wording and threshold.");
    }
    if (/deleted/i.test(reason)) {
      checks.add("Close, remove, or remap links for deleted requirements.");
    }
    if (/new requirement/i.test(reason)) {
      checks.add("Add implementation ownership and verification evidence for the new requirement.");
    }
  });

  checks.add("Use get_requirement_change_detail for the changed fields before making readiness claims.");
  return Array.from(checks);
}

function buildStaleTraceCandidates(comparison: BaselineComparison): StaleTraceCandidate[] {
  const candidates: StaleTraceCandidate[] = [];
  const beforeWorkByExternalId = new Map(comparison.snapshotA.workItems.map((workItem) => [workItem.externalId, workItem]));
  const afterRequirements = new Map(comparison.snapshotB.requirements.map((requirement) => [requirement.externalId, requirement]));
  const afterWork = new Map(comparison.snapshotB.workItems.map((workItem) => [workItem.externalId, workItem]));
  const afterTests = new Map(comparison.snapshotB.testCases.map((testCase) => [testCase.externalId, testCase]));

  comparison.report.changed.forEach((change) => {
    const reasons: string[] = [];
    const indicators: string[] = [];
    const linkedWorkItems = linkedWorkItemsForSnapshot(comparison.snapshotB, change.externalId);
    const linkedTestCases = linkedTestsForSnapshot(comparison.snapshotB, change.externalId);
    const textChange = change.changes.find((fieldChange) => fieldChange.field === "text");
    const verificationChange = change.changes.find((fieldChange) => fieldChange.field === "verificationMethod");
    const afterRequirement = afterRequirements.get(change.externalId);
    const linkedWorkChanged = linkedWorkItems.some((workItem) =>
      workItemChanged(beforeWorkByExternalId.get(workItem.externalId), workItem)
    );

    if (textChange && !linkedWorkChanged) {
      reasons.push("Requirement text changed and no linked work item changed.");
      indicators.push("work-link-not-updated");
    }

    if (textChange && numericThresholdChangedInField(textChange)) {
      reasons.push("Numeric threshold changed in requirement text.");
      indicators.push("numeric-threshold-change");
    }

    if (verificationChange) {
      reasons.push("Verification method changed.");
      indicators.push("verification-method-change");
    }

    const linkedClosedWork = linkedWorkItems.filter((workItem) => isClosedStatus(workItem.status));
    const newerPassingTest = linkedTestCases.some(
      (testCase) => testCase.status === "passed" && afterRequirement && testCase.updatedAt > afterRequirement.updatedAt
    );
    if (linkedClosedWork.length > 0 && !newerPassingTest) {
      reasons.push("Requirement is linked to closed work but no newer passing test evidence was found.");
      indicators.push("closed-work-without-newer-passing-test");
    }

    if (textChange && testAppearsToReferenceOldText(textChange, linkedTestCases)) {
      reasons.push("Linked tests appear to reference old threshold or old wording.");
      indicators.push("test-may-reference-old-text");
    }

    if (reasons.length > 0) {
      const candidate = {
        requirement: {
          externalId: change.externalId,
          title: change.title,
          changeType: "changed" as const,
          concern: candidateConcern(reasons, change.concern)
        },
        reasons,
        staleIndicators: indicators,
        linkedWorkItems: linkedWorkItems.map(compactWorkItem),
        linkedTestCases: linkedTestCases.map(compactTestCase),
        suggestedNextChecks: [] as string[]
      };
      candidate.suggestedNextChecks = suggestedChecksForCandidate(candidate);
      candidates.push(candidate);
    }
  });

  comparison.report.deleted.forEach((requirement) => {
    const linkedWork = linkedWorkItemsForSnapshot(comparison.snapshotA, requirement.externalId).filter((workItem) =>
      afterWork.has(workItem.externalId)
    );
    const linkedTests = linkedTestsForSnapshot(comparison.snapshotA, requirement.externalId).filter((testCase) =>
      afterTests.has(testCase.externalId)
    );

    if (linkedWork.length === 0 && linkedTests.length === 0) {
      return;
    }

    const candidate = {
      requirement: {
        externalId: requirement.externalId,
        title: requirement.title,
        changeType: "deleted" as const,
        concern: "high" as const
      },
      reasons: ["Requirement was deleted but linked work or tests remain in the newer baseline."],
      staleIndicators: ["deleted-requirement-retains-linked-items"],
      linkedWorkItems: linkedWork.map(compactWorkItem),
      linkedTestCases: linkedTests.map(compactTestCase),
      suggestedNextChecks: [] as string[]
    };
    candidate.suggestedNextChecks = suggestedChecksForCandidate(candidate);
    candidates.push(candidate);
  });

  comparison.report.added.forEach((requirement) => {
    const linkedWork = linkedWorkItemsForSnapshot(comparison.snapshotB, requirement.externalId);
    const linkedTests = linkedTestsForSnapshot(comparison.snapshotB, requirement.externalId);

    if (linkedWork.length > 0 && linkedTests.length > 0) {
      return;
    }

    const candidate = {
      requirement: {
        externalId: requirement.externalId,
        title: requirement.title,
        changeType: "added" as const,
        concern: "medium" as const
      },
      reasons: ["New requirement has no linked work or tests."],
      staleIndicators: ["new-requirement-missing-links"],
      linkedWorkItems: linkedWork.map(compactWorkItem),
      linkedTestCases: linkedTests.map(compactTestCase),
      suggestedNextChecks: [] as string[]
    };
    candidate.suggestedNextChecks = suggestedChecksForCandidate(candidate);
    candidates.push(candidate);
  });

  return candidates.sort((left, right) => {
    const concernDiff = severityOrder[left.requirement.concern] - severityOrder[right.requirement.concern];
    if (concernDiff !== 0) {
      return concernDiff;
    }

    return left.requirement.externalId.localeCompare(right.requirement.externalId);
  });
}

function baselineResponseEnvelope(comparison: BaselineComparison, options: Partial<DoorframeMcpOptions>) {
  return {
    project: comparison.project,
    baselineA: comparison.baselineA,
    baselineB: comparison.baselineB,
    dataPolicy: dataPolicy(options),
    warning: comparison.warning
  };
}

export function getBaselineDiffSummaryData(
  projectDb: ProjectDb,
  args: { baselineAId?: string; baselineBId?: string } = {},
  options: Partial<DoorframeMcpOptions> = {}
) {
  const comparison = resolveBaselineComparison(projectDb, args);

  return {
    ...baselineResponseEnvelope(comparison, options),
    summary: comparison.report.summary,
    resultCount: comparison.report.summary.changed
  };
}

export function formatBaselineDiffSummaryText(result: ReturnType<typeof getBaselineDiffSummaryData>): string {
  const lines = [
    `Baseline diff: ${result.baselineA.label} -> ${result.baselineB.label}`,
    `Added: ${result.summary.added}`,
    `Deleted: ${result.summary.deleted}`,
    `Changed: ${result.summary.changed}`,
    `Unchanged: ${result.summary.unchanged}`,
    `High-concern changed: ${result.summary.highConcern}`
  ];

  if (result.warning) {
    lines.push(result.warning);
  }

  return lines.join("\n");
}

export function listChangedRequirementsData(
  projectDb: ProjectDb,
  args: {
    baselineAId?: string;
    baselineBId?: string;
    changeType?: "added" | "deleted" | "changed" | "all";
    concernLevel?: ChangeConcern;
    limit?: number;
  } = {},
  options: Partial<DoorframeMcpOptions> = {}
) {
  const comparison = resolveBaselineComparison(projectDb, args);
  const limit = resultLimit(args.limit, options, 25, 100);
  const requestedType = args.changeType ?? "all";
  const includeUnconcernedChanges = !args.concernLevel;
  const items = [
    ...(includeUnconcernedChanges && (requestedType === "all" || requestedType === "added")
      ? comparison.report.added.map((requirement) => ({
          changeType: "added" as const,
          requirement: requirementSummary(requirement, options)
        }))
      : []),
    ...(includeUnconcernedChanges && (requestedType === "all" || requestedType === "deleted")
      ? comparison.report.deleted.map((requirement) => ({
          changeType: "deleted" as const,
          requirement: requirementSummary(requirement, options)
        }))
      : []),
    ...(requestedType === "all" || requestedType === "changed"
      ? comparison.report.changed
          .filter((change) => !args.concernLevel || change.concern === args.concernLevel)
          .map((change) => changedRequirementSummary(change, options))
      : [])
  ];
  const limited = limitItems(items, limit);

  return {
    ...baselineResponseEnvelope(comparison, options),
    requirements: limited.items,
    limit: limited.limit,
    resultCount: limited.limit.returned
  };
}

export function formatChangedRequirementsText(result: ReturnType<typeof listChangedRequirementsData>): string {
  const lines = [
    `Changed requirements: ${result.limit.returned} of ${result.limit.total} result(s) for ${result.baselineA.label} -> ${result.baselineB.label}.`
  ];
  const note = cappedNote(result.limit);

  if (note) {
    lines.push(note);
  }

  result.requirements.forEach((item) => {
    if ("requirement" in item) {
      lines.push(`- ${item.changeType} ${item.requirement.externalId}: ${item.requirement.title}`);
      return;
    }

    lines.push(`- changed ${item.externalId}: ${item.title} (${item.concern})`);
  });

  if (result.warning) {
    lines.push(result.warning);
  }

  return lines.join("\n");
}

export function getRequirementChangeDetailData(
  projectDb: ProjectDb,
  args: { requirementId: string; baselineAId?: string; baselineBId?: string },
  options: Partial<DoorframeMcpOptions> = {}
) {
  const comparison = resolveBaselineComparison(projectDb, args);
  const requestedId = normalize(args.requirementId);
  const changed = comparison.report.changed.find((change) => normalize(change.externalId) === requestedId);
  const added = comparison.report.added.find((requirement) => normalize(requirement.externalId) === requestedId);
  const deleted = comparison.report.deleted.find((requirement) => normalize(requirement.externalId) === requestedId);
  const facts = buildRequirementFacts(snapshotProjectData({ ...comparison.project, updatedAt: "", createdAt: "" }, comparison.snapshotB));
  const fact = facts.find((candidate) => normalize(candidate.requirement.externalId) === requestedId);
  const staleCandidates = buildStaleTraceCandidates(comparison).filter(
    (candidate) => normalize(candidate.requirement.externalId) === requestedId
  );

  if (!changed && !added && !deleted) {
    return {
      ...baselineResponseEnvelope(comparison, options),
      found: false as const,
      message: `Requirement "${args.requirementId}" was not added, deleted, or changed between the selected baselines.`
    };
  }

  const externalId = changed?.externalId ?? added?.externalId ?? deleted?.externalId ?? args.requirementId;
  const traceSummary = traceSummaryForExternalId(
    deleted ? comparison.snapshotA : comparison.snapshotB,
    externalId
  );

  return {
    ...baselineResponseEnvelope(comparison, options),
    found: true as const,
    changeType: changed ? "changed" as const : added ? "added" as const : "deleted" as const,
    requirement: changed
      ? {
          externalId: changed.externalId,
          title: changed.title
        }
      : requirementSummary((added ?? deleted) as RequirementInput, options),
    concern: changed?.concern,
    concernReasons: changed?.concernReasons ?? [],
    changedFields: changed?.changes.map((change) => changeFieldData(change, options)) ?? [],
    linkedWorkItems: traceSummary.linkedWorkItems,
    linkedTestCases: traceSummary.linkedTestCases,
    findings: fact?.findings.map((finding) => findingToData(finding, snapshotProjectData({ ...comparison.project, updatedAt: "", createdAt: "" }, comparison.snapshotB))) ?? [],
    traceSummary,
    staleTraceIndicators: staleCandidates.flatMap((candidate) => candidate.staleIndicators),
    staleTraceReasons: staleCandidates.flatMap((candidate) => candidate.reasons),
    recommendations: changed?.recommendations ?? staleCandidates.flatMap((candidate) => candidate.suggestedNextChecks),
    resultCount: 1
  };
}

export function formatRequirementChangeDetailText(
  result: ReturnType<typeof getRequirementChangeDetailData>
): string {
  if (!result.found) {
    return result.message;
  }

  const lines = [
    `${result.requirement.externalId}: ${result.requirement.title}`,
    `Change type: ${result.changeType}`,
    result.concern ? `Concern: ${result.concern}` : "",
    `Changed fields: ${result.changedFields.map((change) => String((change as { field: string }).field)).join(", ") || "none"}`,
    `Linked work items: ${result.traceSummary.linkedWorkItems.length}`,
    `Linked tests: ${result.traceSummary.linkedTestCases.length} (passed ${result.traceSummary.passingTests}, failed ${result.traceSummary.failedTests}, skipped ${result.traceSummary.skippedTests})`
  ].filter(Boolean);

  if (result.staleTraceReasons.length > 0) {
    lines.push("", "Stale trace indicators:");
    result.staleTraceReasons.forEach((reason) => lines.push(`- ${reason}`));
  }

  if (result.warning) {
    lines.push("", result.warning);
  }

  return lines.join("\n");
}

export function getStaleTraceCandidatesData(
  projectDb: ProjectDb,
  args: {
    baselineAId?: string;
    baselineBId?: string;
    concernLevel?: ChangeConcern;
    limit?: number;
  } = {},
  options: Partial<DoorframeMcpOptions> = {}
) {
  const comparison = resolveBaselineComparison(projectDb, args);
  const limit = resultLimit(args.limit, options, 25, 100);
  const candidates = buildStaleTraceCandidates(comparison).filter(
    (candidate) => !args.concernLevel || candidate.requirement.concern === args.concernLevel
  );
  const limited = limitItems(candidates, limit);

  return {
    ...baselineResponseEnvelope(comparison, options),
    candidates: limited.items,
    limit: limited.limit,
    grouped: {
      byConcern: countBy(candidates, (candidate) => candidate.requirement.concern),
      byChangeType: countBy(candidates, (candidate) => candidate.requirement.changeType)
    },
    resultCount: limited.limit.returned
  };
}

export function formatStaleTraceCandidatesText(result: ReturnType<typeof getStaleTraceCandidatesData>): string {
  const lines = [`Stale trace candidates: ${result.limit.returned} of ${result.limit.total} result(s).`];
  const note = cappedNote(result.limit);

  if (note) {
    lines.push(note);
  }

  result.candidates.forEach((candidate) => {
    lines.push(`- ${candidate.requirement.concern} ${candidate.requirement.externalId}: ${candidate.reasons.join("; ")}`);
  });

  if (result.warning) {
    lines.push(result.warning);
  }

  return lines.join("\n");
}

export function getImpactedItemsForChangedRequirementData(
  projectDb: ProjectDb,
  args: { requirementId: string; baselineAId?: string; baselineBId?: string },
  options: Partial<DoorframeMcpOptions> = {}
) {
  const detail = getRequirementChangeDetailData(projectDb, args, options);

  if (!detail.found) {
    return detail;
  }

  const failedOrSkippedTests = detail.linkedTestCases.filter((testCase) =>
    ["failed", "errored", "skipped"].includes(testCase.status ?? "")
  );

  return {
    ...detail,
    impactedItems: {
      workItems: detail.linkedWorkItems,
      testCases: detail.linkedTestCases,
      failedOrSkippedTests,
      findings: detail.findings,
      traceLinksShouldBeChecked: detail.traceSummary.linkedWorkItems.length + detail.traceSummary.linkedTestCases.length
    },
    suggestedNextChecks: [
      ...new Set([
        ...detail.recommendations,
        "Check failed or skipped linked tests before review closure.",
        "Confirm all affected work items still map to the changed requirement."
      ])
    ]
  };
}

export function formatImpactedItemsText(
  result: ReturnType<typeof getImpactedItemsForChangedRequirementData>
): string {
  if (!result.found) {
    return result.message;
  }

  return [
    `Impacted items for ${result.requirement.externalId}:`,
    `Work items: ${result.impactedItems.workItems.length}`,
    `Tests: ${result.impactedItems.testCases.length}`,
    `Failed/skipped tests: ${result.impactedItems.failedOrSkippedTests.length}`,
    `Findings: ${result.impactedItems.findings.length}`
  ].join("\n");
}

export function getReviewBriefData(
  projectDb: ProjectDb,
  args: {
    reviewType?: ReviewType;
    baselineAId?: string;
    baselineBId?: string;
    limit?: number;
  } = {},
  options: Partial<DoorframeMcpOptions> = {}
) {
  const limit = resultLimit(args.limit, options, 10, 100);
  const projectSummary = getProjectSummaryData(projectDb);
  const baselineSummary = getBaselineDiffSummaryData(projectDb, args, options);
  const changedRequirements = listChangedRequirementsData(projectDb, { ...args, changeType: "changed", limit }, options);
  const staleTraceCandidates = getStaleTraceCandidatesData(projectDb, { ...args, limit }, options);
  const topGaps = getTraceabilityGapsData(projectDb, { gapType: "all", limit }, options);
  const missingVerification = getTraceabilityGapsData(projectDb, { gapType: "missing_tests", limit }, options);
  const failedTests = getTraceabilityGapsData(projectDb, { gapType: "failed_tests", limit }, options);
  const weakRequirements = getTraceabilityGapsData(
    projectDb,
    {
      gapType: "weak_requirement_language",
      limit
    },
    options
  );
  const reviewRisk = getReviewRiskSummaryData(projectDb, { reviewType: args.reviewType ?? "general", limit }, options);

  return {
    project: projectSummary.project,
    reviewType: args.reviewType ?? "general",
    projectSummary,
    baselineSummary,
    topGaps: topGaps.gaps,
    changedRequirements: changedRequirements.requirements,
    staleTraceCandidates: staleTraceCandidates.candidates,
    missingVerification: missingVerification.gaps,
    failedTests: failedTests.gaps,
    weakRequirements: weakRequirements.gaps,
    suggestedDiscussionTopics: [
      ...new Set([
        ...reviewRisk.suggestedDiscussionPoints,
        staleTraceCandidates.candidates.length > 0
          ? "Which changed requirements need trace-link or test-evidence refresh before review?"
          : "",
        baselineSummary.summary.changed > 0
          ? "Which changed requirements are review blockers or require updated verification?"
          : ""
      ].filter(Boolean))
    ],
    briefBoundary:
      "This is structured Doorframe data for review preparation, not an AI-generated final answer or compliance determination.",
    dataPolicy: dataPolicy(options),
    resultCount:
      topGaps.gaps.length +
      changedRequirements.requirements.length +
      staleTraceCandidates.candidates.length +
      missingVerification.gaps.length +
      failedTests.gaps.length +
      weakRequirements.gaps.length
  };
}

export function formatReviewBriefText(result: ReturnType<typeof getReviewBriefData>): string {
  const lines = [
    `Doorframe review brief facts (${result.reviewType}):`,
    `Project: ${result.project.name}`,
    `Top gaps: ${result.topGaps.length}`,
    `Changed requirements: ${result.changedRequirements.length}`,
    `Stale trace candidates: ${result.staleTraceCandidates.length}`,
    `Missing verification: ${result.missingVerification.length}`,
    `Failed test gaps: ${result.failedTests.length}`,
    `Weak requirements: ${result.weakRequirements.length}`,
    result.briefBoundary
  ];

  if (result.suggestedDiscussionTopics.length > 0) {
    lines.push("", "Suggested discussion topics:");
    result.suggestedDiscussionTopics.forEach((topic) => lines.push(`- ${topic}`));
  }

  return lines.join("\n");
}

function safeTool(
  toolName: string,
  project: Pick<Project, "id" | "name"> | undefined,
  options: DoorframeMcpOptions,
  parameters: Record<string, unknown>,
  callback: () => CallToolResult
): CallToolResult {
  const startedAt = Date.now();
  let result: CallToolResult;

  try {
    result = callback();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Doorframe MCP tool failed.";
    result = {
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

  writeAuditLogEntry(options, {
    timestamp: new Date().toISOString(),
    project,
    toolName,
    parameters: sanitizeParameters(parameters),
    resultCount: resultCountFromToolResult(result),
    mode: options.mode,
    success: !result.isError,
    durationMs: Date.now() - startedAt
  });

  return result;
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};

export function registerDoorframeTools(
  server: McpServer,
  projectDb: ProjectDb,
  rawOptions: Partial<DoorframeMcpOptions> = {}
): void {
  const options = normalizeDoorframeMcpOptions(rawOptions);
  let cachedProject: Pick<Project, "id" | "name"> | undefined;
  const auditProject = () => {
    if (!options.auditLogPath) {
      return undefined;
    }

    cachedProject ??= projectDb.loadProjectData().project;
    return cachedProject;
  };

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
      safeTool("get_project_summary", auditProject(), options, {}, () => {
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
      safeTool("search_requirements", auditProject(), options, args, () => {
        const data = searchRequirementsData(projectDb, args, options);
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
      safeTool("get_requirement_detail", auditProject(), options, args, () => {
        const data = getRequirementDetailData(projectDb, args.requirementId, options);
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
      safeTool("list_findings", auditProject(), options, args, () => {
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
      safeTool("get_traceability_gaps", auditProject(), options, args, () => {
        const data = getTraceabilityGapsData(projectDb, args, options);
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
      safeTool("get_review_risk_summary", auditProject(), options, args, () => {
        const data = getReviewRiskSummaryData(projectDb, args, options);
        return toolResult(formatReviewRiskSummaryText(data), data);
      })
  );

  server.registerTool(
    "get_baseline_diff_summary",
    {
      title: "Get baseline diff summary",
      description:
        "Return added, deleted, changed, unchanged, and concern counts between two baselines, or the latest available baseline comparison.",
      inputSchema: {
        baselineAId: z.string().optional(),
        baselineBId: z.string().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool("get_baseline_diff_summary", auditProject(), options, args, () => {
        const data = getBaselineDiffSummaryData(projectDb, args, options);
        return toolResult(formatBaselineDiffSummaryText(data), data);
      })
  );

  server.registerTool(
    "list_changed_requirements",
    {
      title: "List changed requirements",
      description:
        "List requirements added, deleted, or changed between baselines with optional concern filtering.",
      inputSchema: {
        baselineAId: z.string().optional(),
        baselineBId: z.string().optional(),
        changeType: changeTypeSchema.optional(),
        concernLevel: concernLevelSchema.optional(),
        limit: z.number().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool("list_changed_requirements", auditProject(), options, args, () => {
        const data = listChangedRequirementsData(projectDb, args, options);
        return toolResult(formatChangedRequirementsText(data), data);
      })
  );

  server.registerTool(
    "get_requirement_change_detail",
    {
      title: "Get requirement change detail",
      description:
        "Return detailed baseline change information for one requirement, including changed fields, affected trace context, findings, and stale trace indicators.",
      inputSchema: {
        requirementId: z.string(),
        baselineAId: z.string().optional(),
        baselineBId: z.string().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool("get_requirement_change_detail", auditProject(), options, args, () => {
        const data = getRequirementChangeDetailData(projectDb, args, options);
        return toolResult(formatRequirementChangeDetailText(data), data);
      })
  );

  server.registerTool(
    "get_stale_trace_candidates",
    {
      title: "Get stale trace candidates",
      description:
        "Find requirement trace links that may be stale after baseline changes, including numeric threshold and verification-method changes.",
      inputSchema: {
        baselineAId: z.string().optional(),
        baselineBId: z.string().optional(),
        concernLevel: concernLevelSchema.optional(),
        limit: z.number().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool("get_stale_trace_candidates", auditProject(), options, args, () => {
        const data = getStaleTraceCandidatesData(projectDb, args, options);
        return toolResult(formatStaleTraceCandidatesText(data), data);
      })
  );

  server.registerTool(
    "get_impacted_items_for_changed_requirement",
    {
      title: "Get impacted items for changed requirement",
      description:
        "Return affected work items, tests, findings, trace links, failed or skipped tests, and suggested checks for one changed requirement.",
      inputSchema: {
        requirementId: z.string(),
        baselineAId: z.string().optional(),
        baselineBId: z.string().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool("get_impacted_items_for_changed_requirement", auditProject(), options, args, () => {
        const data = getImpactedItemsForChangedRequirementData(projectDb, args, options);
        return toolResult(formatImpactedItemsText(data), data);
      })
  );

  server.registerTool(
    "get_review_brief",
    {
      title: "Get review brief facts",
      description:
        "Return structured Doorframe facts for a review brief. This is not an AI-generated final answer or compliance determination.",
      inputSchema: {
        reviewType: reviewTypeSchema.optional(),
        baselineAId: z.string().optional(),
        baselineBId: z.string().optional(),
        limit: z.number().optional()
      },
      annotations: readOnlyAnnotations
    },
    (args) =>
      safeTool("get_review_brief", auditProject(), options, args, () => {
        const data = getReviewBriefData(projectDb, args, options);
        return toolResult(formatReviewBriefText(data), data);
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
      safeTool("get_trace_links_for_requirement", auditProject(), options, args, () => {
        const data = getTraceLinksForRequirementData(projectDb, args.requirementId, options);
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
      safeTool("find_orphan_items", auditProject(), options, args, () => {
        const data = findOrphanItemsData(projectDb, args);
        return toolResult(formatOrphanItemsText(data), data);
      })
  );
}
