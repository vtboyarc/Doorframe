import { type Finding, type ProjectData, type Requirement, type TestCase, type WorkItem } from "@doorframe/core";
import { categoryLabel, severityLabel, sourceTypeLabel } from "./labels";
import { escapeHtml, matrixRows, summarizeReportFromRows, type MatrixRow } from "./shared";

function text(value: string | number | undefined): string {
  return escapeHtml(String(value ?? ""));
}

function list(values: string[]): string {
  if (values.length === 0) {
    return "None";
  }
  return values.map((value) => escapeHtml(value)).join("<br />");
}

function severityRank(finding: Finding): number {
  if (finding.severity === "error") {
    return 3;
  }
  if (finding.severity === "warning") {
    return 2;
  }
  return 1;
}

function severityCounts(findings: Finding[]): { errors: number; warnings: number; info: number } {
  return {
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    info: findings.filter((finding) => finding.severity === "info").length
  };
}

function testClass(status: TestCase["status"]): string {
  if (status === "passed") {
    return "ok";
  }
  if (status === "failed" || status === "errored") {
    return "bad";
  }
  return "warn";
}

/** Requirement external IDs linked to each work item, in trace-link order. */
function linkedRequirementIdsByWorkItem(data: ProjectData): Map<string, string[]> {
  const requirementsById = new Map(data.requirements.map((requirement) => [requirement.id, requirement]));
  const index = new Map<string, string[]>();
  data.traceLinks.forEach((link) => {
    const workIsSource = link.sourceType === "workItem" && link.targetType === "requirement";
    const workIsTarget = link.targetType === "workItem" && link.sourceType === "requirement";
    if (!workIsSource && !workIsTarget) {
      return;
    }

    const requirement = requirementsById.get(workIsSource ? link.targetId : link.sourceId);
    if (!requirement) {
      return;
    }

    const workItemId = workIsSource ? link.sourceId : link.targetId;
    const ids = index.get(workItemId);
    if (ids) {
      ids.push(requirement.externalId);
    } else {
      index.set(workItemId, [requirement.externalId]);
    }
  });
  return index;
}

/** First record for each id, matching what `Array.find` would return. */
function firstById<T extends { id: string }>(items: T[]): Map<string, T> {
  const byId = new Map<string, T>();
  items.forEach((item) => {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  });
  return byId;
}

function requirementRows(requirements: Requirement[]): string {
  return (
    requirements
      .map(
        (requirement) => `<tr>
<td>${text(requirement.externalId)}</td>
<td>${text(requirement.title)}</td>
<td>${text(requirement.status)}</td>
<td>${text(requirement.verificationMethod)}</td>
</tr>`
      )
      .join("\n") || `<tr><td colspan="4">None</td></tr>`
  );
}

function topRiskRows(data: ProjectData, matrix: MatrixRow[]): string {
  const rows = [
    {
      concern: "Requirements missing verification",
      count: matrix.filter(
        (row) => row.testCases.length === 0 || !row.testCases.some((testCase) => testCase.status === "passed")
      ).length
    },
    {
      concern: "Requirements missing linked work",
      count: matrix.filter((row) => row.workItems.length === 0).length
    },
    {
      concern: "Closed work without passing tests",
      count: data.findings.filter((finding) => finding.category === "closed_work_without_verification").length
    },
    {
      concern: "Failed or errored tests linked to requirements",
      count: matrix.filter((row) =>
        row.testCases.some((testCase) => testCase.status === "failed" || testCase.status === "errored")
      ).length
    },
    {
      concern: "Weak requirement language",
      count: data.findings.filter((finding) => finding.category === "weak_wording").length
    }
  ].filter((row) => row.count > 0);

  return (
    rows
      .map((row) => `<tr><td>${text(row.concern)}</td><td>${row.count}</td></tr>`)
      .join("\n") || `<tr><td colspan="2">No top risk categories were triggered by the current findings.</td></tr>`
  );
}

export interface HtmlReportOptions {
  /** Doorframe version shown in the report header. Omitted when not provided. */
  version?: string;
}

export function generateHtmlTraceabilityReport(data: ProjectData, options: HtmlReportOptions = {}): string {
  const matrix = matrixRows(data);
  const summary = summarizeReportFromRows(data, matrix);
  const counts = severityCounts(data.findings);
  const generatedAt = new Date().toISOString();
  const topConcerns = [...data.findings]
    .sort((left, right) => severityRank(right) - severityRank(left))
    .slice(0, 3);
  const requirementsWithoutWork = matrix.filter((row) => row.workItems.length === 0).map((row) => row.requirement);
  const requirementsWithoutPassingVerification = matrix
    .filter((row) => row.testCases.length === 0 || !row.testCases.some((testCase) => testCase.status === "passed"))
    .map((row) => row.requirement);
  const workItemsById = firstById(data.workItems);
  const requirementsById = firstById(data.requirements);
  const requirementIdsByWorkItem = linkedRequirementIdsByWorkItem(data);
  const closedWorkWithoutPassingTests = data.findings
    .filter((finding) => finding.category === "closed_work_without_verification")
    .flatMap((finding) => {
      const workItem = workItemsById.get(finding.entityId);
      return workItem ? [{ workItem, finding }] : [];
    });
  const weakLanguageFindings = data.findings
    .filter((finding) => finding.category === "weak_wording")
    .flatMap((finding) => {
      const requirement = requirementsById.get(finding.entityId);
      return requirement ? [{ requirement, finding }] : [];
    });
  const failedTestsByRequirement = matrix.flatMap((row) =>
    row.testCases
      .filter((testCase) => testCase.status === "failed" || testCase.status === "skipped" || testCase.status === "errored")
      .map((testCase) => ({ requirement: row.requirement, testCase }))
  );
  const duplicateFindings = data.findings.filter((finding) => finding.category === "duplicate_candidate");
  const categories = Array.from(new Set(data.findings.map((finding) => finding.category))).sort();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Doorframe Traceability Report</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; color: #f4f5f7; background: #08090b; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
  main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 56px; }
  h1, h2, h3 { color: #f4f5f7; line-height: 1.2; margin: 0 0 12px; }
  h1 { font-size: 30px; }
  h2 { margin-top: 34px; padding-bottom: 8px; border-bottom: 1px solid #2a2d35; font-size: 20px; }
  p { margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0 24px; page-break-inside: avoid; }
  th, td { border: 0; border-bottom: 1px solid #2a2d35; padding: 12px 10px; text-align: left; vertical-align: top; font-size: 13px; }
  th { color: #a3a5ad; font-weight: 700; text-transform: uppercase; }
  ul { margin-top: 8px; }
  .meta { color: #a3a5ad; font-size: 13px; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); overflow: hidden; border: 1px solid #2a2d35; border-radius: 8px; margin: 18px 0 24px; }
  .metric { border-right: 1px solid #2a2d35; border-bottom: 1px solid #2a2d35; padding: 18px; color: #a3a5ad; text-transform: uppercase; }
  .metric strong { display: block; margin-bottom: 10px; font-size: 36px; line-height: 1; color: #f4f5f7; }
  .pill { display: inline-block; border-radius: 999px; border: 1px solid #565a66; padding: 3px 9px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .ok { color: #edf0f7; border-color: #565a66; background: rgba(237, 240, 247, 0.1); }
  .warn { color: #d6a760; border-color: rgba(214, 167, 96, 0.65); background: rgba(214, 167, 96, 0.14); }
  .bad { color: #8fa2ff; border-color: rgba(143, 162, 255, 0.65); background: rgba(143, 162, 255, 0.14); }
  .small { font-size: 12px; color: #a3a5ad; }
  footer { margin-top: 36px; color: #a3a5ad; font-size: 12px; border-top: 1px solid #2a2d35; padding-top: 12px; }
  @media print {
    main { max-width: none; padding: 16mm; }
    body { background: #fff; color: #172026; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    h1, h2, h3 { color: #111827; }
    h2 { border-bottom-color: #d7dce2; }
    th, td { border: 1px solid #d7dce2; color: #172026; padding: 8px 10px; }
    th { background: #f1f3f5; color: #111827; }
    .meta, .small, footer { color: #4b5563; }
    .summary-grid { border-color: #d7dce2; }
    .metric { border-color: #d7dce2; color: #4b5563; }
    .metric strong { color: #111827; }
    .pill { border-color: #c3c8d0; }
    .ok { color: #1f7a3d; border-color: rgba(31, 122, 61, 0.55); background: rgba(31, 122, 61, 0.12); }
    .warn { color: #92400e; border-color: rgba(146, 64, 14, 0.55); background: rgba(146, 64, 14, 0.1); }
    .bad { color: #9f1239; border-color: rgba(159, 18, 57, 0.55); background: rgba(159, 18, 57, 0.1); }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  }
</style>
</head>
<body>
<main>
<h1>Doorframe Traceability Report</h1>
<p class="meta">Project: ${text(data.project.name)}</p>
<p class="meta">Generated: ${text(generatedAt)}${options.version ? ` · Doorframe version: ${text(options.version)}` : ""}</p>
<p class="meta">Generated from local imported data. The report contains only data available in this Doorframe project.</p>

<h2>Executive Summary</h2>
<div class="summary-grid">
  <div class="metric"><strong>${data.requirements.length}</strong>Requirements</div>
  <div class="metric"><strong>${data.workItems.length}</strong>Work items</div>
  <div class="metric"><strong>${data.testCases.length}</strong>Tests</div>
  <div class="metric"><strong>${data.traceLinks.length}</strong>Trace links</div>
  <div class="metric"><strong>${data.findings.length}</strong>Total findings</div>
  <div class="metric"><strong>${counts.errors}</strong>Errors</div>
  <div class="metric"><strong>${counts.warnings}</strong>Warnings</div>
  <div class="metric"><strong>${counts.info}</strong>Info</div>
</div>
<table>
<thead><tr><th>Top concern</th><th>Severity</th><th>Category</th><th>Recommendation</th></tr></thead>
<tbody>
${topConcerns
    .map(
      (finding) => `<tr>
<td>${text(finding.title)}<br /><span class="small">${text(finding.description)}</span></td>
<td>${text(severityLabel(finding.severity))}</td>
<td>${text(categoryLabel(finding.category))}</td>
<td>${text(finding.recommendation)}</td>
</tr>`
    )
    .join("\n") || `<tr><td colspan="4">No findings generated.</td></tr>`}
</tbody>
</table>

<h2>Import Summary</h2>
<table>
<thead><tr><th>Imported file</th><th>Source type</th><th>Records</th><th>Errors or warnings</th></tr></thead>
<tbody>
${data.importBatches
    .map(
      (batch) => `<tr>
<td>${text(batch.filename)}</td>
<td>${text(sourceTypeLabel(batch.sourceType))}</td>
<td>${batch.recordCount}</td>
<td>${batch.errors.length > 0 ? list(batch.errors) : "None"}</td>
</tr>`
    )
    .join("\n") || `<tr><td colspan="4">No import batches recorded.</td></tr>`}
</tbody>
</table>

<h2>Top Risks Before Review</h2>
<table>
<thead><tr><th>Risk prompt</th><th>Count</th></tr></thead>
<tbody>${topRiskRows(data, matrix)}</tbody>
</table>

<h2>Traceability Matrix</h2>
<table>
<thead><tr><th>Requirement ID</th><th>Requirement title</th><th>Status</th><th>Verification method</th><th>Linked work items</th><th>Linked tests</th><th>Test status</th><th>Finding count</th></tr></thead>
<tbody>
${matrix
    .map(
      (row) => `<tr>
<td>${escapeHtml(row.requirement.externalId)}</td>
<td>${escapeHtml(row.requirement.title)}</td>
<td>${escapeHtml(row.requirement.status ?? "")}</td>
<td>${escapeHtml(row.requirement.verificationMethod ?? "")}</td>
<td>${row.workItems.map((item) => `${escapeHtml(item.externalId)}: ${escapeHtml(item.title)}`).join("<br />") || "None"}</td>
<td>${row.testCases
        .map((item) => `${escapeHtml(item.name)}`)
        .join("<br />") || "None"}</td>
<td>${row.testCases
        .map((item) => `<span class="pill ${testClass(item.status)}">${escapeHtml(item.status)}</span>`)
        .join("<br />") || "None"}</td>
<td>${row.findings.length}</td>
</tr>`
    )
    .join("\n")}
</tbody>
</table>

<h2>Requirements Missing Work</h2>
<table>
<thead><tr><th>Requirement ID</th><th>Title</th><th>Status</th><th>Verification method</th></tr></thead>
<tbody>${requirementRows(requirementsWithoutWork)}</tbody>
</table>

<h2>Requirements Missing Verification</h2>
<table>
<thead><tr><th>Requirement ID</th><th>Title</th><th>Status</th><th>Verification method</th></tr></thead>
<tbody>${requirementRows(requirementsWithoutPassingVerification)}</tbody>
</table>

<h2>Closed Work Without Passing Tests</h2>
<table>
<thead><tr><th>Work item</th><th>Status</th><th>Affected requirements</th><th>Finding</th></tr></thead>
<tbody>
${closedWorkWithoutPassingTests
    .map(
      ({ workItem, finding }) => `<tr>
<td>${text(workItem.externalId)}<br />${text(workItem.title)}</td>
<td>${text(workItem.status)}</td>
<td>${list(requirementIdsByWorkItem.get(workItem.id) ?? [])}</td>
<td>${text(finding.description)}</td>
</tr>`
    )
    .join("\n") || `<tr><td colspan="4">None</td></tr>`}
</tbody>
</table>

<h2>Weak Requirement Language</h2>
<table>
<thead><tr><th>Requirement ID</th><th>Phrase flagged</th><th>Reason</th><th>Recommendation</th></tr></thead>
<tbody>
${weakLanguageFindings
    .map(({ requirement, finding }) => {
      const phrase = finding.description.match(/vague wording: ([^.]+)\./i)?.[1] ?? "See finding";
      return `<tr>
<td>${text(requirement.externalId)}</td>
<td>${text(phrase)}</td>
<td>${text(finding.description)}</td>
<td>${text(finding.recommendation)}</td>
</tr>`;
    })
    .join("\n") || `<tr><td colspan="4">None</td></tr>`}
</tbody>
</table>

<h2>Failed Tests by Requirement</h2>
<table>
<thead><tr><th>Requirement ID</th><th>Test</th><th>Status</th><th>Failure message</th></tr></thead>
<tbody>
${failedTestsByRequirement
    .map(
      ({ requirement, testCase }) => `<tr>
<td>${text(requirement.externalId)}</td>
<td>${text(testCase.name)}</td>
<td><span class="pill ${testClass(testCase.status)}">${text(testCase.status)}</span></td>
<td>${text(testCase.failureMessage)}</td>
</tr>`
    )
    .join("\n") || `<tr><td colspan="4">None</td></tr>`}
</tbody>
</table>

<h2>Duplicate Requirement Candidates</h2>
<table>
<thead><tr><th>Candidate</th><th>Reason</th><th>Recommendation</th></tr></thead>
<tbody>
${duplicateFindings
    .map(
      (finding) => `<tr>
<td>${text(finding.title)}</td>
<td>${text(finding.description)}</td>
<td>${text(finding.recommendation)}</td>
</tr>`
    )
    .join("\n") || `<tr><td colspan="3">None</td></tr>`}
</tbody>
</table>

<h2>Appendix</h2>
<table>
<thead><tr><th>Item</th><th>Values</th></tr></thead>
<tbody>
<tr><td>All requirement IDs</td><td>${list(data.requirements.map((requirement) => requirement.externalId))}</td></tr>
<tr><td>All work item IDs</td><td>${list(data.workItems.map((workItem) => workItem.externalId))}</td></tr>
<tr><td>All test IDs</td><td>${list(data.testCases.map((testCase) => testCase.externalId))}</td></tr>
<tr><td>Finding categories</td><td>${list(categories.map(categoryLabel))}</td></tr>
<tr><td>Rule definitions</td><td>Missing work trace, missing or non-passing verification, weak wording, multiple shall statements, non-verifiable wording, duplicate candidates, stale links, closed work without passing verification, and custom rules when configured.</td></tr>
</tbody>
</table>
<p class="small">Summary details: ${summary.requirementsWithoutWork} requirements without linked work, ${summary.requirementsWithoutTests} requirements without linked tests, ${summary.requirementsWithoutPassingTests} requirements without passing linked tests, ${summary.failingTests} failed or errored tests.</p>
<footer>Doorframe · Generated locally · Offline report · No external assets.</footer>
</main>
</body>
</html>`;
}
