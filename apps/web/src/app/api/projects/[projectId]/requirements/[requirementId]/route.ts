import { NextResponse } from "next/server";
import { getProjectData, getRequirement } from "@/lib/db";
import { findingsByPriority, linkedTestCases, linkedWorkItems, requirementFindings } from "@/lib/view-models";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; requirementId: string }> }
) {
  const { projectId, requirementId } = await context.params;
  const data = getProjectData(projectId);
  if (!data) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const requirement = getRequirement(projectId, decodeURIComponent(requirementId));
  if (!requirement) {
    return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
  }

  // Same linked records and findings as the requirement detail page.
  return NextResponse.json({
    requirement,
    linkedWork: linkedWorkItems(requirement, data),
    linkedTests: linkedTestCases(requirement, data),
    findings: findingsByPriority(requirementFindings(requirement, data))
  });
}
