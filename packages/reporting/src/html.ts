import type { Finding, ProjectData, ProjectSummary, Requirement, TestCase, TraceLink, WorkItem } from "@doorframe/core";

function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linkedIds(
  requirement: Requirement,
  links: TraceLink[],
  entityType: "workItem" | "testCase"
): string[] {
  return links
    .filter((link) => {
      const fromRequirement =
        link.sourceType === "requirement" &&
        link.sourceId === requirement.id &&
        link.targetType === entityType;
      const toRequirement =
        link.targetType === "requirement" &&
        link.targetId === requirement.id &&
        link.sourceType === entityType;

      return fromRequirement || toRequirement;
    })
    .map((link) => (link.sourceId === requirement.id ? link.targetId : link.sourceId));
}

function summarize(data: ProjectData): ProjectSummary {
  const requirementLinks = data.requirements.map((requirement) => ({
    requirement,
    workIds: linkedIds(requirement, data.traceLinks, "workItem"),
    testIds: linkedIds(requirement, data.traceLinks, "testCase")
  }));
  const failedTests = new Set(data.testCases.filter((test) => test.status === "failed").map((test) => test.id));

  return {
    totalRequirements: data.requirements.length,
    totalWorkItems: data.workItems.length,
    totalTests: data.testCases.length,
    totalTraceLinks: data.traceLinks.length,
    totalFindings: data.findings.length,
    requirementsWithoutWork: requirementLinks.filter((link) => link.workIds.length === 0).length,
    requirementsWithoutTests: requirementLinks.filter((link) => link.testIds.length === 0).length,
    weakRequirements: data.findings.filter((finding) => finding.category === "weak_wording").length,
    failedTestsLinkedToRequirements: requirementLinks.filter((link) =>
      link.testIds.some((testId) => failedTests.has(testId))
    ).length
  };
}

function entityMap<T extends { id: string }>(entities: T[]): Map<string, T> {
  return new Map(entities.map((entity) => [entity.id, entity]));
}

function matrixRows(data: ProjectData): string {
  const workById = entityMap<WorkItem>(data.workItems);
  const testById = entityMap<TestCase>(data.testCases);
  const findingsByRequirement = data.findings.reduce<Map<string, Finding[]>>((acc, finding) => {
    if (finding.entityType !== "requirement") {
      return acc;
    }

    const current = acc.get(finding.entityId) ?? [];
    current.push(finding);
    acc.set(finding.entityId, current);
    return acc;
  }, new Map());

  return data.requirements
    .map((requirement) => {
      const work = linkedIds(requirement, data.traceLinks, "workItem")
        .map((id) => workById.get(id)?.externalId)
        .filter(Boolean)
        .join(", ");
      const tests = linkedIds(requirement, data.traceLinks, "testCase")
        .map((id) => {
          const test = testById.get(id);
          return test ? `${test.name} (${test.status})` : undefined;
        })
        .filter(Boolean)
        .join(", ");
      const findings = findingsByRequirement.get(requirement.id) ?? [];

      return `<tr>
        <td>${escapeHtml(requirement.externalId)}</td>
        <td>${escapeHtml(requirement.title)}</td>
        <td>${escapeHtml(requirement.status)}</td>
        <td>${escapeHtml(requirement.verificationMethod)}</td>
        <td>${escapeHtml(work || "Missing")}</td>
        <td>${escapeHtml(tests || "Missing")}</td>
        <td>${escapeHtml(findings.length)}</td>
      </tr>`;
    })
    .join("\n");
}

function findingRows(findings: Finding[]): string {
  return findings
    .map(
      (finding) => `<tr>
        <td>${escapeHtml(finding.severity)}</td>
        <td>${escapeHtml(finding.category.replaceAll("_", " "))}</td>
        <td>${escapeHtml(finding.title)}</td>
        <td>${escapeHtml(finding.description)}</td>
        <td>${escapeHtml(finding.recommendation)}</td>
      </tr>`
    )
    .join("\n");
}

export function generateHtmlTraceabilityReport(data: ProjectData): string {
  const summary = summarize(data);
  const generatedAt = new Date().toLocaleString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.project.name)} traceability report</title>
  <style>
    :root { color: #17202a; font-family: Arial, sans-serif; }
    body { margin: 40px; line-height: 1.45; }
    h1, h2 { margin: 0 0 12px; }
    h1 { font-size: 28px; }
    h2 { border-bottom: 1px solid #cfd7df; font-size: 18px; margin-top: 32px; padding-bottom: 6px; }
    .summary { display: grid; gap: 10px; grid-template-columns: repeat(4, 1fr); margin: 20px 0; }
    .metric { border: 1px solid #cfd7df; padding: 12px; }
    .metric strong { display: block; font-size: 22px; }
    table { border-collapse: collapse; margin-top: 12px; width: 100%; }
    th, td { border: 1px solid #cfd7df; font-size: 12px; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eef3f7; }
    .warning { border: 1px solid #c58b23; background: #fff8e6; padding: 12px; }
    @media print {
      body { margin: 0.5in; }
      .summary { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.project.name)} traceability report</h1>
  <p>Generated ${escapeHtml(generatedAt)} by Doorframe.</p>
  <p class="warning">Do not upload classified, controlled, proprietary, or sensitive data unless your environment is approved for that use.</p>

  <h2>Project summary</h2>
  <div class="summary">
    <div class="metric"><strong>${summary.totalRequirements}</strong>Requirements</div>
    <div class="metric"><strong>${summary.totalWorkItems}</strong>Work items</div>
    <div class="metric"><strong>${summary.totalTests}</strong>Test cases</div>
    <div class="metric"><strong>${summary.totalFindings}</strong>Findings</div>
    <div class="metric"><strong>${summary.requirementsWithoutWork}</strong>Requirements without work</div>
    <div class="metric"><strong>${summary.requirementsWithoutTests}</strong>Requirements without tests</div>
    <div class="metric"><strong>${summary.weakRequirements}</strong>Weak requirements</div>
    <div class="metric"><strong>${summary.failedTestsLinkedToRequirements}</strong>Requirements with failed tests</div>
  </div>

  <h2>Traceability matrix</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Title</th>
        <th>Status</th>
        <th>Verification method</th>
        <th>Linked work</th>
        <th>Linked tests</th>
        <th>Findings</th>
      </tr>
    </thead>
    <tbody>${matrixRows(data)}</tbody>
  </table>

  <h2>Findings summary</h2>
  <table>
    <thead>
      <tr>
        <th>Severity</th>
        <th>Category</th>
        <th>Title</th>
        <th>Description</th>
        <th>Recommendation</th>
      </tr>
    </thead>
    <tbody>${findingRows(data.findings)}</tbody>
  </table>
</body>
</html>`;
}
