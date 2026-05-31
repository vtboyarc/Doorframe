import {
  parseJiraCsv,
  parseJUnitXml,
  parseReqif,
  parseReqifz,
  parseRequirementsCsv,
  type JiraCsvMapping,
  type RequirementsCsvMapping
} from "@doorframe/parsers";
import { NextResponse } from "next/server";
import {
  addImportBatch,
  getProject,
  getRuleset,
  recordAuditEvent
} from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import { rerunAnalysis } from "@/lib/analysis";
import { saveJiraRecords, saveJunitRecords, saveRequirementRecords } from "@/lib/imports";

function parseMapping<T>(value: FormDataEntryValue | null): T {
  if (!value || typeof value !== "string") {
    return {} as T;
  }

  return JSON.parse(value) as T;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const project = getProject(projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const sourceType = String(formData.get("sourceType") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload file is required." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = buffer.toString("utf8");
  const patterns = getRuleset(projectId).requirementIdPatterns;
  const errors: string[] = [];
  let recordCount = 0;
  let linkCount = 0;

  try {
    if (sourceType === "requirements-csv") {
      const mapping = parseMapping<RequirementsCsvMapping>(formData.get("mapping"));
      const result = parseRequirementsCsv(text, mapping);
      const saved = saveRequirementRecords(projectId, result.records);
      recordCount = saved.recordCount;
      linkCount += saved.linkCount;
      errors.push(...result.errors);
    } else if (sourceType === "jira-csv") {
      const mapping = parseMapping<JiraCsvMapping>(formData.get("mapping"));
      const result = parseJiraCsv(text, mapping, patterns);
      const saved = saveJiraRecords(projectId, result.records);
      recordCount = saved.recordCount;
      linkCount += saved.linkCount;
      errors.push(...result.errors);
    } else if (sourceType === "junit-xml") {
      const result = parseJUnitXml(text, patterns);
      const saved = saveJunitRecords(projectId, result.records);
      recordCount = saved.recordCount;
      linkCount += saved.linkCount;
      errors.push(...result.errors);
    } else if (sourceType === "reqif") {
      const result = parseReqif(text);
      const saved = saveRequirementRecords(projectId, result.records);
      recordCount = saved.recordCount;
      linkCount += saved.linkCount;
      errors.push(...result.errors);
    } else if (sourceType === "reqifz") {
      const result = await parseReqifz(buffer);
      const saved = saveRequirementRecords(projectId, result.records);
      recordCount = saved.recordCount;
      linkCount += saved.linkCount;
      errors.push(...result.errors);
    } else {
      return NextResponse.json({ error: "Unsupported import type." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    errors.push(message);
  }

  const batch = addImportBatch(projectId, sourceType, file.name, recordCount, errors);
  recordAuditEvent({
    projectId,
    action: "import.completed",
    actor: auditActor(),
    summary: `Imported ${recordCount} record(s) from ${file.name} (${sourceType}).`,
    details: { sourceType, filename: file.name, recordCount, linkCount, errorCount: errors.length }
  });
  const findings = rerunAnalysis(projectId);

  return NextResponse.json({
    importBatch: batch,
    recordCount,
    linkCount,
    findingCount: findings.length,
    errors
  });
}
