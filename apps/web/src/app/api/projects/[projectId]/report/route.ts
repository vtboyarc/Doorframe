import { generateHtmlTraceabilityReport } from "@doorframe/reporting";
import { getProjectData } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const data = getProjectData(projectId);

  if (!data) {
    return new Response("Project not found.", { status: 404 });
  }

  return new Response(generateHtmlTraceabilityReport(data), {
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}
