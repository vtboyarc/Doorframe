import { auditActor } from "./audit-actor";
import { rerunAnalysis } from "./analysis";
import { addImportBatch, getProjectData, recordAuditEvent } from "./db";
import { createDemoBaselines, loadDemoProject } from "./imports";

export const DEMO_PROJECT_NAME = "Falcon Telemetry Gateway Demo";
export const DEMO_SOURCE_TYPE = "demo";

export type DemoLoadResult =
  | {
      status: "loaded";
      recordCount: number;
      linkCount: number;
      findingCount: number;
      baselineCount: number;
      errors: string[];
    }
  | { status: "already-loaded" }
  | { status: "has-other-data" }
  | { status: "not-found" };

/**
 * Load the fictional Falcon Telemetry Gateway data into a project. Refuses to
 * mix the demo with other imports: demo IDs such as REQ-001 would overwrite
 * real records that share an ID.
 */
export async function loadDemoIntoProject(projectId: string): Promise<DemoLoadResult> {
  const data = getProjectData(projectId);
  if (!data) {
    return { status: "not-found" };
  }

  if (data.importBatches.some((batch) => batch.sourceType === DEMO_SOURCE_TYPE)) {
    return { status: "already-loaded" };
  }

  if (data.requirements.length > 0 || data.workItems.length > 0 || data.testCases.length > 0) {
    return { status: "has-other-data" };
  }

  const result = await loadDemoProject(projectId);
  addImportBatch(projectId, DEMO_SOURCE_TYPE, "Falcon Telemetry Gateway sample data", result.recordCount, result.errors);
  recordAuditEvent({
    projectId,
    action: "import.completed",
    actor: auditActor(),
    summary: `Loaded ${result.recordCount} fictional demo record(s) (Falcon Telemetry Gateway).`,
    details: {
      sourceType: DEMO_SOURCE_TYPE,
      recordCount: result.recordCount,
      linkCount: result.linkCount,
      errorCount: result.errors.length
    }
  });
  const findings = rerunAnalysis(projectId);
  const baselines = createDemoBaselines(projectId, result.inputs);
  baselines.forEach((baseline) => {
    recordAuditEvent({
      projectId,
      action: "baseline.created",
      actor: auditActor(),
      summary: `Created baseline "${baseline.label}".`,
      details: { baselineId: baseline.id }
    });
  });

  return {
    status: "loaded",
    recordCount: result.recordCount,
    linkCount: result.linkCount,
    findingCount: findings.length,
    baselineCount: baselines.length,
    errors: result.errors
  };
}
