import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject, deleteProject, listProjects, recordAuditEvent } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import { loadDemoIntoProject } from "@/lib/demo";
import { PROJECT_NAME_MAX_LENGTH } from "@/lib/limits";

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH),
  demo: z.boolean().optional()
});

export function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    const onlyDemoInvalid = parsed.error.issues.every((issue) => issue.path[0] === "demo");
    return NextResponse.json(
      { error: onlyDemoInvalid ? "demo must be true or false." : `Project name is required (1-${PROJECT_NAME_MAX_LENGTH} characters).` },
      { status: 400 }
    );
  }

  const project = createProject(parsed.data.name);
  recordAuditEvent({
    projectId: project.id,
    action: "project.created",
    actor: auditActor(),
    summary: `Created project "${project.name}".`
  });

  // Create and fill the demo in one request so a failed load never leaves an empty project behind.
  if (parsed.data.demo) {
    try {
      const result = await loadDemoIntoProject(project.id);
      if (result.status !== "loaded") {
        throw new Error(result.status);
      }
    } catch {
      deleteProject(project.id);
      return NextResponse.json(
        { error: "Demo data could not be loaded. The bundled sample files may be missing." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ project }, { status: 201 });
}
