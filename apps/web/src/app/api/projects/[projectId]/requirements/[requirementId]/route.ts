import { NextResponse } from "next/server";
import { getFindings, getRequirement, getTestCases, getTraceLinks, getWorkItems } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; requirementId: string }> }
) {
  const { projectId, requirementId } = await context.params;
  const requirement = getRequirement(projectId, decodeURIComponent(requirementId));

  if (!requirement) {
    return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
  }

  const traceLinks = getTraceLinks(projectId);
  const workItems = getWorkItems(projectId);
  const testCases = getTestCases(projectId);
  const links = traceLinks.filter(
    (link) =>
      (link.sourceType === "requirement" && link.sourceId === requirement.id) ||
      (link.targetType === "requirement" && link.targetId === requirement.id)
  );
  const linkedWork = workItems.filter((workItem) =>
    links.some((link) => link.sourceId === workItem.id || link.targetId === workItem.id)
  );
  const linkedTests = testCases.filter((testCase) =>
    links.some((link) => link.sourceId === testCase.id || link.targetId === testCase.id)
  );
  const findings = getFindings(projectId).filter(
    (finding) => finding.entityType === "requirement" && finding.entityId === requirement.id
  );

  return NextResponse.json({ requirement, linkedWork, linkedTests, findings });
}
