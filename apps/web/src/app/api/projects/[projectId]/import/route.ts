import {
  parseJiraCsv,
  parseJUnitXml,
  parseReqif,
  parseReqifz,
  parseRequirementsCsv,
  type JiraCsvMapping,
  type ParsedTestCase,
  type ParsedWorkItem,
  type RequirementsCsvMapping
} from "@doorframe/parsers";
import { NextResponse } from "next/server";
import {
  addImportBatch,
  getProject,
  getRequirementByExternalId,
  saveRequirements,
  saveTestCases,
  saveTraceLink,
  saveWorkItems
} from "@/lib/db";
import { rerunAnalysis } from "@/lib/analysis";
import type { RequirementInput, TestCaseInput, WorkItemInput } from "@doorframe/core";

function parseMapping<T>(value: FormDataEntryValue | null): T {
  if (!value || typeof value !== "string") {
    return {} as T;
  }

  return JSON.parse(value) as T;
}

function linkWorkItems(projectId: string, workItems: ParsedWorkItem[]): number {
  let linksCreated = 0;

  workItems.forEach((workItem) => {
    const savedWorkItem = saveWorkItems(projectId, [workItem as WorkItemInput])[0];
    workItem.requirementIds.forEach((requirementId) => {
      const requirement = getRequirementByExternalId(projectId, requirementId);
      if (!requirement || !savedWorkItem) {
        return;
      }

      saveTraceLink(projectId, {
        sourceType: "requirement",
        sourceId: requirement.id,
        targetType: "workItem",
        targetId: savedWorkItem.id,
        linkType: "implements",
        confidence: 0.85,
        source: "jira-csv"
      });
      linksCreated += 1;
    });
  });

  return linksCreated;
}

function linkTestCases(projectId: string, testCases: ParsedTestCase[]): number {
  let linksCreated = 0;

  testCases.forEach((testCase) => {
    const savedTestCase = saveTestCases(projectId, [testCase as TestCaseInput])[0];
    testCase.requirementIds.forEach((requirementId) => {
      const requirement = getRequirementByExternalId(projectId, requirementId);
      if (!requirement || !savedTestCase) {
        return;
      }

      saveTraceLink(projectId, {
        sourceType: "requirement",
        sourceId: requirement.id,
        targetType: "testCase",
        targetId: savedTestCase.id,
        linkType: "verifies",
        confidence: 0.8,
        source: "junit-xml"
      });
      linksCreated += 1;
    });
  });

  return linksCreated;
}

function linkRequirementParents(projectId: string, requirements: RequirementInput[]): number {
  let linksCreated = 0;

  requirements.forEach((requirementInput) => {
    if (!requirementInput.parentExternalId) {
      return;
    }

    const parent = getRequirementByExternalId(projectId, requirementInput.parentExternalId);
    const child = getRequirementByExternalId(projectId, requirementInput.externalId);

    if (!parent || !child) {
      return;
    }

    saveTraceLink(projectId, {
      sourceType: "requirement",
      sourceId: parent.id,
      targetType: "requirement",
      targetId: child.id,
      linkType: "parent",
      confidence: 0.95,
      source: requirementInput.source
    });
    linksCreated += 1;
  });

  return linksCreated;
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
  const errors: string[] = [];
  let recordCount = 0;
  let linkCount = 0;

  try {
    if (sourceType === "requirements-csv") {
      const mapping = parseMapping<RequirementsCsvMapping>(formData.get("mapping"));
      const result = parseRequirementsCsv(text, mapping);
      const saved = saveRequirements(projectId, result.records);
      recordCount = saved.length;
      linkCount += linkRequirementParents(projectId, result.records);
      errors.push(...result.errors);
    } else if (sourceType === "jira-csv") {
      const mapping = parseMapping<JiraCsvMapping>(formData.get("mapping"));
      const result = parseJiraCsv(text, mapping);
      linkCount += linkWorkItems(projectId, result.records);
      recordCount = result.records.length;
      errors.push(...result.errors);
    } else if (sourceType === "junit-xml") {
      const result = parseJUnitXml(text);
      linkCount += linkTestCases(projectId, result.records);
      recordCount = result.records.length;
      errors.push(...result.errors);
    } else if (sourceType === "reqif") {
      const result = parseReqif(text);
      const saved = saveRequirements(projectId, result.records);
      recordCount = saved.length;
      errors.push(...result.errors);
    } else if (sourceType === "reqifz") {
      const result = await parseReqifz(buffer);
      const saved = saveRequirements(projectId, result.records);
      recordCount = saved.length;
      errors.push(...result.errors);
    } else {
      return NextResponse.json({ error: "Unsupported import type." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    errors.push(message);
  }

  const batch = addImportBatch(projectId, sourceType, file.name, recordCount, errors);
  const findings = rerunAnalysis(projectId);

  return NextResponse.json({
    importBatch: batch,
    recordCount,
    linkCount,
    findingCount: findings.length,
    errors
  });
}
