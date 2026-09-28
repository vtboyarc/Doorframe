import { NextResponse } from "next/server";
import { diffBaselines, snapshotFromProjectData, type ProjectSnapshot } from "@doorframe/core";
import { generateBaselineDiffHtmlReport } from "@doorframe/reporting";
import { auditActor } from "@/lib/audit-actor";
import { baselineDiffDetails, baselineDiffReport, baselineRecordChanges } from "@/lib/baseline-details";
import { getBaseline, getProject, getProjectData, recordAuditEvent } from "@/lib/db";
import { reportFilename } from "@/lib/report-filename";

export const runtime = "nodejs";

/** Matches the "Current state" option on the Baselines page. */
const CURRENT_LABEL = "Current state";

/**
 * Compare baseline `a` with baseline `b`, or with the current project data when `b` is omitted or
 * "current". JSON by default; `format=html` returns the printable baseline diff report, and
 * `download=1` saves it as a file.
 */
export const GET = async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const aId = url.searchParams.get("a");
  const bId = url.searchParams.get("b");
  const format = url.searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "html") {
    return NextResponse.json({ error: "Unknown diff format. Use json or html." }, { status: 400 });
  }

  if (!aId) {
    return NextResponse.json({ error: "Choose a baseline to compare from." }, { status: 400 });
  }

  const a = getBaseline(aId);
  if (!a || a.projectId !== projectId) {
    return NextResponse.json({ error: "Baseline 'a' not found." }, { status: 404 });
  }

  let bSnapshot: ProjectSnapshot;
  let bLabel: string;
  if (!bId || bId === "current") {
    const data = getProjectData(projectId);
    if (!data) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    bSnapshot = snapshotFromProjectData(data);
    bLabel = CURRENT_LABEL;
  } else {
    const b = getBaseline(bId);
    if (!b || b.projectId !== projectId) {
      return NextResponse.json({ error: "Baseline 'b' not found." }, { status: 404 });
    }
    bSnapshot = b.snapshot;
    bLabel = b.label;
  }

  const diff = diffBaselines(a.snapshot, bSnapshot);
  const details = baselineDiffDetails(a.snapshot, bSnapshot);

  if (format === "html") {
    const download = url.searchParams.get("download") === "1";
    const html = generateBaselineDiffHtmlReport(baselineDiffReport(a.snapshot, bSnapshot, a.label, bLabel), {
      projectName: project.name,
      recordChanges: baselineRecordChanges(diff, details)
    });
    recordAuditEvent({
      projectId,
      action: "report.generated",
      actor: auditActor(),
      summary: `${download ? "Downloaded" : "Opened"} baseline diff report (${a.label} to ${bLabel}).`,
      details: { baselineA: a.id, baselineB: bId && bId !== "current" ? bId : "current" }
    });
    const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${reportFilename(project.name, "baseline-diff", "html")}"`;
    }
    return new NextResponse(html, { headers });
  }

  return NextResponse.json({ ...diff, details });
};
