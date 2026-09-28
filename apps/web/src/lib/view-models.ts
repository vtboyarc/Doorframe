import type {
  AuditAction,
  EntityType,
  Finding,
  ProjectData,
  ProjectSummary,
  Requirement,
  TestCase,
  TraceLink,
  WorkItem
} from "@doorframe/core";
import { compareFindings } from "./findings";

export interface RequirementTableRow extends Requirement {
  linkedWorkCount: number;
  linkedTestCount: number;
  passingTestCount: number;
  failingTestCount: number;
  skippedTestCount: number;
  findingCount: number;
  /** Lowercase text the requirements filter searches: IDs, title, text, attributes, linked work and tests. */
  searchText: string;
}

/** The subset of a {@link RequirementTableRow} the requirements table needs on the client. */
export type RequirementListRow = Pick<
  RequirementTableRow,
  | "id"
  | "externalId"
  | "title"
  | "status"
  | "verificationMethod"
  | "linkedWorkCount"
  | "linkedTestCount"
  | "passingTestCount"
  | "failingTestCount"
  | "skippedTestCount"
  | "findingCount"
  | "searchText"
>;

export function toListRow(row: RequirementTableRow): RequirementListRow {
  return {
    id: row.id,
    externalId: row.externalId,
    title: row.title,
    status: row.status,
    verificationMethod: row.verificationMethod,
    linkedWorkCount: row.linkedWorkCount,
    linkedTestCount: row.linkedTestCount,
    passingTestCount: row.passingTestCount,
    failingTestCount: row.failingTestCount,
    skippedTestCount: row.skippedTestCount,
    findingCount: row.findingCount,
    searchText: row.searchText
  };
}

export type RequirementView = "without-work" | "without-tests" | "without-passing-tests" | "failed-tests";

/** Headings for the filtered requirement views linked from the dashboard. */
export const requirementViewLabels: Record<RequirementView, string> = {
  "without-work": "Requirements without linked work",
  "without-tests": "Requirements without linked tests",
  "without-passing-tests": "Requirements without a passing linked test",
  "failed-tests": "Requirements with failed or errored tests"
};

export function isRequirementView(value: string | undefined): value is RequirementView {
  return value !== undefined && value in requirementViewLabels;
}

export type FindingContext =
  | {
      entityType: "requirement";
      entity: Requirement;
      relatedRequirements: Requirement[];
    }
  | {
      entityType: "workItem";
      entity: WorkItem;
      relatedRequirements: Requirement[];
    }
  | {
      entityType: "testCase";
      entity: TestCase;
      relatedRequirements: Requirement[];
    }
  | {
      entityType: EntityType;
      entity: null;
      relatedRequirements: Requirement[];
    };

export interface AuditEventTarget {
  href: string;
  label: string;
}

/** Errors first, then by category and title. See {@link compareFindings}. */
export function findingsByPriority(findings: Finding[]): Finding[] {
  return [...findings].sort(compareFindings);
}

export function linkedIds(
  requirement: Requirement,
  traceLinks: TraceLink[],
  entityType: "workItem" | "testCase"
): string[] {
  return traceLinks
    .filter((link) => {
      const fromRequirement =
        link.sourceType === "requirement" &&
        link.sourceId === requirement.id &&
        link.targetType === entityType;
      const toRequirement =
        link.targetType === "requirement" &&
        link.targetId === requirement.id &&
        link.sourceType === entityType;

      return fromRequirement || toRequirement;
    })
    .map((link) => (link.sourceId === requirement.id ? link.targetId : link.sourceId));
}

/** Requirement -> linked work item / test case ids, built once from the trace links. */
function requirementLinkIndex(data: ProjectData): {
  work: Map<string, string[]>;
  tests: Map<string, string[]>;
} {
  const requirementIds = new Set(data.requirements.map((requirement) => requirement.id));
  const work = new Map<string, string[]>();
  const tests = new Map<string, string[]>();
  const add = (index: Map<string, string[]>, requirementId: string, entityId: string) => {
    index.set(requirementId, [...(index.get(requirementId) ?? []), entityId]);
  };

  data.traceLinks.forEach((link) => {
    const ends: Array<[EntityType, string, EntityType, string]> = [
      [link.sourceType, link.sourceId, link.targetType, link.targetId],
      [link.targetType, link.targetId, link.sourceType, link.sourceId]
    ];
    ends.forEach(([type, id, otherType, otherId]) => {
      if (type !== "requirement" || !requirementIds.has(id)) {
        return;
      }
      if (otherType === "workItem") {
        add(work, id, otherId);
      } else if (otherType === "testCase") {
        add(tests, id, otherId);
      }
    });
  });

  return { work, tests };
}

export function requirementRows(data: ProjectData): RequirementTableRow[] {
  const index = requirementLinkIndex(data);
  const workById = new Map(data.workItems.map((workItem) => [workItem.id, workItem]));
  const testById = new Map(data.testCases.map((testCase) => [testCase.id, testCase]));
  const findingsByEntity = new Map<string, number>();
  data.findings.forEach((finding) => {
    findingsByEntity.set(finding.entityId, (findingsByEntity.get(finding.entityId) ?? 0) + 1);
  });

  return data.requirements.map((requirement) => {
    const workIds = index.work.get(requirement.id) ?? [];
    const testIds = index.tests.get(requirement.id) ?? [];
    const linkedWork = workIds.flatMap((id) => workById.get(id) ?? []);
    const linkedTests = testIds.flatMap((id) => testById.get(id) ?? []);
    const relatedEntityIds = new Set([requirement.id, ...workIds, ...testIds]);
    const findingCount = [...relatedEntityIds].reduce((total, id) => total + (findingsByEntity.get(id) ?? 0), 0);

    return {
      ...requirement,
      linkedWorkCount: workIds.length,
      linkedTestCount: testIds.length,
      passingTestCount: linkedTests.filter((testCase) => testCase.status === "passed").length,
      failingTestCount: linkedTests.filter((testCase) => testCase.status === "failed" || testCase.status === "errored")
        .length,
      skippedTestCount: linkedTests.filter((testCase) => testCase.status === "skipped").length,
      findingCount,
      searchText: [
        requirement.externalId,
        requirement.title,
        requirement.text,
        requirement.status,
        requirement.verificationMethod,
        requirement.type,
        requirement.priority,
        ...linkedWork.map((workItem) => workItem.externalId),
        ...linkedTests.map((testCase) => testCase.name)
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase()
    };
  });
}

/** Requirements that name this requirement as their parent. */
export function childRequirements(requirement: Requirement, data: ProjectData): Requirement[] {
  return data.requirements.filter((candidate) => candidate.parentExternalId === requirement.externalId);
}

/** The requirement this one names as its parent, when it is in the project. */
export function parentRequirement(requirement: Requirement, data: ProjectData): Requirement | null {
  if (!requirement.parentExternalId) {
    return null;
  }

  return data.requirements.find((candidate) => candidate.externalId === requirement.parentExternalId) ?? null;
}

export function projectSummary(data: ProjectData): ProjectSummary {
  const requirementIds = new Set(data.requirements.map((requirement) => requirement.id));
  const failingTestIds = new Set(
    data.testCases
      .filter((testCase) => testCase.status === "failed" || testCase.status === "errored")
      .map((testCase) => testCase.id)
  );
  const requirementsWithWork = new Set<string>();
  const requirementsWithTests = new Set<string>();
  const requirementsWithFailingTests = new Set<string>();

  data.traceLinks.forEach((link) => {
    const requirementId =
      link.sourceType === "requirement" && requirementIds.has(link.sourceId)
        ? link.sourceId
        : link.targetType === "requirement" && requirementIds.has(link.targetId)
          ? link.targetId
          : null;

    if (!requirementId) {
      return;
    }

    if (link.sourceType === "workItem" || link.targetType === "workItem") {
      requirementsWithWork.add(requirementId);
    }

    if (link.sourceType === "testCase" || link.targetType === "testCase") {
      requirementsWithTests.add(requirementId);
      const testId = link.sourceType === "testCase" ? link.sourceId : link.targetId;

      if (failingTestIds.has(testId)) {
        requirementsWithFailingTests.add(requirementId);
      }
    }
  });

  return {
    totalRequirements: data.requirements.length,
    linkedRequirements: [...requirementsWithWork].filter((requirementId) =>
      requirementsWithTests.has(requirementId)
    ).length,
    totalWorkItems: data.workItems.length,
    totalTests: data.testCases.length,
    totalTraceLinks: data.traceLinks.length,
    totalFindings: data.findings.length,
    requirementsWithoutWork: data.requirements.length - requirementsWithWork.size,
    requirementsWithoutTests: data.requirements.length - requirementsWithTests.size,
    weakRequirements: data.findings.filter((finding) => finding.category === "weak_wording").length,
    failedTestsLinkedToRequirements: requirementsWithFailingTests.size
  };
}

export interface DashboardStats {
  /** Share of requirements linked to both work and tests, 0-100. */
  fullyTracedPercent: number;
  requirementsWithoutPassingTests: number;
  findingsBySeverity: Record<Finding["severity"], number>;
}

/**
 * Whole-number percentage that only reads 0 or 100 when that is exactly true,
 * so "100%" never hides a remaining gap.
 */
export function coveragePercent(covered: number, total: number): number {
  if (total === 0 || covered === 0) {
    return 0;
  }
  if (covered >= total) {
    return 100;
  }
  return Math.min(99, Math.max(1, Math.round((covered / total) * 100)));
}

/** Figures shown on the dashboard in addition to the shared {@link ProjectSummary}. */
export function dashboardStats(data: ProjectData, summary: ProjectSummary): DashboardStats {
  const findingsBySeverity: Record<Finding["severity"], number> = { error: 0, warning: 0, info: 0 };
  data.findings.forEach((finding) => {
    findingsBySeverity[finding.severity] += 1;
  });

  return {
    fullyTracedPercent: coveragePercent(summary.linkedRequirements, summary.totalRequirements),
    requirementsWithoutPassingTests: filterRequirementRows(requirementRows(data), "without-passing-tests").length,
    findingsBySeverity
  };
}

export function filterRequirementRows(
  rows: RequirementTableRow[],
  view?: string
): RequirementTableRow[] {
  if (view === "without-work") {
    return rows.filter((row) => row.linkedWorkCount === 0);
  }

  if (view === "without-tests") {
    return rows.filter((row) => row.linkedTestCount === 0);
  }

  if (view === "without-passing-tests") {
    return rows.filter((row) => row.passingTestCount === 0);
  }

  if (view === "failed-tests") {
    return rows.filter((row) => row.failingTestCount > 0);
  }

  return rows;
}

export function linkedWorkItems(requirement: Requirement, data: ProjectData): WorkItem[] {
  const ids = linkedIds(requirement, data.traceLinks, "workItem");
  return data.workItems.filter((workItem) => ids.includes(workItem.id));
}

export function linkedTestCases(requirement: Requirement, data: ProjectData): TestCase[] {
  const ids = linkedIds(requirement, data.traceLinks, "testCase");
  return data.testCases.filter((testCase) => ids.includes(testCase.id));
}

export function requirementFindings(requirement: Requirement, data: ProjectData): Finding[] {
  const relatedEntityIds = new Set([
    requirement.id,
    ...linkedIds(requirement, data.traceLinks, "workItem"),
    ...linkedIds(requirement, data.traceLinks, "testCase")
  ]);

  return data.findings.filter((finding) => relatedEntityIds.has(finding.entityId));
}

function relatedRequirementIds(
  entityType: EntityType,
  entityId: string,
  traceLinks: TraceLink[]
): string[] {
  if (entityType === "requirement") {
    return [entityId];
  }

  return traceLinks.flatMap((link) => {
    if (
      link.sourceType === entityType &&
      link.sourceId === entityId &&
      link.targetType === "requirement"
    ) {
      return [link.targetId];
    }

    if (
      link.targetType === entityType &&
      link.targetId === entityId &&
      link.sourceType === "requirement"
    ) {
      return [link.sourceId];
    }

    return [];
  });
}

export function findingContext(finding: Finding, data: ProjectData): FindingContext {
  const requirementIds = relatedRequirementIds(finding.entityType, finding.entityId, data.traceLinks);
  const relatedRequirements = data.requirements.filter((requirement) => requirementIds.includes(requirement.id));

  if (finding.entityType === "requirement") {
    return {
      entityType: finding.entityType,
      entity: data.requirements.find((requirement) => requirement.id === finding.entityId) ?? null,
      relatedRequirements
    };
  }

  if (finding.entityType === "workItem") {
    return {
      entityType: finding.entityType,
      entity: data.workItems.find((workItem) => workItem.id === finding.entityId) ?? null,
      relatedRequirements
    };
  }

  return {
    entityType: finding.entityType,
    entity: data.testCases.find((testCase) => testCase.id === finding.entityId) ?? null,
    relatedRequirements
  };
}

export function auditEventTarget(projectId: string, action: string): AuditEventTarget {
  const base = `/projects/${projectId}`;
  const known = action as AuditAction;

  switch (known) {
    case "import.completed":
      return { href: `${base}/imports`, label: "Review imports" };
    case "analysis.rerun":
      return { href: `${base}/findings`, label: "Review findings" };
    case "baseline.created":
      return { href: `${base}/baselines`, label: "Review baselines" };
    case "ruleset.updated":
      return { href: `${base}/settings`, label: "Review ruleset" };
    case "report.generated":
      return { href: `${base}/reports`, label: "Review reports" };
    case "project.created":
      return { href: base, label: "Open dashboard" };
    case "project.renamed":
      return { href: `${base}/settings`, label: "Review settings" };
    case "records.removed":
      return { href: `${base}/imports`, label: "Review imports" };
    default: {
      // Compile-time check that every known action has a target. At runtime the
      // database may hold actions from a newer Doorframe version; send those to the dashboard.
      const unhandled: never = known;
      void unhandled;
      return { href: base, label: "Open dashboard" };
    }
  }
}
