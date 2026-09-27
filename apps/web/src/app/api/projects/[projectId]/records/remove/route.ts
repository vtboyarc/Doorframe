import { NextResponse } from "next/server";
import { z } from "zod";
import { getFindings, getProject, recordAuditEvent, removeRecords, runImportTransaction } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import { rerunAnalysis } from "@/lib/analysis";
import { entityCount } from "@/lib/import-messages";
import {
  MAX_REMOVABLE_RECORDS,
  type ImportErrorResponse,
  type RemoveRecordsResponse
} from "@/lib/import-types";

export const runtime = "nodejs";

const removeSchema = z.object({
  entityType: z.enum(["requirement", "workItem", "testCase"]),
  externalIds: z.array(z.string().trim().min(1).max(500)).min(1).max(MAX_REMOVABLE_RECORDS)
});

/** IDs listed in the audit summary; the details keep up to 50. */
const AUDIT_SUMMARY_IDS = 10;

function errorResponse(status: number, body: ImportErrorResponse) {
  return NextResponse.json(body, { status });
}

/**
 * Remove records that are no longer in the source export, together with their
 * trace links, then re-run analysis. Called only after the user confirms the
 * list the import result showed.
 */
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return errorResponse(404, { error: "Project not found." });
  }

  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, {
      error: `Send an entity type and between 1 and ${MAX_REMOVABLE_RECORDS.toLocaleString("en-US")} record IDs to remove.`
    });
  }

  const { entityType, externalIds } = parsed.data;
  // Remove and re-analyze together so a failure cannot leave records removed with stale findings.
  const { removed, findingCount } = runImportTransaction(() => {
    const result = removeRecords(projectId, entityType, externalIds);
    const removedCount = result.removedExternalIds.length;
    if (removedCount === 0) {
      return { removed: result, findingCount: getFindings(projectId).length };
    }

    const listed = result.removedExternalIds.slice(0, AUDIT_SUMMARY_IDS).join(", ");
    const more = removedCount > AUDIT_SUMMARY_IDS ? `, and ${removedCount - AUDIT_SUMMARY_IDS} more` : "";
    recordAuditEvent({
      projectId,
      action: "records.removed",
      actor: auditActor(),
      summary: `Removed ${entityCount(entityType, removedCount)} missing from a newer import: ${listed}${more}.`,
      details: {
        entityType,
        removedCount,
        removedLinkCount: result.removedLinkCount,
        externalIds: result.removedExternalIds.slice(0, 50)
      }
    });
    return { removed: result, findingCount: rerunAnalysis(projectId).length };
  });

  const body: RemoveRecordsResponse = {
    entityType,
    removedCount: removed.removedExternalIds.length,
    removedExternalIds: removed.removedExternalIds,
    removedLinkCount: removed.removedLinkCount,
    findingCount
  };
  return NextResponse.json(body);
}
