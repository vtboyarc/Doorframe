import { NextResponse } from "next/server";
import { loadDemoIntoProject } from "@/lib/demo";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  let result;
  try {
    result = await loadDemoIntoProject(projectId);
  } catch {
    return NextResponse.json({ error: "Demo data could not be loaded. The bundled sample files may be missing." }, { status: 500 });
  }

  switch (result.status) {
    case "not-found":
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    case "already-loaded":
      return NextResponse.json({ error: "Demo data is already loaded in this project." }, { status: 409 });
    case "has-other-data":
      return NextResponse.json(
        {
          error:
            "This project already has imported data. Demo IDs such as REQ-001 would overwrite matching records, so load the demo into a new, empty project instead."
        },
        { status: 409 }
      );
    case "loaded":
      return NextResponse.json({
        recordCount: result.recordCount,
        linkCount: result.linkCount,
        findingCount: result.findingCount,
        baselineCount: result.baselineCount,
        errors: result.errors
      });
  }
}
