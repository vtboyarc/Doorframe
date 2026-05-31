import { generateFindings } from "@doorframe/analyzers";
import { getProjectData, replaceFindings } from "./db";

export function rerunAnalysis(projectId: string) {
  const data = getProjectData(projectId);
  if (!data) {
    return [];
  }

  return replaceFindings(
    projectId,
    generateFindings({
      requirements: data.requirements,
      workItems: data.workItems,
      testCases: data.testCases,
      traceLinks: data.traceLinks
    })
  );
}
