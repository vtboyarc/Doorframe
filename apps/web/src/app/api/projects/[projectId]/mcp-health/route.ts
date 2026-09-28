import { NextResponse } from "next/server";
import { getProjectData, listBaselines } from "@/lib/db";
import { mcpToolCheckSettingsFromSearchParams, runMcpToolChecks } from "@/lib/mcp-health";

export const runtime = "nodejs";

/**
 * Runs the MCP setup page's tool checks: four read-only MCP tool adapters called against this
 * project with the data options in the query string (mode, maxResults, hideRawText). The page
 * calls this only when asked, because the tools can take several seconds on large projects.
 */
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const projectData = getProjectData(projectId);
  if (!projectData) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  try {
    const settings = mcpToolCheckSettingsFromSearchParams(new URL(request.url).searchParams);
    const toolChecks = runMcpToolChecks({ projectData, baselines: listBaselines(projectId), ...settings });
    return NextResponse.json({ toolChecks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The MCP tool checks could not run.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
