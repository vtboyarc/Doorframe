import { NextResponse } from "next/server";
import { createBaseline, getProject, listBaselines, recordAuditEvent } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";

export const runtime = "nodejs";

export const GET = async (_request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  // Omit large snapshots from the list response.
  const baselines = listBaselines(projectId).map((baseline) => ({
    id: baseline.id,
    projectId: baseline.projectId,
    label: baseline.label,
    createdAt: baseline.createdAt,
    requirementCount: baseline.snapshot.requirements.length
  }));
  return NextResponse.json(baselines);
};

export const POST = async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  let label = `Baseline ${new Date().toISOString()}`;
  try {
    const body = (await request.json()) as { label?: string };
    if (body.label) {
      label = body.label;
    }
  } catch {
    // Empty/invalid body is fine; use the default label.
  }

  const baseline = createBaseline(projectId, label);
  if (!baseline) {
    return NextResponse.json({ error: "Unable to create baseline." }, { status: 500 });
  }

  recordAuditEvent({
    projectId,
    action: "baseline.created",
    actor: auditActor(),
    summary: `Created baseline "${baseline.label}".`,
    details: { baselineId: baseline.id }
  });

  return NextResponse.json({ id: baseline.id, label: baseline.label, createdAt: baseline.createdAt });
};
