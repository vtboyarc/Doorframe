import type { BaselineChangedRequirement, BaselineDiffReport, BaselineWordDiffToken } from "@doorframe/analyzers";
import { escapeHtml } from "./shared";

function cell(value: string | number | undefined): string {
  return escapeHtml(String(value ?? ""));
}

function list(values: string[]): string {
  if (values.length === 0) {
    return "Not provided";
  }
  return values.map((value) => escapeHtml(value)).join("<br />");
}

function wordDiffHtml(tokens: BaselineWordDiffToken[] | undefined): string {
  if (!tokens || tokens.length === 0) {
    return "";
  }

  return tokens
    .map((token) => {
      const className = token.type === "added" ? "added-word" : token.type === "removed" ? "removed-word" : "";
      return className
        ? `<span class="${className}">${escapeHtml(token.value)}</span>`
        : escapeHtml(token.value);
    })
    .join(" ");
}

function concernClass(change: BaselineChangedRequirement): string {
  return change.concern === "high" ? "bad" : change.concern === "medium" ? "warn" : "ok";
}

export function generateBaselineDiffHtmlReport(report: BaselineDiffReport): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Doorframe Baseline Diff</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; color: #172026; background: #fff; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; }
  main { max-width: 1120px; margin: 0 auto; padding: 32px 24px 56px; }
  h1, h2, h3 { color: #111827; margin: 0 0 12px; line-height: 1.2; }
  h1 { font-size: 28px; }
  h2 { margin-top: 32px; font-size: 20px; border-bottom: 1px solid #d7dce2; padding-bottom: 6px; }
  p { margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; page-break-inside: avoid; }
  th, td { border: 1px solid #d7dce2; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 13px; }
  th { background: #f1f3f5; font-weight: 700; }
  .meta { color: #4b5563; font-size: 13px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin: 16px 0 24px; }
  .metric { border: 1px solid #d7dce2; padding: 10px; }
  .metric strong { display: block; font-size: 22px; }
  .pill { display: inline-block; border: 1px solid #aeb7c2; padding: 2px 7px; border-radius: 999px; font-size: 12px; font-weight: 700; }
  .bad { color: #9f1239; border-color: #fecdd3; background: #fff1f2; }
  .warn { color: #92400e; border-color: #fed7aa; background: #fff7ed; }
  .ok { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
  .added-word { background: #dcfce7; text-decoration: none; }
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
<p class="meta">Generated ${cell(report.generatedAt)} from local imported data.</p>
<p class="meta">Baseline A: ${cell(report.baselineAName)} · Baseline B: ${cell(report.baselineBName)}</p>

<h2>Summary</h2>
<div class="summary">
  <div class="metric"><strong>${report.summary.baselineARequirements}</strong>Baseline A requirements</div>
  <div class="metric"><strong>${report.summary.baselineBRequirements}</strong>Baseline B requirements</div>
  <div class="metric"><strong>${report.summary.added}</strong>Added</div>
  <div class="metric"><strong>${report.summary.deleted}</strong>Deleted</div>
  <div class="metric"><strong>${report.summary.changed}</strong>Changed</div>
  <div class="metric"><strong>${report.summary.highConcern}</strong>High concern changes</div>
</div>

<h2>High-Concern Changes</h2>
<table>
<thead><tr><th>Requirement</th><th>Concern</th><th>Reasons</th><th>Affected work</th><th>Affected tests</th><th>Recommendations</th></tr></thead>
<tbody>
${report.changed
    .filter((change) => change.concern === "high")
    .map(
      (change) => `<tr>
<td>${cell(change.externalId)}<br />${cell(change.title)}</td>
<td><span class="pill ${concernClass(change)}">${cell(change.concern)}</span></td>
<td>${list(change.concernReasons)}</td>
<td>${list(change.affectedWorkItems)}</td>
<td>${list(change.affectedTests)}</td>
<td>${list(change.recommendations)}</td>
</tr>`
    )
    .join("\n") || `<tr><td colspan="6">No high-concern changes detected.</td></tr>`}
</tbody>
</table>

<h2>Changed Requirements</h2>
<table>
<thead><tr><th>Requirement</th><th>Concern</th><th>Changed fields</th><th>Text diff</th></tr></thead>
<tbody>
${report.changed
    .map((change) => {
      const textChange = change.changes.find((field) => field.field === "text");
      return `<tr>
<td>${cell(change.externalId)}<br />${cell(change.title)}</td>
<td><span class="pill ${concernClass(change)}">${cell(change.concern)}</span></td>
<td>${change.changes.map((field) => cell(field.field)).join("<br />")}</td>
<td>${wordDiffHtml(textChange?.wordDiff) || "No text change"}</td>
</tr>`;
    })
    .join("\n") || `<tr><td colspan="4">No changed requirements.</td></tr>`}
</tbody>
</table>

<h2>Added Requirements</h2>
<table>
<thead><tr><th>Requirement</th><th>Title</th><th>Status</th><th>Verification</th></tr></thead>
<tbody>
${report.added
    .map(
      (requirement) => `<tr><td>${cell(requirement.externalId)}</td><td>${cell(requirement.title)}</td><td>${cell(
        requirement.status
      )}</td><td>${cell(requirement.verificationMethod)}</td></tr>`
    )
    .join("\n") || `<tr><td colspan="4">No added requirements.</td></tr>`}
</tbody>
</table>

<h2>Deleted Requirements</h2>
<table>
<thead><tr><th>Requirement</th><th>Title</th><th>Status</th><th>Verification</th></tr></thead>
<tbody>
${report.deleted
    .map(
      (requirement) => `<tr><td>${cell(requirement.externalId)}</td><td>${cell(requirement.title)}</td><td>${cell(
        requirement.status
      )}</td><td>${cell(requirement.verificationMethod)}</td></tr>`
    )
    .join("\n") || `<tr><td colspan="4">No deleted requirements.</td></tr>`}
</tbody>
</table>

<h2>Review Recommendations</h2>
<ul>
  <li>Review changed requirements before accepting the newer baseline.</li>
  <li>Confirm timing, threshold, authentication, audit, alert, and operator-facing changes with the responsible reviewers.</li>
  <li>Update linked work items and test evidence when requirement text or verification method changes.</li>
  <li>Treat concern levels as review prompts, not as official safety, security, or compliance classifications.</li>
</ul>

<footer>Doorframe baseline diff · Offline report · No external assets.</footer>
</main>
</body>
</html>`;
}
