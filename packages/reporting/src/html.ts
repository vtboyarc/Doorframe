import type {
  Finding,
  ProjectData,
  ProjectSummary,
  Requirement,
  TestCase,
  TraceLink,
  WorkItem
} from "@doorframe/core";

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

function findingsForRequirement(requirement: Requirement, findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.entityType === "requirement" && finding.entityId === requirement.id);
}

function displaySeverity(severity: Finding["severity"]): string {
  if (severity === "error") {
    return "High";
  }

  if (severity === "warning") {
    return "Medium";
  }

  return "Low";
}

function emptyRow(columns: number, message: string): string {
  return `<tr><td colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function matrixRows(data: ProjectData): string {
  const workById = entityMap<WorkItem>(data.workItems);
  const testById = entityMap<TestCase>(data.testCases);

  return data.requirements
    .map((requirement) => {
      const linkedWork = linkedIds(requirement, data.traceLinks, "workItem")
        .map((id) => workById.get(id))
        .filter(Boolean) as WorkItem[];
      const linkedTests = linkedIds(requirement, data.traceLinks, "testCase")
        .map((id) => testById.get(id))
        .filter(Boolean) as TestCase[];
      const requirementFindings = findingsForRequirement(requirement, data.findings);

      return `<tr>
        <td>${escapeHtml(requirement.externalId)}</td>
        <td>${escapeHtml(requirement.title)}</td>
        <td>${escapeHtml(requirement.status || "Unspecified")}</td>
        <td>${escapeHtml(requirement.verificationMethod || "Unspecified")}</td>
        <td>${escapeHtml(linkedWork.map((work) => `${work.externalId} (${work.status ?? "No status"})`).join(", ") || "Missing")}</td>
        <td>${escapeHtml(linkedTests.map((test) => test.name).join(", ") || "Missing")}</td>
        <td>${escapeHtml(linkedTests.map((test) => test.status).join(", ") || "Missing")}</td>
        <td>${escapeHtml(requirementFindings.map((finding) => finding.category.replaceAll("_", " ")).join(", ") || "None")}</td>
      </tr>`;
    })
    .join("\n");
}

function importRows(data: ProjectData): string {
  if (data.importBatches.length === 0) {
    return emptyRow(5, "No import batches recorded.");
  }

  return data.importBatches
    .map(
      (batch) => `<tr>
        <td>${escapeHtml(batch.sourceType)}</td>
        <td>${escapeHtml(batch.filename)}</td>
        <td>${escapeHtml(batch.recordCount)}</td>
        <td>${escapeHtml(batch.errors.length)}</td>
        <td>${escapeHtml(new Date(batch.importedAt).toLocaleString())}</td>
      </tr>`
    )
    .join("\n");
}

function findingRows(findings: Finding[]): string {
  if (findings.length === 0) {
    return emptyRow(5, "No findings.");
  }

  return findings
    .map(
      (finding) => `<tr>
        <td>${escapeHtml(displaySeverity(finding.severity))}</td>
        <td>${escapeHtml(finding.category.replaceAll("_", " "))}</td>
        <td>${escapeHtml(finding.title)}</td>
        <td>${escapeHtml(finding.description)}</td>
        <td>${escapeHtml(finding.recommendation)}</td>
      </tr>`
    )
    .join("\n");
}

function requirementRows(
  requirements: Requirement[],
  data: ProjectData,
  message: string
): string {
  if (requirements.length === 0) {
    return emptyRow(4, message);
  }

  return requirements
    .map((requirement) => {
      const findings = findingsForRequirement(requirement, data.findings);

      return `<tr>
        <td>${escapeHtml(requirement.externalId)}</td>
        <td>${escapeHtml(requirement.title)}</td>
        <td>${escapeHtml(requirement.status || "Unspecified")}</td>
        <td>${escapeHtml(findings.map((finding) => finding.category.replaceAll("_", " ")).join(", ") || "None")}</td>
      </tr>`;
    })
    .join("\n");
}

function failedTestsByRequirementRows(data: ProjectData): string {
  const testById = entityMap<TestCase>(data.testCases);
  const rows = data.requirements.flatMap((requirement) =>
    linkedIds(requirement, data.traceLinks, "testCase")
      .map((id) => testById.get(id))
      .filter((test): test is TestCase => test !== undefined && test.status === "failed")
      .map(
        (test) => `<tr>
          <td>${escapeHtml(requirement.externalId)}</td>
          <td>${escapeHtml(requirement.title)}</td>
          <td>${escapeHtml(test.name)}</td>
          <td>${escapeHtml(test.failureMessage || "No failure message")}</td>
        </tr>`
      )
  );

  return rows.length > 0 ? rows.join("\n") : emptyRow(4, "No failed linked tests.");
}

function closedWorkWithoutPassingRows(data: ProjectData): string {
  const findings = data.findings.filter((finding) => finding.category === "closed_work_without_verification");
  const workById = entityMap<WorkItem>(data.workItems);

  if (findings.length === 0) {
    return emptyRow(4, "No closed linked work without passing verification was detected.");
  }

  return findings
    .map((finding) => {
      const workItem = workById.get(finding.entityId);

      return `<tr>
        <td>${escapeHtml(workItem?.externalId || finding.entityId)}</td>
        <td>${escapeHtml(workItem?.title || finding.title)}</td>
        <td>${escapeHtml(workItem?.status || "Closed")}</td>
        <td>${escapeHtml(finding.description)}</td>
      </tr>`;
    })
    .join("\n");
}

function weakLanguageRows(data: ProjectData): string {
  const findings = data.findings.filter((finding) => finding.category === "weak_wording");
  const requirementsById = entityMap<Requirement>(data.requirements);

  if (findings.length === 0) {
    return emptyRow(4, "No weak wording findings.");
  }

  return findings
    .map((finding) => {
      const requirement = requirementsById.get(finding.entityId);

      return `<tr>
        <td>${escapeHtml(requirement?.externalId || finding.entityId)}</td>
        <td>${escapeHtml(requirement?.title || finding.title)}</td>
        <td>${escapeHtml(finding.description)}</td>
        <td>${escapeHtml(finding.recommendation)}</td>
      </tr>`;
    })
    .join("\n");
}

function duplicateCandidateRows(data: ProjectData): string {
  const findings = data.findings.filter((finding) => finding.category === "duplicate_candidate");

  if (findings.length === 0) {
    return emptyRow(3, "No duplicate candidates.");
  }

  return findings
    .map(
      (finding) => `<tr>
        <td>${escapeHtml(finding.title)}</td>
        <td>${escapeHtml(finding.description)}</td>
        <td>${escapeHtml(finding.recommendation)}</td>
      </tr>`
    )
    .join("\n");
}

function appendixRows(data: ProjectData): string {
  const rows = [
    ...data.requirements.map((requirement) => ["Requirement", requirement.externalId, requirement.title]),
    ...data.workItems.map((workItem) => ["Work item", workItem.externalId, workItem.title]),
    ...data.testCases.map((testCase) => ["Test case", testCase.externalId, testCase.name])
  ];

  return rows
    .map(
      ([type, id, title]) => `<tr>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(id)}</td>
        <td>${escapeHtml(title)}</td>
      </tr>`
    )
    .join("\n");
}

export function generateHtmlTraceabilityReport(data: ProjectData): string {
  const summary = summarize(data);
  const generatedAt = new Date().toLocaleString();
  const requirementsWithoutWork = data.requirements.filter(
    (requirement) => linkedIds(requirement, data.traceLinks, "workItem").length === 0
  );
  const requirementsWithoutTests = data.requirements.filter(
    (requirement) => linkedIds(requirement, data.traceLinks, "testCase").length === 0
  );
  const findingsBySeverity = {
    high: data.findings.filter((finding) => finding.severity === "error"),
    medium: data.findings.filter((finding) => finding.severity === "warning"),
    low: data.findings.filter((finding) => finding.severity === "info")
  };
  const isDemoData = data.importBatches.some((batch) => batch.sourceType === "demo");
  const demoBanner = isDemoData
    ? `<p class="demo-banner">This report was generated from fictional Doorframe sample data. It is for demonstration only and must not be used as real review evidence.</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.project.name)} traceability gap report</title>
  <style>
    :root { color: #17202a; font-family: Arial, sans-serif; }
    body { margin: 40px; line-height: 1.45; }
    h1, h2, h3 { margin: 0 0 12px; }
    h1 { font-size: 28px; }
    h2 { border-bottom: 1px solid #cfd7df; font-size: 19px; margin-top: 32px; padding-bottom: 6px; }
    h3 { font-size: 15px; margin-top: 20px; }
    p { margin: 8px 0; }
    .meta { color: #53616d; font-size: 13px; }
    .summary { display: grid; gap: 10px; grid-template-columns: repeat(4, 1fr); margin: 20px 0; }
    .metric { border: 1px solid #cfd7df; padding: 12px; }
    .metric strong { display: block; font-size: 22px; }
    table { border-collapse: collapse; margin-top: 12px; width: 100%; }
    th, td { border: 1px solid #cfd7df; font-size: 12px; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eef3f7; }
    .warning { border: 1px solid #b8860b; background: #fff8e6; margin: 18px 0; padding: 12px; }
    .demo-banner { border: 2px solid #b03a2e; background: #fdecea; color: #7b241c; font-weight: bold; margin: 18px 0; padding: 12px; }
    .page-break { break-before: page; }
    @media print {
      body { margin: 0.5in; }
      .summary { grid-template-columns: repeat(2, 1fr); }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.project.name)} traceability gap report</h1>
  <p class="meta">Generated ${escapeHtml(generatedAt)} by Doorframe.</p>
  ${demoBanner}
  <p class="warning">Doorframe runs locally by default and does not send imported project data to any external service. Do not use Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.</p>

  <h2>Executive summary</h2>
  <p>This report summarizes traceability gaps found across imported requirements, work items, and test results. It is intended for review preparation and does not replace official requirements, test, security, or compliance systems.</p>
  <div class="summary">
    <div class="metric"><strong>${summary.totalRequirements}</strong>Requirements</div>
    <div class="metric"><strong>${summary.totalWorkItems}</strong>Work items</div>
    <div class="metric"><strong>${summary.totalTests}</strong>Test cases</div>
    <div class="metric"><strong>${summary.totalTraceLinks}</strong>Trace links</div>
    <div class="metric"><strong>${summary.totalFindings}</strong>Findings</div>
    <div class="metric"><strong>${summary.requirementsWithoutWork}</strong>Requirements without work</div>
    <div class="metric"><strong>${summary.requirementsWithoutTests}</strong>Requirements without tests</div>
    <div class="metric"><strong>${summary.failedTestsLinkedToRequirements}</strong>Requirements with failed tests</div>
  </div>

  <h2>Import summary</h2>
  <table>
    <thead>
      <tr><th>Source type</th><th>Filename</th><th>Records</th><th>Errors</th><th>Imported at</th></tr>
    </thead>
    <tbody>${importRows(data)}</tbody>
  </table>

  <h2>Traceability matrix</h2>
  <table>
    <thead>
      <tr>
        <th>Requirement ID</th>
        <th>Requirement title</th>
        <th>Status</th>
        <th>Verification method</th>
        <th>Linked work items</th>
        <th>Linked tests</th>
        <th>Test status</th>
        <th>Findings</th>
      </tr>
    </thead>
    <tbody>${matrixRows(data)}</tbody>
  </table>

  <h2>Findings by severity</h2>
  <h3>High</h3>
  <table>
    <thead><tr><th>Severity</th><th>Category</th><th>Title</th><th>Description</th><th>Recommendation</th></tr></thead>
    <tbody>${findingRows(findingsBySeverity.high)}</tbody>
  </table>
  <h3>Medium</h3>
  <table>
    <thead><tr><th>Severity</th><th>Category</th><th>Title</th><th>Description</th><th>Recommendation</th></tr></thead>
    <tbody>${findingRows(findingsBySeverity.medium)}</tbody>
  </table>
  <h3>Low</h3>
  <table>
    <thead><tr><th>Severity</th><th>Category</th><th>Title</th><th>Description</th><th>Recommendation</th></tr></thead>
    <tbody>${findingRows(findingsBySeverity.low)}</tbody>
  </table>

  <h2>Requirements with no linked work</h2>
  <table>
    <thead><tr><th>Requirement ID</th><th>Title</th><th>Status</th><th>Findings</th></tr></thead>
    <tbody>${requirementRows(requirementsWithoutWork, data, "All requirements have linked work items.")}</tbody>
  </table>

  <h2>Requirements with no linked test</h2>
  <table>
    <thead><tr><th>Requirement ID</th><th>Title</th><th>Status</th><th>Findings</th></tr></thead>
    <tbody>${requirementRows(requirementsWithoutTests, data, "All requirements have linked tests.")}</tbody>
  </table>

  <h2>Closed work with no passing test</h2>
  <table>
    <thead><tr><th>Work item</th><th>Title</th><th>Status</th><th>Reason</th></tr></thead>
    <tbody>${closedWorkWithoutPassingRows(data)}</tbody>
  </table>

  <h2>Weak requirement language</h2>
  <table>
    <thead><tr><th>Requirement ID</th><th>Title</th><th>Finding</th><th>Recommendation</th></tr></thead>
    <tbody>${weakLanguageRows(data)}</tbody>
  </table>

  <h2>Duplicate candidates</h2>
  <table>
    <thead><tr><th>Candidate pair</th><th>Detail</th><th>Recommendation</th></tr></thead>
    <tbody>${duplicateCandidateRows(data)}</tbody>
  </table>

  <h2>Failed tests by requirement</h2>
  <table>
    <thead><tr><th>Requirement ID</th><th>Title</th><th>Failed test</th><th>Failure message</th></tr></thead>
    <tbody>${failedTestsByRequirementRows(data)}</tbody>
  </table>

  <h2 class="page-break">Appendix: raw IDs</h2>
  <table>
    <thead><tr><th>Type</th><th>External ID</th><th>Name or title</th></tr></thead>
    <tbody>${appendixRows(data)}</tbody>
  </table>
</body>
</html>`;
}
