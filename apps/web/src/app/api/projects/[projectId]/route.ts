import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteProject, getProject, recordAuditEvent, renameProject } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import { PROJECT_NAME_MAX_LENGTH } from "@/lib/limits";

const renameSchema = z.object({ name: z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH) });

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const existing = getProject(projectId);
  if (!existing) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const parsed = renameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Project name is required (1-${PROJECT_NAME_MAX_LENGTH} characters).` },
      { status: 400 }
    );
  }

  const project = renameProject(projectId, parsed.data.name);
  if (project && project.name !== existing.name) {
    recordAuditEvent({
      projectId,
      action: "project.renamed",
      actor: auditActor(),
      summary: `Renamed project from "${existing.name}" to "${project.name}".`
    });
  }

  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  if (!deleteProject(projectId)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
