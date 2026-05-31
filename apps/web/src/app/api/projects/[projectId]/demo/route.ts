import { NextResponse } from "next/server";
import { addImportBatch, getProject } from "@/lib/db";
import { rerunAnalysis } from "@/lib/analysis";
import { loadDemoProject } from "@/lib/imports";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const project = getProject(projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const result = await loadDemoProject(projectId);

  addImportBatch(projectId, "demo", "Falcon Telemetry Gateway sample data", result.recordCount, result.errors);
  const findings = rerunAnalysis(projectId);

  return NextResponse.json({
    recordCount: result.recordCount,
    linkCount: result.linkCount,
    findingCount: findings.length,
    errors: result.errors
  });
}
