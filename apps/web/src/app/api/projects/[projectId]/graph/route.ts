import { NextResponse } from "next/server";
import { getProjectData } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const data = getProjectData(projectId);

  if (!data) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const nodes = [
    ...data.requirements.map((requirement) => ({
      id: requirement.id,
      type: "requirement",
      label: requirement.externalId,
      title: requirement.title
    })),
    ...data.workItems.map((workItem) => ({
      id: workItem.id,
      type: "workItem",
      label: workItem.externalId,
      title: workItem.title
    })),
    ...data.testCases.map((testCase) => ({
      id: testCase.id,
      type: "testCase",
      label: testCase.name,
      title: testCase.status
    }))
  ];
  const edges = data.traceLinks.map((link) => ({
    id: link.id,
    source: link.sourceId,
    target: link.targetId,
    label: link.linkType
  }));

  return NextResponse.json({ nodes, edges });
}
