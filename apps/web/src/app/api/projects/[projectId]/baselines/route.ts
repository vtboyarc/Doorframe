import { NextResponse } from "next/server";
import { createBaseline, getProject, listBaselines, recordAuditEvent } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import { BASELINE_LABEL_MAX_LENGTH } from "@/lib/limits";

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
    requirementCount: baseline.snapshot.requirements.length,
    findingCount: baseline.snapshot.findings.length
  }));
  return NextResponse.json(baselines);
};

export const POST = async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  let label = "";
  try {
    const body = (await request.json()) as { label?: unknown };
    if (typeof body.label === "string") {
      label = body.label.trim();
    }
  } catch {
    // Empty/invalid body is fine; use the default label.
  }

  if (label.length > BASELINE_LABEL_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Baseline labels can be at most ${BASELINE_LABEL_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  if (!label) {
    const now = new Date();
    label = `Baseline ${now.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }

  const existing = listBaselines(projectId).some((baseline) => baseline.label.toLowerCase() === label.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: `A baseline named "${label}" already exists. Choose another label.` }, { status: 409 });
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
