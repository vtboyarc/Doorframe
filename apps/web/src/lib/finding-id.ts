import { createHash } from "node:crypto";
import type { FindingInput } from "@doorframe/core";

/**
 * Deterministic finding id: the same finding keeps the same id when analysis
 * re-runs, so links to a finding keep working after imports or ruleset changes.
 * `seen` disambiguates identical findings within one analysis run.
 */
export function stableFindingId(projectId: string, finding: FindingInput, seen: Map<string, number>): string {
  const digest = createHash("sha256")
    .update([projectId, finding.category, finding.entityType, finding.entityId, finding.title].join("\u0000"))
    .digest("hex")
    .slice(0, 24);
  const occurrence = (seen.get(digest) ?? 0) + 1;
  seen.set(digest, occurrence);

  return occurrence === 1 ? `finding_${digest}` : `finding_${digest}_${occurrence}`;
}
