import { NextResponse } from "next/server";
import { getProjectSummary } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const summary = getProjectSummary(projectId);

  if (!summary) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ summary });
}
