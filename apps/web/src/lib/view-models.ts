import type { Finding, ProjectData, Requirement, TestCase, TraceLink, WorkItem } from "@doorframe/core";

export interface RequirementTableRow extends Requirement {
  linkedWorkCount: number;
  linkedTestCount: number;
  findingCount: number;
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
  return data.requirements.map((requirement) => ({
    ...requirement,
    linkedWorkCount: linkedIds(requirement, data.traceLinks, "workItem").length,
    linkedTestCount: linkedIds(requirement, data.traceLinks, "testCase").length,
    findingCount: data.findings.filter(
      (finding) => finding.entityType === "requirement" && finding.entityId === requirement.id
    ).length
  }));
}

export function linkedWorkItems(requirement: Requirement, data: ProjectData): WorkItem[] {
  const ids = linkedIds(requirement, data.traceLinks, "workItem");
  return data.workItems.filter((workItem) => ids.includes(workItem.id));
}

export function linkedTestCases(requirement: Requirement, data: ProjectData): TestCase[] {
  const ids = linkedIds(requirement, data.traceLinks, "testCase");
  return data.testCases.filter((testCase) => ids.includes(testCase.id));
}

export function requirementFindings(requirement: Requirement, findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.entityType === "requirement" && finding.entityId === requirement.id);
}
