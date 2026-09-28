import { auditActor } from "./audit-actor";
import { rerunAnalysis } from "./analysis";
import { addImportBatch, getProject, getProjectData, recordAuditEvent, runImportTransaction } from "./db";
import { plural } from "./import-messages";
import { createDemoBaselines, readDemoFiles, saveDemoRecords } from "./imports";

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
 * real records that share an ID. The checks and every write run in one
 * transaction, so a double submit or a failure part-way cannot leave the
 * project half-loaded or loaded twice.
 */
export async function loadDemoIntoProject(projectId: string): Promise<DemoLoadResult> {
  if (!getProject(projectId)) {
    return { status: "not-found" };
  }

  const files = await readDemoFiles();
  return runImportTransaction((): DemoLoadResult => {
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

    const saved = saveDemoRecords(projectId, files);
    addImportBatch(projectId, DEMO_SOURCE_TYPE, "Falcon Telemetry Gateway sample data", saved.recordCount, saved.errors);
    recordAuditEvent({
      projectId,
      action: "import.completed",
      actor: auditActor(),
      summary: `Loaded ${plural(saved.recordCount, "fictional demo record")} (Falcon Telemetry Gateway).`,
      details: {
        sourceType: DEMO_SOURCE_TYPE,
        recordCount: saved.recordCount,
        linkCount: saved.linkCount,
        errorCount: saved.errors.length
      }
    });
    const findings = rerunAnalysis(projectId);
    const baselines = createDemoBaselines(projectId, files.inputs);
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
      recordCount: saved.recordCount,
      linkCount: saved.linkCount,
      findingCount: findings.length,
      baselineCount: baselines.length,
      errors: saved.errors
    };
  });
}
