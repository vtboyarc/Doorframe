import {
  type Finding,
  type ProjectData,
  type Requirement,
  type TestCase,
  type WorkItem
} from "@doorframe/core";

export interface MatrixRow {
  requirement: Requirement;
  workItems: WorkItem[];
  testCases: TestCase[];
  findings: Finding[];
}

export interface ReportSummary {
  requirementsWithoutWork: number;
  requirementsWithoutTests: number;
  failingTests: number;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function linkedIds(
  data: ProjectData,
  requirementId: string,
  targetType: "workItem" | "testCase"
): string[] {
  return data.traceLinks
    .filter((link) => {
      const requirementIsSource =
        link.sourceType === "requirement" && link.sourceId === requirementId && link.targetType === targetType;
      const requirementIsTarget =
        link.targetType === "requirement" && link.targetId === requirementId && link.sourceType === targetType;
      return requirementIsSource || requirementIsTarget;
    })
    .map((link) => (link.sourceId === requirementId ? link.targetId : link.sourceId));
}

export function matrixRows(data: ProjectData): MatrixRow[] {
  const workById = new Map(data.workItems.map((item) => [item.id, item]));
  const testById = new Map(data.testCases.map((item) => [item.id, item]));

  return data.requirements.map((requirement) => {
    const workIds = linkedIds(data, requirement.id, "workItem");
    const testIds = linkedIds(data, requirement.id, "testCase");
    const findings = data.findings.filter((finding) => finding.entityId === requirement.id);

    return {
      requirement,
      workItems: workIds.flatMap((id) => {
        const item = workById.get(id);
        return item ? [item] : [];
      }),
      testCases: testIds.flatMap((id) => {
        const item = testById.get(id);
        return item ? [item] : [];
      }),
      findings
    };
  });
}

export function summarizeReport(data: ProjectData): ReportSummary {
  const matrix = matrixRows(data);
  return {
    requirementsWithoutWork: matrix.filter((row) => row.workItems.length === 0).length,
    requirementsWithoutTests: matrix.filter((row) => row.testCases.length === 0).length,
    failingTests: data.testCases.filter((test) => test.status === "failed").length
  };
}
