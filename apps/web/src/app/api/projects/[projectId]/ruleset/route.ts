import { NextResponse } from "next/server";
import { getFindings, getProject, getRuleset, recordAuditEvent, saveRuleset } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import { rerunAnalysis } from "@/lib/analysis";
import { rulesetSchema } from "@doorframe/core";
import { normalizeStatusList, rulesetProblems } from "@/lib/ruleset-form";

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

  const ruleset = {
    ...parsed.data,
    analyzer: {
      ...parsed.data.analyzer,
      closedStatuses: normalizeStatusList(parsed.data.analyzer.closedStatuses),
      draftStatuses: normalizeStatusList(parsed.data.analyzer.draftStatuses)
    }
  };
  const problems = rulesetProblems(ruleset);
  const messages = [...problems.requirementIdPatterns, ...problems.customRules];
  if (messages.length > 0) {
    return NextResponse.json({ error: messages.join(" ") }, { status: 400 });
  }

  const previousFindingCount = getFindings(projectId).length;
  const saved = saveRuleset(projectId, ruleset);
  recordAuditEvent({
    projectId,
    action: "ruleset.updated",
    actor: auditActor(),
    summary: "Updated project ruleset."
  });
  const findings = rerunAnalysis(projectId);

  return NextResponse.json({ ruleset: saved, findingCount: findings.length, previousFindingCount });
};
