import { NextResponse } from "next/server";
import { getProject, listAuditEvents } from "@/lib/db";

export const runtime = "nodejs";

export const GET = async (_request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json(listAuditEvents(projectId));
};
