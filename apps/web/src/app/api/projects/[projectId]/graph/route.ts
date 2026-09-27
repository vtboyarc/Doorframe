import { NextResponse } from "next/server";
import { getProjectData } from "@/lib/db";
import { traceGraphData } from "@/lib/trace-graph";

/** Trace graph nodes and edges, the same data the trace graph page draws. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const data = getProjectData(projectId);

  if (!data) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json(traceGraphData(data, projectId));
}
