import {
  compareRequirementBaselines,
  type BaselineChangedRequirement,
  type BaselineDiffTestContext,
  type BaselineDiffWorkItemContext
} from "@doorframe/analyzers";
import type { Finding, FindingCategory, FindingSeverity, ProjectSnapshot, TraceLink } from "@doorframe/core";
import { compareFindings } from "./findings";
import { compareExternalIds } from "./sort";

export interface RequirementRef {
  externalId: string;
  title: string;
}

export interface FindingRef {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
}

/** Record-level detail for a baseline comparison, shown alongside the counts from diffBaselines. */
export interface BaselineDiffDetails {
  addedRequirements: RequirementRef[];
  removedRequirements: RequirementRef[];
  /** Word-level changes, concern level, and the work and tests to re-check. */
  changedRequirements: BaselineChangedRequirement[];
  newFindings: FindingRef[];
  resolvedFindings: FindingRef[];
  /** Readable link descriptions such as "REQ-003 → FG-24 (implements)". */
  addedLinks: string[];
  removedLinks: string[];
}

function externalIds(snapshot: ProjectSnapshot): Map<string, string> {
  return new Map<string, string>([
    ...snapshot.requirements.map((item): [string, string] => [item.id, item.externalId]),
    ...snapshot.workItems.map((item): [string, string] => [item.id, item.externalId]),
    ...snapshot.testCases.map((item): [string, string] => [item.id, item.externalId])
  ]);
}

/** Links keyed by the external IDs they connect, so snapshots with different internal ids compare cleanly. */
function linkLabels(snapshot: ProjectSnapshot): Set<string> {
  const ids = externalIds(snapshot);
  const label = (link: TraceLink) =>
    `${ids.get(link.sourceId) ?? link.sourceId} → ${ids.get(link.targetId) ?? link.targetId} (${link.linkType})`;
  return new Set(snapshot.traceLinks.map(label));
}

/** Requirement external IDs each work item and test links to, for change-impact context. */
function traceContext(snapshot: ProjectSnapshot): {
  workItems: BaselineDiffWorkItemContext[];
  testCases: BaselineDiffTestContext[];
} {
  const requirementIds = new Map(snapshot.requirements.map((item) => [item.id, item.externalId]));
  const linkedRequirements = new Map<string, string[]>();
  snapshot.traceLinks.forEach((link) => {
    const pairs: Array<[string, string]> = [
      [link.sourceId, link.targetId],
      [link.targetId, link.sourceId]
    ];
    pairs.forEach(([requirementId, otherId]) => {
      const externalId = requirementIds.get(requirementId);
      if (externalId && !requirementIds.has(otherId)) {
        linkedRequirements.set(otherId, [...(linkedRequirements.get(otherId) ?? []), externalId]);
      }
    });
  });

  return {
    workItems: snapshot.workItems.map((item) => ({
      externalId: item.externalId,
      title: item.title,
      status: item.status,
      requirementIds: linkedRequirements.get(item.id) ?? []
    })),
    testCases: snapshot.testCases.map((item) => ({
      externalId: item.externalId,
      name: item.name,
      status: item.status,
      requirementIds: linkedRequirements.get(item.id) ?? []
    }))
  };
}

function findingKey(finding: Finding): string {
  return `${finding.category}::${finding.title}`;
}

function toFindingRefs(findings: Finding[]): FindingRef[] {
  return [...findings]
    .sort(compareFindings)
    .map((finding) => ({ category: finding.category, severity: finding.severity, title: finding.title }));
}

function toRequirementRefs(requirements: ProjectSnapshot["requirements"]): RequirementRef[] {
  return requirements
    .map((item) => ({ externalId: item.externalId, title: item.title }))
    .sort((left, right) => compareExternalIds(left.externalId, right.externalId));
}

export function baselineDiffDetails(from: ProjectSnapshot, to: ProjectSnapshot): BaselineDiffDetails {
  const context = traceContext(to);
  const report = compareRequirementBaselines({
    baselineAName: "from",
    baselineBName: "to",
    requirementsA: from.requirements,
    requirementsB: to.requirements,
    workItems: context.workItems,
    testCases: context.testCases
  });

  const fromFindings = new Set(from.findings.map(findingKey));
  const toFindings = new Set(to.findings.map(findingKey));
  const fromLinks = linkLabels(from);
  const toLinks = linkLabels(to);
  const toRequirementIds = new Set(to.requirements.map((item) => item.externalId));
  const fromRequirementIds = new Set(from.requirements.map((item) => item.externalId));

  return {
    addedRequirements: toRequirementRefs(to.requirements.filter((item) => !fromRequirementIds.has(item.externalId))),
    removedRequirements: toRequirementRefs(from.requirements.filter((item) => !toRequirementIds.has(item.externalId))),
    changedRequirements: [...report.changed].sort((left, right) => compareExternalIds(left.externalId, right.externalId)),
    newFindings: toFindingRefs(to.findings.filter((finding) => !fromFindings.has(findingKey(finding)))),
    resolvedFindings: toFindingRefs(from.findings.filter((finding) => !toFindings.has(findingKey(finding)))),
    addedLinks: [...toLinks].filter((label) => !fromLinks.has(label)).sort(compareExternalIds),
    removedLinks: [...fromLinks].filter((label) => !toLinks.has(label)).sort(compareExternalIds)
  };
}
