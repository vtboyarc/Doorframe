import { snapshotFromProjectData, type ProjectData, type ProjectSnapshot } from "@doorframe/core";
import { matrixRows, summarizeReport } from "./shared";

export interface JsonReport {
  generatedAt: string;
  project: { id: string; name: string };
  summary: {
    requirements: number;
    workItems: number;
    tests: number;
    traceLinks: number;
    findings: number;
    requirementsWithoutWork: number;
    requirementsWithoutTests: number;
    requirementsWithoutPassingTests: number;
    failingTests: number;
  };
  matrix: {
    requirementId: string;
    title: string;
    status?: string;
    workItems: string[];
    testCases: { name: string; status: string }[];
    findings: string[];
  }[];
  snapshot: ProjectSnapshot;
}

/**
 * Build a structured JSON report. The embedded `snapshot` doubles as Doorframe's
 * portable export format and is the input consumed by `doorframe diff`.
 */
export function buildJsonReport(data: ProjectData): JsonReport {
  const summary = summarizeReport(data);
  return {
    generatedAt: new Date().toISOString(),
    project: { id: data.project.id, name: data.project.name },
    summary: {
      requirements: data.requirements.length,
      workItems: data.workItems.length,
      tests: data.testCases.length,
      traceLinks: data.traceLinks.length,
      findings: data.findings.length,
      requirementsWithoutWork: summary.requirementsWithoutWork,
      requirementsWithoutTests: summary.requirementsWithoutTests,
      requirementsWithoutPassingTests: summary.requirementsWithoutPassingTests,
      failingTests: summary.failingTests
    },
    matrix: matrixRows(data).map((row) => ({
      requirementId: row.requirement.externalId,
      title: row.requirement.title,
      status: row.requirement.status,
      workItems: row.workItems.map((item) => item.externalId),
      testCases: row.testCases.map((item) => ({ name: item.name, status: item.status })),
      findings: row.findings.map((finding) => finding.title)
    })),
    snapshot: snapshotFromProjectData(data)
  };
}

export function generateJsonReport(data: ProjectData): string {
  return JSON.stringify(buildJsonReport(data), null, 2);
}
