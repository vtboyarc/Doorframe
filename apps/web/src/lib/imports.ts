import fs from "node:fs/promises";
import path from "node:path";
import type { RequirementInput, TestCaseInput, WorkItemInput } from "@doorframe/core";
import {
  parseJiraCsv,
  parseJUnitXml,
  parseRequirementsCsv,
  type ParsedTestCase,
  type ParsedWorkItem
} from "@doorframe/parsers";
import {
  defaultJiraCsvMapping,
  defaultRequirementsCsvMapping,
  TRACE_LINK_RULES
} from "@doorframe/storage";
import {
  getRequirementByExternalId,
  saveRequirements,
  saveTestCases,
  saveTraceLink,
  saveWorkItems
} from "./db";

export interface SaveParsedResult {
  recordCount: number;
  linkCount: number;
}

export function saveRequirementRecords(projectId: string, records: RequirementInput[]): SaveParsedResult {
  const saved = saveRequirements(projectId, records);
  let linkCount = 0;

  records.forEach((requirementInput) => {
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
      linkType: TRACE_LINK_RULES.parent.linkType,
      confidence: TRACE_LINK_RULES.parent.confidence,
      source: requirementInput.source
    });
    linkCount += 1;
  });

  return { recordCount: saved.length, linkCount };
}

export function saveJiraRecords(projectId: string, workItems: ParsedWorkItem[]): SaveParsedResult {
  let linkCount = 0;
  const saved = saveWorkItems(projectId, workItems as WorkItemInput[]);

  workItems.forEach((workItem) => {
    const savedWorkItem = saved.find((candidate) => candidate.externalId === workItem.externalId);

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
        linkType: TRACE_LINK_RULES.implements.linkType,
        confidence: TRACE_LINK_RULES.implements.confidence,
        source: "jira-csv"
      });
      linkCount += 1;
    });
  });

  return { recordCount: saved.length, linkCount };
}

export function saveJunitRecords(projectId: string, testCases: ParsedTestCase[]): SaveParsedResult {
  let linkCount = 0;
  const saved = saveTestCases(projectId, testCases as TestCaseInput[]);

  testCases.forEach((testCase) => {
    const savedTestCase = saved.find((candidate) => candidate.externalId === testCase.externalId);

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
        linkType: TRACE_LINK_RULES.verifies.linkType,
        confidence: TRACE_LINK_RULES.verifies.confidence,
        source: "junit-xml"
      });
      linkCount += 1;
    });
  });

  return { recordCount: saved.length, linkCount };
}

async function examplesDir(): Promise<string> {
  const candidates = [
    path.join(process.cwd(), "examples"),
    path.resolve(process.cwd(), "../..", "examples")
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate, "sample-requirements.csv"));
      return candidate;
    } catch {
      // Try the next likely workspace layout.
    }
  }

  throw new Error("Could not find Doorframe examples directory.");
}

export async function loadDemoProject(projectId: string): Promise<{
  recordCount: number;
  linkCount: number;
  errors: string[];
}> {
  const dir = await examplesDir();
  const [requirementsCsv, jiraCsv, junitXml] = await Promise.all([
    fs.readFile(path.join(dir, "sample-requirements.csv"), "utf8"),
    fs.readFile(path.join(dir, "sample-jira.csv"), "utf8"),
    fs.readFile(path.join(dir, "sample-junit.xml"), "utf8")
  ]);
  const requirements = parseRequirementsCsv(requirementsCsv, defaultRequirementsCsvMapping);
  const jira = parseJiraCsv(jiraCsv, defaultJiraCsvMapping);
  const junit = parseJUnitXml(junitXml);
  const requirementSave = saveRequirementRecords(projectId, requirements.records);
  const jiraSave = saveJiraRecords(projectId, jira.records);
  const junitSave = saveJunitRecords(projectId, junit.records);

  return {
    recordCount: requirementSave.recordCount + jiraSave.recordCount + junitSave.recordCount,
    linkCount: requirementSave.linkCount + jiraSave.linkCount + junitSave.linkCount,
    errors: [...requirements.errors, ...jira.errors, ...junit.errors]
  };
}
