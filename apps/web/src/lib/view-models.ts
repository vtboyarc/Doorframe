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

export interface RequirementTableRow extends Requirement {
  linkedWorkCount: number;
  linkedTestCount: number;
  failingTestCount: number;
  findingCount: number;
}

export type RequirementView = "without-work" | "without-tests" | "failed-tests";

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

const severityRank: Record<Finding["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2
};

export function findingsByPriority(findings: Finding[]): Finding[] {
  return [...findings].sort((left, right) => {
    const severityDifference = severityRank[left.severity] - severityRank[right.severity];

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return left.title.localeCompare(right.title);
  });
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

export function requirementRows(data: ProjectData): RequirementTableRow[] {
  return data.requirements.map((requirement) => {
    const testIds = linkedIds(requirement, data.traceLinks, "testCase");

    return {
      ...requirement,
      linkedWorkCount: linkedIds(requirement, data.traceLinks, "workItem").length,
      linkedTestCount: testIds.length,
      failingTestCount: data.testCases.filter(
        (testCase) => testIds.includes(testCase.id) && (testCase.status === "failed" || testCase.status === "errored")
      ).length,
      findingCount: requirementFindings(requirement, data).length
    };
  });
}

export function projectSummary(data: ProjectData): ProjectSummary {
  const rows = requirementRows(data);

  return {
    totalRequirements: data.requirements.length,
    totalWorkItems: data.workItems.length,
    totalTests: data.testCases.length,
    totalTraceLinks: data.traceLinks.length,
    totalFindings: data.findings.length,
    requirementsWithoutWork: rows.filter((row) => row.linkedWorkCount === 0).length,
    requirementsWithoutTests: rows.filter((row) => row.linkedTestCount === 0).length,
    weakRequirements: data.findings.filter((finding) => finding.category === "weak_wording").length,
    failedTestsLinkedToRequirements: rows.filter((row) => row.failingTestCount > 0).length
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

export function auditEventTarget(
  projectId: string,
  action: AuditAction
): AuditEventTarget {
  const base = `/projects/${projectId}`;

  switch (action) {
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
  }
}
