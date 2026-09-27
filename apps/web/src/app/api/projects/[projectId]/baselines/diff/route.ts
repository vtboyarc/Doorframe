import { NextResponse } from "next/server";
import { getBaseline, getProject, getProjectData } from "@/lib/db";
import { diffBaselines, snapshotFromProjectData, type ProjectSnapshot } from "@doorframe/core";
import { baselineDiffDetails } from "@/lib/baseline-details";

export const runtime = "nodejs";

export const GET = async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const aId = url.searchParams.get("a");
  const bId = url.searchParams.get("b");

  if (!aId) {
    return NextResponse.json({ error: "Choose a baseline to compare from." }, { status: 400 });
  }

  const a = getBaseline(aId);
  if (!a || a.projectId !== projectId) {
    return NextResponse.json({ error: "Baseline 'a' not found." }, { status: 404 });
  }

  // 'b' may be another baseline or "current" (the live project data).
  let bSnapshot: ProjectSnapshot;
  if (!bId || bId === "current") {
    const data = getProjectData(projectId);
    if (!data) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    bSnapshot = snapshotFromProjectData(data);
  } else {
    const b = getBaseline(bId);
    if (!b || b.projectId !== projectId) {
      return NextResponse.json({ error: "Baseline 'b' not found." }, { status: 404 });
    }
    bSnapshot = b.snapshot;
  }

  return NextResponse.json({
    ...diffBaselines(a.snapshot, bSnapshot),
    details: baselineDiffDetails(a.snapshot, bSnapshot)
  });
};
