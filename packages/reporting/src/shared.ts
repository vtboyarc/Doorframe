import {
  type Finding,
  type ProjectData,
  type Requirement,
  type TestCase,
  type WorkItem
} from "@doorframe/core";

export interface MatrixRow {
  requirement: Requirement;
  workItems: WorkItem[];
  testCases: TestCase[];
  findings: Finding[];
}

export interface ReportSummary {
  requirementsWithoutWork: number;
  requirementsWithoutTests: number;
  requirementsWithoutPassingTests: number;
  failingTests: number;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function linkedIds(
  data: ProjectData,
  requirementId: string,
  targetType: "workItem" | "testCase"
): string[] {
  return data.traceLinks
    .filter((link) => {
      const requirementIsSource =
        link.sourceType === "requirement" && link.sourceId === requirementId && link.targetType === targetType;
      const requirementIsTarget =
        link.targetType === "requirement" && link.targetId === requirementId && link.sourceType === targetType;
      return requirementIsSource || requirementIsTarget;
    })
    .map((link) => (link.sourceId === requirementId ? link.targetId : link.sourceId));
}

interface RequirementLinks {
  workItem: string[];
  testCase: string[];
}

/** Work item and test ids linked to each requirement, in trace-link order, from one pass over the links. */
function linksByRequirement(data: ProjectData): Map<string, RequirementLinks> {
  const index = new Map<string, RequirementLinks>();
  const add = (requirementId: string, otherType: "workItem" | "testCase", otherId: string) => {
    let links = index.get(requirementId);
    if (!links) {
      links = { workItem: [], testCase: [] };
      index.set(requirementId, links);
    }
    links[otherType].push(otherId);
  };

  data.traceLinks.forEach((link) => {
    if (link.sourceType === "requirement" && (link.targetType === "workItem" || link.targetType === "testCase")) {
      add(link.sourceId, link.targetType, link.targetId);
    } else if (link.targetType === "requirement" && (link.sourceType === "workItem" || link.sourceType === "testCase")) {
      add(link.targetId, link.sourceType, link.sourceId);
    }
  });
  return index;
}

/** Positions in `data.findings` for each entity id, so a row can collect its findings in report order. */
function findingIndexesByEntity(findings: Finding[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  findings.forEach((finding, position) => {
    const positions = index.get(finding.entityId);
    if (positions) {
      positions.push(position);
    } else {
      index.set(finding.entityId, [position]);
    }
  });
  return index;
}

function findingsForEntities(entityIds: Set<string>, findings: Finding[], byEntity: Map<string, number[]>): Finding[] {
  const positions: number[] = [];
  entityIds.forEach((entityId) => {
    byEntity.get(entityId)?.forEach((position) => positions.push(position));
  });
  return positions.sort((left, right) => left - right).map((position) => findings[position]);
}

function recordsForIds<T>(ids: string[], byId: Map<string, T>): T[] {
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

/**
 * One row per requirement with its linked work items, tests, and related findings. Builds the link
 * and finding lookups once, so the cost grows with the number of records rather than their product.
 */
export function matrixRows(data: ProjectData): MatrixRow[] {
  const workById = new Map(data.workItems.map((item) => [item.id, item]));
  const testById = new Map(data.testCases.map((item) => [item.id, item]));
  const links = linksByRequirement(data);
  const findingsByEntity = findingIndexesByEntity(data.findings);

  return data.requirements.map((requirement) => {
    const workIds = links.get(requirement.id)?.workItem ?? [];
    const testIds = links.get(requirement.id)?.testCase ?? [];
    const relatedEntityIds = new Set([requirement.id, ...workIds, ...testIds]);

    return {
      requirement,
      workItems: recordsForIds(workIds, workById),
      testCases: recordsForIds(testIds, testById),
      findings: findingsForEntities(relatedEntityIds, data.findings, findingsByEntity)
    };
  });
}

/** Summary counts from matrix rows that were already built, so callers do not rebuild them. */
export function summarizeReportFromRows(data: ProjectData, matrix: MatrixRow[]): ReportSummary {
  return {
    requirementsWithoutWork: matrix.filter((row) => row.workItems.length === 0).length,
    requirementsWithoutTests: matrix.filter((row) => row.testCases.length === 0).length,
    requirementsWithoutPassingTests: matrix.filter(
      (row) => row.testCases.length === 0 || !row.testCases.some((test) => test.status === "passed")
    ).length,
    failingTests: data.testCases.filter((test) => test.status === "failed" || test.status === "errored").length
  };
}

export function summarizeReport(data: ProjectData): ReportSummary {
  return summarizeReportFromRows(data, matrixRows(data));
}
