import { NextResponse } from "next/server";
import { getFindings, getRequirements, getTraceLinks } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const traceLinks = getTraceLinks(projectId);
  const findings = getFindings(projectId);
  const requirements = getRequirements(projectId).map((requirement) => ({
    ...requirement,
    linkedWorkCount: traceLinks.filter(
      (link) =>
        (link.sourceType === "requirement" && link.sourceId === requirement.id && link.targetType === "workItem") ||
        (link.targetType === "requirement" && link.targetId === requirement.id && link.sourceType === "workItem")
    ).length,
    linkedTestCount: traceLinks.filter(
      (link) =>
        (link.sourceType === "requirement" && link.sourceId === requirement.id && link.targetType === "testCase") ||
        (link.targetType === "requirement" && link.targetId === requirement.id && link.sourceType === "testCase")
    ).length,
    findingCount: findings.filter((finding) => finding.entityType === "requirement" && finding.entityId === requirement.id)
      .length
  }));

  return NextResponse.json({ requirements });
}
