import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { ReadOnlyProjectDatabase } from "@doorframe/storage";
import { jsonResource } from "./formatters";
import type { DoorframeMcpOptions } from "./options";
import {
  formatBaselineDiffSummaryText,
  formatFindingsText,
  formatProjectSummaryText,
  formatReviewBriefText,
  formatReviewRiskSummaryText,
  formatStaleTraceCandidatesText,
  getBaselineDiffSummaryData,
  getProjectSummaryData,
  getReviewBriefData,
  getReviewRiskSummaryData,
  getStaleTraceCandidatesData,
  getTraceabilityGapsData,
  getTraceabilityMatrixData,
  listFindingsData
} from "./tools";

type ProjectDb = Pick<ReadOnlyProjectDatabase, "loadProjectData"> &
  Partial<Pick<ReadOnlyProjectDatabase, "listBaselines">>;

export const projectSummaryUri = "doorframe://project/summary";
export const projectFindingsUri = "doorframe://project/findings";
export const traceabilityMatrixUri = "doorframe://project/traceability-matrix";
export const reviewPrepUri = "doorframe://project/review-prep";
export const baselineDiffUri = "doorframe://project/baseline-diff";
export const staleTracesUri = "doorframe://project/stale-traces";
export const testReadinessReviewBriefUri = "doorframe://project/review-brief/test-readiness";
export const requirementsReviewBriefUri = "doorframe://project/review-brief/requirements-review";

export function readProjectSummaryResource(projectDb: ProjectDb): ReadResourceResult {
  const summary = getProjectSummaryData(projectDb);
  return jsonResource(projectSummaryUri, {
    ...summary,
    readableText: formatProjectSummaryText(summary)
  });
}

export function readProjectFindingsResource(projectDb: ProjectDb): ReadResourceResult {
  const findings = listFindingsData(projectDb, { limit: 50 });
  return jsonResource(projectFindingsUri, {
    ...findings,
    readableText: formatFindingsText(findings)
  });
}

export function readTraceabilityMatrixResource(projectDb: ProjectDb): ReadResourceResult {
  const matrix = getTraceabilityMatrixData(projectDb, { limit: 100 });
  return jsonResource(traceabilityMatrixUri, matrix);
}

export function readReviewPrepResource(projectDb: ProjectDb): ReadResourceResult {
  const reviewRisk = getReviewRiskSummaryData(projectDb, { reviewType: "general", limit: 10 });
  const missingVerification = getTraceabilityGapsData(projectDb, { gapType: "missing_tests", limit: 20 });
  const missingWork = getTraceabilityGapsData(projectDb, { gapType: "missing_work", limit: 20 });
  const failedTests = getTraceabilityGapsData(projectDb, { gapType: "failed_tests", limit: 20 });
  const weakLanguage = getTraceabilityGapsData(projectDb, { gapType: "weak_requirement_language", limit: 20 });

  return jsonResource(reviewPrepUri, {
    reviewRisk,
    mostImportantGaps: reviewRisk.topRisks,
    requirementsMissingVerification: missingVerification.gaps,
    requirementsMissingWork: missingWork.gaps,
    failedTestsLinkedToRequirements: failedTests.gaps,
    weakWordingCount: weakLanguage.limit.total,
    suggestedMeetingDiscussionTopics: reviewRisk.suggestedDiscussionPoints,
    readableText: formatReviewRiskSummaryText(reviewRisk)
  });
}

export function readBaselineDiffResource(
  projectDb: ProjectDb,
  options: Partial<DoorframeMcpOptions> = {}
): ReadResourceResult {
  const baselineDiff = getBaselineDiffSummaryData(projectDb, {}, options);
  return jsonResource(baselineDiffUri, {
    ...baselineDiff,
    readableText: formatBaselineDiffSummaryText(baselineDiff)
  });
}

export function readStaleTracesResource(
  projectDb: ProjectDb,
  options: Partial<DoorframeMcpOptions> = {}
): ReadResourceResult {
  const staleTraces = getStaleTraceCandidatesData(projectDb, { limit: 25 }, options);
  return jsonResource(staleTracesUri, {
    ...staleTraces,
    readableText: formatStaleTraceCandidatesText(staleTraces)
  });
}

export function readTestReadinessReviewBriefResource(
  projectDb: ProjectDb,
  options: Partial<DoorframeMcpOptions> = {}
): ReadResourceResult {
  const brief = getReviewBriefData(projectDb, { reviewType: "test_readiness_review", limit: 10 }, options);
  return jsonResource(testReadinessReviewBriefUri, {
    ...brief,
    readableText: formatReviewBriefText(brief)
  });
}

export function readRequirementsReviewBriefResource(
  projectDb: ProjectDb,
  options: Partial<DoorframeMcpOptions> = {}
): ReadResourceResult {
  const brief = getReviewBriefData(projectDb, { reviewType: "requirements_review", limit: 10 }, options);
  return jsonResource(requirementsReviewBriefUri, {
    ...brief,
    readableText: formatReviewBriefText(brief)
  });
}

export function registerDoorframeResources(
  server: McpServer,
  projectDb: ProjectDb,
  options: Partial<DoorframeMcpOptions> = {}
): void {
  server.registerResource(
    "doorframe_project_summary",
    projectSummaryUri,
    {
      title: "Doorframe project summary",
      description: "Compact project summary with entity counts and finding counts.",
      mimeType: "application/json"
    },
    () => readProjectSummaryResource(projectDb)
  );

  server.registerResource(
    "doorframe_project_findings",
    projectFindingsUri,
    {
      title: "Doorframe findings summary",
      description: "Concise findings summary grouped by severity and category, capped at 50 findings.",
      mimeType: "application/json"
    },
    () => readProjectFindingsResource(projectDb)
  );

  server.registerResource(
    "doorframe_traceability_matrix",
    traceabilityMatrixUri,
    {
      title: "Doorframe traceability matrix",
      description: "Compact requirement matrix with linked work counts, linked test counts, test status, and findings.",
      mimeType: "application/json"
    },
    () => readTraceabilityMatrixResource(projectDb)
  );

  server.registerResource(
    "doorframe_review_prep",
    reviewPrepUri,
    {
      title: "Doorframe review prep",
      description: "Review-prep summary with the most important gaps and suggested discussion topics.",
      mimeType: "application/json"
    },
    () => readReviewPrepResource(projectDb)
  );

  server.registerResource(
    "doorframe_baseline_diff",
    baselineDiffUri,
    {
      title: "Doorframe baseline diff",
      description: "Baseline diff summary with added, deleted, changed, unchanged, and concern counts.",
      mimeType: "application/json"
    },
    () => readBaselineDiffResource(projectDb, options)
  );

  server.registerResource(
    "doorframe_stale_traces",
    staleTracesUri,
    {
      title: "Doorframe stale trace candidates",
      description: "Requirements whose trace links may be stale after baseline changes.",
      mimeType: "application/json"
    },
    () => readStaleTracesResource(projectDb, options)
  );

  server.registerResource(
    "doorframe_test_readiness_review_brief",
    testReadinessReviewBriefUri,
    {
      title: "Doorframe test readiness review brief",
      description: "Structured Doorframe facts for test readiness review preparation.",
      mimeType: "application/json"
    },
    () => readTestReadinessReviewBriefResource(projectDb, options)
  );

  server.registerResource(
    "doorframe_requirements_review_brief",
    requirementsReviewBriefUri,
    {
      title: "Doorframe requirements review brief",
      description: "Structured Doorframe facts for requirements review preparation.",
      mimeType: "application/json"
    },
    () => readRequirementsReviewBriefResource(projectDb, options)
  );
}
