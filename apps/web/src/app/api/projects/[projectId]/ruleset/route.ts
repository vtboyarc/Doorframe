import { NextResponse } from "next/server";
import { getProject, getRuleset, recordAuditEvent, saveRuleset } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import { rerunAnalysis } from "@/lib/analysis";
import { rulesetSchema } from "@doorframe/core";

export const runtime = "nodejs";

export const GET = async (_request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json(getRuleset(projectId));
};

export const PUT = async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = rulesetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") },
      { status: 400 }
    );
  }

  const saved = saveRuleset(projectId, parsed.data);
  recordAuditEvent({
    projectId,
    action: "ruleset.updated",
    actor: auditActor(),
    summary: "Updated project ruleset."
  });
  rerunAnalysis(projectId);

  return NextResponse.json(saved);
};
