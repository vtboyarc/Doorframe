import { NextResponse } from "next/server";
import { getProjectData } from "@/lib/db";
import { requirementRows } from "@/lib/view-models";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const data = getProjectData(projectId);
  if (!data) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  // Same rows and counts as the Requirements page.
  const requirements = requirementRows(data).map(({ searchText: _searchText, ...row }) => row);
  return NextResponse.json({ requirements });
}
