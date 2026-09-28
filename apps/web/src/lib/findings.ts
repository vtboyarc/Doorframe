import type { Finding, FindingCategory, FindingSeverity, ProjectData, Requirement, WorkItem } from "@doorframe/core";
import { compareExternalIds } from "./sort";

/** Every finding category, in the order the UI lists them. */
export const FINDING_CATEGORIES: readonly FindingCategory[] = [
  "missing_verification",
  "missing_work_trace",
  "closed_work_without_verification",
  "stale_link",
  "weak_wording",
  "multi_requirement",
  "non_verifiable",
  "duplicate_candidate",
  "custom_rule"
];

export const FINDING_SEVERITIES: readonly FindingSeverity[] = ["error", "warning", "info"];

export const FINDINGS_PAGE_SIZE = 50;

export function isFindingCategory(value: unknown): value is FindingCategory {
  return typeof value === "string" && (FINDING_CATEGORIES as readonly string[]).includes(value);
}

export function isFindingSeverity(value: unknown): value is FindingSeverity {
  return typeof value === "string" && (FINDING_SEVERITIES as readonly string[]).includes(value);
}

const severityRank: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };

/** Errors first, then by category, then by title in natural ID order. */
export function compareFindings(left: Finding, right: Finding): number {
  return (
    severityRank[left.severity] - severityRank[right.severity] ||
    FINDING_CATEGORIES.indexOf(left.category) - FINDING_CATEGORIES.indexOf(right.category) ||
    compareExternalIds(left.title, right.title)
  );
}

export interface FindingsListView {
  items: Finding[];
  /** Findings matching the filters, before paging. */
  total: number;
  page: number;
  pageCount: number;
  /** Counts per category within the severity filter, so category chips stay meaningful. */
  categoryCounts: Record<FindingCategory, number>;
  /** Counts per severity within the category filter. */
  severityCounts: Record<FindingSeverity, number>;
}

export function findingsListView(
  findings: Finding[],
  filters: { category?: FindingCategory; severity?: FindingSeverity; page?: number },
  pageSize = FINDINGS_PAGE_SIZE
): FindingsListView {
  const categoryCounts = Object.fromEntries(FINDING_CATEGORIES.map((category) => [category, 0])) as Record<
    FindingCategory,
    number
  >;
  const severityCounts: Record<FindingSeverity, number> = { error: 0, warning: 0, info: 0 };

  findings.forEach((finding) => {
    if (!filters.severity || finding.severity === filters.severity) {
      categoryCounts[finding.category] += 1;
    }
    if (!filters.category || finding.category === filters.category) {
      severityCounts[finding.severity] += 1;
    }
  });

  const matching = findings
    .filter((finding) => !filters.category || finding.category === filters.category)
    .filter((finding) => !filters.severity || finding.severity === filters.severity)
    .sort(compareFindings);
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(Math.max(1, Math.floor(filters.page ?? 1)), pageCount);

  return {
    items: matching.slice((page - 1) * pageSize, page * pageSize),
    total: matching.length,
    page,
    pageCount,
    categoryCounts,
    severityCounts
  };
}

/** Tokens that could be external IDs, e.g. "REQ-001" or "FG-27" (trailing punctuation dropped). */
function idTokens(text: string): string[] {
  return text.match(/[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?/g) ?? [];
}

/**
 * Requirements and work items a finding mentions by ID other than its own
 * entity, e.g. the second requirement in "REQ-001 resembles REQ-004".
 */
export function mentionedEntities(
  finding: Finding,
  data: Pick<ProjectData, "requirements" | "workItems">
): { requirements: Requirement[]; workItems: WorkItem[] } {
  const requirementsById = new Map(data.requirements.map((requirement) => [requirement.externalId, requirement]));
  const workItemsById = new Map(data.workItems.map((workItem) => [workItem.externalId, workItem]));
  const requirements = new Map<string, Requirement>();
  const workItems = new Map<string, WorkItem>();

  idTokens(`${finding.title}\n${finding.description}`).forEach((token) => {
    const requirement = requirementsById.get(token);
    if (requirement && requirement.id !== finding.entityId) {
      requirements.set(requirement.id, requirement);
    }
    const workItem = workItemsById.get(token);
    if (workItem && workItem.id !== finding.entityId) {
      workItems.set(workItem.id, workItem);
    }
  });

  return { requirements: [...requirements.values()], workItems: [...workItems.values()] };
}

/** The vague terms a weak-wording finding flagged, parsed from its description. */
export function flaggedTerms(finding: Finding): string[] {
  if (finding.category !== "weak_wording") {
    return [];
  }

  const match = /wording:\s*(.+?)\.?$/i.exec(finding.description);
  return match ? match[1].split(",").map((term) => term.trim()).filter(Boolean) : [];
}
