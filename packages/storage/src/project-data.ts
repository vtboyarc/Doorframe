import { generateFindings } from "@doorframe/analyzers";
import {
  createId,
  nowIso,
  type Finding,
  type FindingSeverity,
  type ImportBatch,
  type Project,
  type ProjectData,
  type Requirement,
  type RequirementInput,
  type TestCase,
  type TestCaseInput,
  type TraceLink,
  type WorkItem,
  type WorkItemInput
} from "@doorframe/core";
import type { JiraCsvMapping, ParsedTestCase, ParsedWorkItem, RequirementsCsvMapping } from "@doorframe/parsers";

export const defaultRequirementsCsvMapping: RequirementsCsvMapping = {
  requirementId: "ID",
  title: "Title",
  text: "Text",
  status: "Status",
  type: "Type",
  priority: "Priority",
  verificationMethod: "Verification Method",
  parentId: "Parent ID"
};

export const defaultJiraCsvMapping: JiraCsvMapping = {
  issueKey: "Key",
  summary: "Summary",
  description: "Description",
  status: "Status",
  issueType: "Issue Type",
  assignee: "Assignee",
  requirementIds: "Requirement IDs"
};

export interface ImportedProjectRecords {
  projectName: string;
  requirements: RequirementInput[];
  workItems: ParsedWorkItem[];
  testCases: ParsedTestCase[];
  importBatches?: ImportBatch[];
}

export interface DoorframeSummary {
  requirements: number;
  workItems: number;
  tests: number;
  traceLinks: number;
  findings: number;
  high: number;
  medium: number;
  low: number;
}

function withProject<T extends { id: string; projectId: string; createdAt: string; updatedAt: string }>(
  entity: Omit<T, "id" | "projectId" | "createdAt" | "updatedAt">,
  prefix: string,
  projectId: string,
  timestamp: string
): T {
  return {
    ...entity,
    id: createId(prefix),
    projectId,
    createdAt: timestamp,
    updatedAt: timestamp
  } as T;
}

function stripRequirementIds(workItem: ParsedWorkItem): WorkItemInput {
  const { requirementIds: _requirementIds, ...input } = workItem;
  return input;
}

function stripTestRequirementIds(testCase: ParsedTestCase): TestCaseInput {
  const { requirementIds: _requirementIds, ...input } = testCase;
  return input;
}

function createImportBatch(
  projectId: string,
  sourceType: string,
  filename: string,
  recordCount: number,
  timestamp: string,
  errors: string[] = []
): ImportBatch {
  return {
    id: createId("import"),
    projectId,
    sourceType,
    filename,
    importedAt: timestamp,
    recordCount,
    errors
  };
}

function addTraceLink(
  traceLinks: TraceLink[],
  projectId: string,
  timestamp: string,
  input: Omit<TraceLink, "id" | "projectId" | "createdAt" | "updatedAt">
): void {
  const exists = traceLinks.some(
    (link) =>
      link.sourceType === input.sourceType &&
      link.sourceId === input.sourceId &&
      link.targetType === input.targetType &&
      link.targetId === input.targetId &&
      link.linkType === input.linkType
  );

  if (exists) {
    return;
  }

  traceLinks.push(
    withProject<TraceLink>(
      {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        linkType: input.linkType,
        confidence: input.confidence,
        source: input.source
      },
      "trace",
      projectId,
      timestamp
    )
  );
}

export function buildProjectDataFromImportedRecords(input: ImportedProjectRecords): ProjectData {
  const timestamp = nowIso();
  const project: Project = {
    id: createId("project"),
    name: input.projectName,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const requirements = input.requirements.map((requirement) =>
    withProject<Requirement>(requirement, "req", project.id, timestamp)
  );
  const workItems = input.workItems.map((workItem) =>
    withProject<WorkItem>(stripRequirementIds(workItem), "work", project.id, timestamp)
  );
  const testCases = input.testCases.map((testCase) =>
    withProject<TestCase>(stripTestRequirementIds(testCase), "test", project.id, timestamp)
  );
  const requirementsByExternalId = new Map(requirements.map((requirement) => [requirement.externalId, requirement]));
  const workByExternalId = new Map(workItems.map((workItem) => [workItem.externalId, workItem]));
  const testsByExternalId = new Map(testCases.map((testCase) => [testCase.externalId, testCase]));
  const traceLinks: TraceLink[] = [];

  requirements.forEach((requirement) => {
    if (!requirement.parentExternalId) {
      return;
    }

    const parent = requirementsByExternalId.get(requirement.parentExternalId);
    if (!parent) {
      return;
    }

    addTraceLink(traceLinks, project.id, timestamp, {
      sourceType: "requirement",
      sourceId: parent.id,
      targetType: "requirement",
      targetId: requirement.id,
      linkType: "parent",
      confidence: 0.95,
      source: requirement.source
    });
  });

  input.workItems.forEach((parsedWorkItem) => {
    const workItem = workByExternalId.get(parsedWorkItem.externalId);
    if (!workItem) {
      return;
    }

    parsedWorkItem.requirementIds.forEach((requirementId) => {
      const requirement = requirementsByExternalId.get(requirementId);
      if (!requirement) {
        return;
      }

      addTraceLink(traceLinks, project.id, timestamp, {
        sourceType: "requirement",
        sourceId: requirement.id,
        targetType: "workItem",
        targetId: workItem.id,
        linkType: "implements",
        confidence: 0.85,
        source: parsedWorkItem.source
      });
    });
  });

  input.testCases.forEach((parsedTestCase) => {
    const testCase = testsByExternalId.get(parsedTestCase.externalId);
    if (!testCase) {
      return;
    }

    parsedTestCase.requirementIds.forEach((requirementId) => {
      const requirement = requirementsByExternalId.get(requirementId);
      if (!requirement) {
        return;
      }

      addTraceLink(traceLinks, project.id, timestamp, {
        sourceType: "requirement",
        sourceId: requirement.id,
        targetType: "testCase",
        targetId: testCase.id,
        linkType: "verifies",
        confidence: 0.8,
        source: parsedTestCase.source
      });
    });
  });

  const findingInputs = generateFindings({
    requirements,
    workItems,
    testCases,
    traceLinks
  });
  const findings = findingInputs.map((finding) =>
    withProject<Finding>(
      {
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        description: finding.description,
        entityType: finding.entityType,
        entityId: finding.entityId,
        recommendation: finding.recommendation
      },
      "finding",
      project.id,
      timestamp
    )
  );
  const importBatches = (
    input.importBatches ?? [
      createImportBatch(project.id, "requirements-csv", "requirements.csv", requirements.length, timestamp),
      createImportBatch(project.id, "jira-csv", "jira.csv", workItems.length, timestamp),
      createImportBatch(project.id, "junit-xml", "junit.xml", testCases.length, timestamp)
    ]
  ).map((batch) => ({ ...batch, projectId: project.id }));

  return {
    project,
    requirements,
    workItems,
    testCases,
    traceLinks,
    findings,
    importBatches
  };
}

function severityBucket(severity: FindingSeverity): "high" | "medium" | "low" {
  if (severity === "error") {
    return "high";
  }

  if (severity === "warning") {
    return "medium";
  }

  return "low";
}

export function summarizeProjectData(data: ProjectData): DoorframeSummary {
  return data.findings.reduce<DoorframeSummary>(
    (summary, finding) => {
      summary[severityBucket(finding.severity)] += 1;
      return summary;
    },
    {
      requirements: data.requirements.length,
      workItems: data.workItems.length,
      tests: data.testCases.length,
      traceLinks: data.traceLinks.length,
      findings: data.findings.length,
      high: 0,
      medium: 0,
      low: 0
    }
  );
}
