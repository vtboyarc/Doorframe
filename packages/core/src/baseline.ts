import type {
  Finding,
  ProjectData,
  Requirement,
  TestCase,
  TraceLink,
  WorkItem
} from "./types";

/**
 * A point-in-time, persistence-independent copy of a project's analyzed data.
 * Stored inside a {@link Baseline} so two snapshots can be diffed later.
 */
export interface ProjectSnapshot {
  requirements: Requirement[];
  workItems: WorkItem[];
  testCases: TestCase[];
  traceLinks: TraceLink[];
  findings: Finding[];
}

export interface Baseline {
  id: string;
  projectId: string;
  label: string;
  createdAt: string;
  snapshot: ProjectSnapshot;
}

export interface RequirementFieldChange {
  field: "title" | "text" | "status" | "type" | "priority" | "verificationMethod" | "parentExternalId";
  before?: string;
  after?: string;
}

export interface ModifiedRequirement {
  externalId: string;
  changes: RequirementFieldChange[];
}

export interface CountChange {
  added: number;
  removed: number;
}

/** Structured difference between two {@link ProjectSnapshot}s. */
export interface BaselineDiff {
  requirements: {
    added: string[];
    removed: string[];
    modified: ModifiedRequirement[];
  };
  workItems: {
    added: string[];
    removed: string[];
  };
  testCases: {
    added: string[];
    removed: string[];
    statusChanged: { externalId: string; before: string; after: string }[];
  };
  traceLinks: CountChange;
  findings: {
    added: number;
    resolved: number;
    byCategory: Record<string, CountChange>;
  };
}

export function snapshotFromProjectData(data: ProjectData): ProjectSnapshot {
  return {
    requirements: data.requirements,
    workItems: data.workItems,
    testCases: data.testCases,
    traceLinks: data.traceLinks,
    findings: data.findings
  };
}

function byExternalId<T extends { externalId: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.externalId, item]));
}

const REQUIREMENT_DIFF_FIELDS: RequirementFieldChange["field"][] = [
  "title",
  "text",
  "status",
  "type",
  "priority",
  "verificationMethod",
  "parentExternalId"
];

/**
 * Compute a {@link BaselineDiff} between an older snapshot (`base`) and a newer
 * one (`against`). Entities are matched by `externalId`.
 */
export function diffBaselines(base: ProjectSnapshot, against: ProjectSnapshot): BaselineDiff {
  const baseReqs = byExternalId(base.requirements);
  const againstReqs = byExternalId(against.requirements);

  const reqAdded = against.requirements.filter((r) => !baseReqs.has(r.externalId)).map((r) => r.externalId);
  const reqRemoved = base.requirements.filter((r) => !againstReqs.has(r.externalId)).map((r) => r.externalId);
  const reqModified: ModifiedRequirement[] = [];

  against.requirements.forEach((after) => {
    const before = baseReqs.get(after.externalId);
    if (!before) {
      return;
    }

    const changes: RequirementFieldChange[] = [];
    REQUIREMENT_DIFF_FIELDS.forEach((field) => {
      const beforeValue = before[field] ?? "";
      const afterValue = after[field] ?? "";
      if (beforeValue !== afterValue) {
        changes.push({ field, before: before[field], after: after[field] });
      }
    });

    if (changes.length > 0) {
      reqModified.push({ externalId: after.externalId, changes });
    }
  });

  const baseWork = byExternalId(base.workItems);
  const againstWork = byExternalId(against.workItems);
  const workAdded = against.workItems.filter((w) => !baseWork.has(w.externalId)).map((w) => w.externalId);
  const workRemoved = base.workItems.filter((w) => !againstWork.has(w.externalId)).map((w) => w.externalId);

  const baseTests = byExternalId(base.testCases);
  const againstTests = byExternalId(against.testCases);
  const testAdded = against.testCases.filter((t) => !baseTests.has(t.externalId)).map((t) => t.externalId);
  const testRemoved = base.testCases.filter((t) => !againstTests.has(t.externalId)).map((t) => t.externalId);
  const statusChanged: { externalId: string; before: string; after: string }[] = [];
  against.testCases.forEach((after) => {
    const before = baseTests.get(after.externalId);
    if (before && before.status !== after.status) {
      statusChanged.push({ externalId: after.externalId, before: before.status, after: after.status });
    }
  });

  const findingKey = (f: Finding): string => `${f.category}::${f.title}`;
  const baseFindingKeys = new Set(base.findings.map(findingKey));
  const againstFindingKeys = new Set(against.findings.map(findingKey));
  const addedFindings = against.findings.filter((f) => !baseFindingKeys.has(findingKey(f)));
  const resolvedFindings = base.findings.filter((f) => !againstFindingKeys.has(findingKey(f)));

  const byCategory: Record<string, CountChange> = {};
  addedFindings.forEach((f) => {
    byCategory[f.category] = byCategory[f.category] ?? { added: 0, removed: 0 };
    byCategory[f.category].added += 1;
  });
  resolvedFindings.forEach((f) => {
    byCategory[f.category] = byCategory[f.category] ?? { added: 0, removed: 0 };
    byCategory[f.category].removed += 1;
  });

  // Compare trace links by stable identity so a removed-and-added pair (net zero
  // length change) is still reported as one removed and one added.
  const linkKey = (link: TraceLink): string =>
    `${link.sourceType}:${link.sourceId}->${link.targetType}:${link.targetId}#${link.linkType}`;
  const baseLinkKeys = new Set(base.traceLinks.map(linkKey));
  const againstLinkKeys = new Set(against.traceLinks.map(linkKey));
  const linksAdded = against.traceLinks.filter((link) => !baseLinkKeys.has(linkKey(link))).length;
  const linksRemoved = base.traceLinks.filter((link) => !againstLinkKeys.has(linkKey(link))).length;

  return {
    requirements: { added: reqAdded, removed: reqRemoved, modified: reqModified },
    workItems: { added: workAdded, removed: workRemoved },
    testCases: { added: testAdded, removed: testRemoved, statusChanged },
    traceLinks: {
      added: linksAdded,
      removed: linksRemoved
    },
    findings: {
      added: addedFindings.length,
      resolved: resolvedFindings.length,
      byCategory
    }
  };
}
