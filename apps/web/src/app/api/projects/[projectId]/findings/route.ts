import { NextResponse } from "next/server";
import { getFindings } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  return NextResponse.json({ findings: getFindings(projectId) });
}
