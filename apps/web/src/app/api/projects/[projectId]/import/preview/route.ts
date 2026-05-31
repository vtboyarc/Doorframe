import { NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { inferJiraCsvMapping, inferRequirementsCsvMapping, readCsvHeaders } from "@doorframe/parsers";

export const runtime = "nodejs";

/**
 * Inspect an uploaded CSV: return its headers and a best-guess column mapping so
 * the import UI can pre-fill the mapping form before the user commits.
 */
export const POST = async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  if (!getProject(projectId)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const sourceType = String(formData.get("sourceType") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const text = await file.text();
  let headers: string[];
  try {
    headers = readCsvHeaders(text);
  } catch {
    return NextResponse.json({ error: "Unable to read CSV headers." }, { status: 400 });
  }

  const mapping = sourceType === "jira-csv" ? inferJiraCsvMapping(headers) : inferRequirementsCsvMapping(headers);

  // First few raw rows for a preview.
  const previewLines = text.split(/\r?\n/).slice(1, 6).filter(Boolean);

  return NextResponse.json({ headers, mapping, previewLines });
};
