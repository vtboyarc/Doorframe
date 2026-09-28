import type {
  BaselineChangedRequirement,
  BaselineDiffField,
  BaselineDiffReport,
  BaselineFieldChange,
  BaselineWordDiffToken
} from "@doorframe/analyzers";
import type { FindingCategory, FindingSeverity } from "@doorframe/core";
import { categoryLabel, severityLabel } from "./labels";
import { escapeHtml } from "./shared";

export interface BaselineDiffFindingRef {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
}

export interface BaselineDiffTestStatusChange {
  externalId: string;
  before: string;
  after: string;
}

/**
 * Changes between two project snapshots beyond the requirement comparison: the same findings,
 * trace link, work item, and test changes the web app's Baselines page shows.
 */
export interface BaselineDiffRecordChanges {
  newFindings: BaselineDiffFindingRef[];
  resolvedFindings: BaselineDiffFindingRef[];
  /** Readable link descriptions such as "REQ-003 → FG-24 (implements)". */
  addedLinks: string[];
  removedLinks: string[];
  workItemsAdded: string[];
  workItemsRemoved: string[];
  testsAdded: string[];
  testsRemoved: string[];
  testStatusChanges: BaselineDiffTestStatusChange[];
}

export interface BaselineDiffHtmlOptions {
  /** Project name shown in the page title and header. */
  projectName?: string;
  /**
   * Findings, trace link, work item, and test changes. Omitted when only two requirement files
   * were compared (the CLI), in which case the report covers requirement changes only.
   */
  recordChanges?: BaselineDiffRecordChanges;
}

const FIELD_LABELS: Record<BaselineDiffField, string> = {
  title: "Title",
  text: "Text",
  status: "Status",
  type: "Type",
  priority: "Priority",
  verificationMethod: "Verification method",
  parentExternalId: "Parent"
};

function cell(value: string | number | undefined): string {
  return escapeHtml(String(value ?? ""));
}

function list(values: string[], empty = "Not provided"): string {
  if (values.length === 0) {
    return empty;
  }
  return values.map((value) => escapeHtml(value)).join("<br />");
}

function wordDiffHtml(tokens: BaselineWordDiffToken[] | undefined): string {
  if (!tokens || tokens.length === 0) {
    return "";
  }

  return tokens
    .map((token) => {
      if (token.type === "added") {
        return `<ins class="added-word">${escapeHtml(token.value)}</ins>`;
      }
      if (token.type === "removed") {
        return `<del class="removed-word">${escapeHtml(token.value)}</del>`;
      }
      return escapeHtml(token.value);
    })
    .join(" ");
}

function fieldChangeHtml(change: BaselineFieldChange): string {
  const value = change.wordDiff?.length
    ? wordDiffHtml(change.wordDiff)
    : `<del class="removed-word">${cell(change.before || "(empty)")}</del> → ${cell(change.after || "(empty)")}`;
  return `<strong>${cell(FIELD_LABELS[change.field] ?? change.field)}:</strong> ${value}`;
}

function concernClass(change: BaselineChangedRequirement): string {
  return change.concern === "high" ? "bad" : change.concern === "medium" ? "warn" : "ok";
}

function concernPill(change: BaselineChangedRequirement): string {
  const label = `${change.concern.charAt(0).toUpperCase()}${change.concern.slice(1)} concern`;
  return `<span class="pill ${concernClass(change)}">${cell(label)}</span>`;
}

function severityClass(severity: FindingSeverity): string {
  return severity === "error" ? "bad" : severity === "warning" ? "warn" : "info";
}

function metric(value: string | number, label: string): string {
  return `  <div class="metric"><strong>${cell(value)}</strong>${cell(label)}</div>`;
}

function emptyRow(columns: number, message: string): string {
  return `<tr><td colspan="${columns}">${cell(message)}</td></tr>`;
}

/** Summary tiles, using the Baselines page labels and order. */
function summaryMetrics(report: BaselineDiffReport, changes: BaselineDiffRecordChanges | undefined): string {
  const metrics = [
    metric(report.summary.added, "Requirements added"),
    metric(report.summary.deleted, "Requirements removed"),
    metric(report.summary.changed, "Requirements changed")
  ];
  if (changes) {
    metrics.push(
      metric(
        `${changes.testsAdded.length} / ${changes.testsRemoved.length} / ${changes.testStatusChanges.length}`,
        "Tests added / removed / status changed"
      ),
      metric(changes.newFindings.length, "New findings"),
      metric(changes.resolvedFindings.length, "Resolved findings"),
      metric(`${changes.workItemsAdded.length} / ${changes.workItemsRemoved.length}`, "Work items added / removed"),
      metric(`${changes.addedLinks.length} / ${changes.removedLinks.length}`, "Trace links added / removed")
    );
  }
  metrics.push(
    metric(report.summary.highConcern, "High-concern changes"),
    metric(report.summary.baselineARequirements, "Requirements before"),
    metric(report.summary.baselineBRequirements, "Requirements after")
  );
  return metrics.join("\n");
}

function totalChanges(report: BaselineDiffReport, changes: BaselineDiffRecordChanges): number {
  return (
    report.summary.added +
    report.summary.deleted +
    report.summary.changed +
    changes.newFindings.length +
    changes.resolvedFindings.length +
    changes.addedLinks.length +
    changes.removedLinks.length +
    changes.workItemsAdded.length +
    changes.workItemsRemoved.length +
    changes.testsAdded.length +
    changes.testsRemoved.length +
    changes.testStatusChanges.length
  );
}

function findingsSection(heading: string, findings: BaselineDiffFindingRef[]): string {
  const rows = findings
    .map(
      (finding) => `<tr>
<td><span class="pill ${severityClass(finding.severity)}">${cell(severityLabel(finding.severity))}</span></td>
<td>${cell(finding.title)}</td>
<td>${cell(categoryLabel(finding.category))}</td>
</tr>`
    )
    .join("\n");

  return `<h2>${cell(heading)}</h2>
<table>
<thead><tr><th>Severity</th><th>Finding</th><th>Category</th></tr></thead>
<tbody>
${rows || emptyRow(3, "None.")}
</tbody>
</table>`;
}

/** A two-column "Added / Removed" table, e.g. for trace links, work items, or tests. */
function addedRemovedSection(heading: string, itemHeading: string, added: string[], removed: string[]): string {
  const rows = [
    ...added.map((item) => `<tr><td>Added</td><td>${cell(item)}</td></tr>`),
    ...removed.map((item) => `<tr><td>Removed</td><td>${cell(item)}</td></tr>`)
  ].join("\n");

  return `<h2>${cell(`${heading} (${added.length} added, ${removed.length} removed)`)}</h2>
<table>
<thead><tr><th class="narrow">Change</th><th>${cell(itemHeading)}</th></tr></thead>
<tbody>
${rows || emptyRow(2, "None.")}
</tbody>
</table>`;
}

function testStatusSection(statusChanges: BaselineDiffTestStatusChange[]): string {
  const rows = statusChanges
    .map((change) => `<tr><td>${cell(change.externalId)}</td><td>${cell(change.before)}</td><td>${cell(change.after)}</td></tr>`)
    .join("\n");

  return `<h2>Test status changes</h2>
<table>
<thead><tr><th>Test</th><th>Before</th><th>After</th></tr></thead>
<tbody>
${rows || emptyRow(3, "None.")}
</tbody>
</table>`;
}

function recordChangeSections(changes: BaselineDiffRecordChanges | undefined): string {
  if (!changes) {
    return "";
  }

  return [
    findingsSection("New findings", changes.newFindings),
    findingsSection("Resolved findings", changes.resolvedFindings),
    testStatusSection(changes.testStatusChanges),
    addedRemovedSection("Work item changes", "Work item", changes.workItemsAdded, changes.workItemsRemoved),
    addedRemovedSection("Test changes", "Test", changes.testsAdded, changes.testsRemoved),
    addedRemovedSection("Trace link changes", "Trace link", changes.addedLinks, changes.removedLinks)
  ].join("\n\n");
}

export function generateBaselineDiffHtmlReport(report: BaselineDiffReport, options: BaselineDiffHtmlOptions = {}): string {
  const { projectName, recordChanges } = options;
  const title = projectName ? `Doorframe Baseline Diff – ${projectName}` : "Doorframe Baseline Diff";
  const noDifferences = recordChanges ? totalChanges(report, recordChanges) === 0 : false;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${cell(title)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; color: #172026; background: #fff; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; }
  main { max-width: 1120px; margin: 0 auto; padding: 32px 24px 56px; }
  h1, h2, h3 { color: #111827; margin: 0 0 12px; line-height: 1.2; }
  h1 { font-size: 28px; }
  h2 { margin-top: 32px; font-size: 20px; border-bottom: 1px solid #d7dce2; padding-bottom: 6px; }
  p { margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; page-break-inside: avoid; }
  th, td { border: 1px solid #d7dce2; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 13px; overflow-wrap: anywhere; }
  th { background: #f1f3f5; font-weight: 700; }
  th.narrow { width: 110px; }
  .meta { color: #4b5563; font-size: 13px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin: 16px 0 24px; }
  .metric { border: 1px solid #d7dce2; padding: 10px; }
  .metric strong { display: block; font-size: 22px; }
  .pill { display: inline-block; border: 1px solid #aeb7c2; padding: 2px 7px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
  .bad { color: #9f1239; border-color: #fecdd3; background: #fff1f2; }
  .warn { color: #92400e; border-color: #fed7aa; background: #fff7ed; }
  .ok { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
  .info { color: #1e3a8a; border-color: #bfdbfe; background: #eff6ff; }
  .added-word { background: #dcfce7; text-decoration: underline; }
  .removed-word { background: #fee2e2; text-decoration: line-through; }
  footer { margin-top: 36px; color: #4b5563; font-size: 12px; border-top: 1px solid #d7dce2; padding-top: 12px; }
  @media print {
    main { max-width: none; padding: 16mm; }
    body { background: #fff; }
    a { color: #000; text-decoration: none; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  }
</style>
</head>
<body>
<main>
<h1>Doorframe Baseline Diff</h1>
${projectName ? `<p class="meta">Project: ${cell(projectName)}</p>\n` : ""}<p class="meta">Changes from ${cell(report.baselineAName)} to ${cell(report.baselineBName)}</p>
<p class="meta">Generated ${cell(report.generatedAt)} from local imported data.</p>

<h2>Summary</h2>
<div class="summary">
${summaryMetrics(report, recordChanges)}
</div>
${noDifferences ? `<p>No differences between these snapshots.</p>\n` : ""}
<h2>High-concern changes</h2>
<table>
<thead><tr><th>Requirement</th><th>Concern</th><th>Reasons</th><th>Affected work</th><th>Affected tests</th><th>Recommendations</th></tr></thead>
<tbody>
${report.changed
    .filter((change) => change.concern === "high")
    .map(
      (change) => `<tr>
<td>${cell(change.externalId)}<br />${cell(change.title)}</td>
<td>${concernPill(change)}</td>
<td>${list(change.concernReasons)}</td>
<td>${list(change.affectedWorkItems)}</td>
<td>${list(change.affectedTests)}</td>
<td>${list(change.recommendations)}</td>
</tr>`
    )
    .join("\n") || emptyRow(6, "No high-concern changes detected.")}
</tbody>
</table>

<h2>Changed requirements</h2>
<table>
<thead><tr><th>Requirement</th><th>Concern</th><th>Changes</th><th>Re-check</th><th>Recommendations</th></tr></thead>
<tbody>
${report.changed
    .map(
      (change) => `<tr>
<td>${cell(change.externalId)}<br />${cell(change.title)}</td>
<td>${concernPill(change)}</td>
<td>${change.changes.map(fieldChangeHtml).join("<br />")}</td>
<td>${list([...change.affectedWorkItems, ...change.affectedTests], "None")}</td>
<td>${list(change.recommendations, "None")}</td>
</tr>`
    )
    .join("\n") || emptyRow(5, "No changed requirements.")}
</tbody>
</table>

<h2>Added requirements</h2>
<table>
<thead><tr><th>Requirement</th><th>Title</th><th>Status</th><th>Verification</th></tr></thead>
<tbody>
${report.added
    .map(
      (requirement) => `<tr><td>${cell(requirement.externalId)}</td><td>${cell(requirement.title)}</td><td>${cell(
        requirement.status
      )}</td><td>${cell(requirement.verificationMethod)}</td></tr>`
    )
    .join("\n") || emptyRow(4, "No added requirements.")}
</tbody>
</table>

<h2>Removed requirements</h2>
<table>
<thead><tr><th>Requirement</th><th>Title</th><th>Status</th><th>Verification</th></tr></thead>
<tbody>
${report.deleted
    .map(
      (requirement) => `<tr><td>${cell(requirement.externalId)}</td><td>${cell(requirement.title)}</td><td>${cell(
        requirement.status
      )}</td><td>${cell(requirement.verificationMethod)}</td></tr>`
    )
    .join("\n") || emptyRow(4, "No removed requirements.")}
</tbody>
</table>

${recordChangeSections(recordChanges)}

<h2>Review recommendations</h2>
<ul>
  <li>Review changed requirements before accepting the newer baseline.</li>
  <li>Confirm timing, threshold, authentication, audit, alert, and operator-facing changes with the responsible reviewers.</li>
  <li>Update linked work items and test evidence when requirement text or verification method changes.</li>
  <li>Treat concern levels as review prompts, not as official safety, security, or compliance classifications.</li>
</ul>

<footer>Doorframe baseline diff · Generated locally · Offline report · No external assets.</footer>
</main>
</body>
</html>`;
}
