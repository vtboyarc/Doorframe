import { generateFindings } from "@doorframe/analyzers";
import { getProjectData, getRuleset, recordAuditEvent, replaceFindings } from "./db";
import { auditActor } from "./audit-actor";

export function rerunAnalysis(projectId: string) {
  const data = getProjectData(projectId);
  if (!data) {
    return [];
  }

  const ruleset = getRuleset(projectId);
  const findings = replaceFindings(
    projectId,
    generateFindings(
      {
        requirements: data.requirements,
        workItems: data.workItems,
        testCases: data.testCases,
        traceLinks: data.traceLinks
      },
      ruleset
    )
  );

  recordAuditEvent({
    projectId,
    action: "analysis.rerun",
    actor: auditActor(),
    summary: `Re-ran analysis and generated ${findings.length} finding(s).`
  });

  return findings;
}
