import { type ProjectData } from "@doorframe/core";
import { escapeHtml, matrixRows, summarizeReport } from "./shared";

export function generateHtmlTraceabilityReport(data: ProjectData): string {
  const matrix = matrixRows(data);
  const summary = summarizeReport(data);
  const generatedAt = new Date().toISOString();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Doorframe Traceability Report</title>
<style>
  :root { color-scheme: light; }
  body { font-family: "Segoe UI", system-ui, sans-serif; margin: 2rem; color: #182026; background: #f7f8f4; }
  h1, h2 { color: #0e4e45; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; }
  th, td { border: 1px solid #d3d8cf; padding: 0.5rem; text-align: left; vertical-align: top; font-size: 0.9rem; }
  th { background: #e7ebe3; }
  .pill { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; }
  .ok { background: #d7f5e9; color: #0e4e45; }
  .warn { background: #fde9c8; color: #a15c07; }
  .bad { background: #fbd9d4; color: #b42318; }
  footer { margin-top: 3rem; font-size: 0.8rem; color: #5c6660; }
  @media print { body { margin: 0; background: #fff; } }
</style>
</head>
<body>
<h1>Doorframe Traceability Report</h1>
<p>Generated ${escapeHtml(generatedAt)} · Local-first requirements traceability.</p>
<h2>Summary</h2>
<table>
<thead><tr><th>Requirements</th><th>Work items</th><th>Tests</th><th>Trace links</th><th>Findings</th><th>Missing work</th><th>Missing tests</th><th>Failing tests</th></tr></thead>
<tbody>
<tr>
<td>${data.requirements.length}</td>
<td>${data.workItems.length}</td>
<td>${data.testCases.length}</td>
<td>${data.traceLinks.length}</td>
<td>${data.findings.length}</td>
<td>${summary.requirementsWithoutWork}</td>
<td>${summary.requirementsWithoutTests}</td>
<td>${summary.failingTests}</td>
</tr>
</tbody>
</table>
<h2>Traceability Matrix</h2>
<table>
<thead><tr><th>Requirement</th><th>Title</th><th>Status</th><th>Work items</th><th>Tests</th><th>Findings</th></tr></thead>
<tbody>
${matrix
    .map(
      (row) => `<tr>
<td>${escapeHtml(row.requirement.externalId)}</td>
<td>${escapeHtml(row.requirement.title)}</td>
<td>${escapeHtml(row.requirement.status ?? "")}</td>
<td>${row.workItems.map((item) => escapeHtml(item.externalId)).join("<br />") || "—"}</td>
<td>${row.testCases
        .map((item) => `${escapeHtml(item.name)} <span class="pill ${item.status === "passed" ? "ok" : item.status === "failed" ? "bad" : "warn"}">${item.status}</span>`)
        .join("<br />") || "—"}</td>
<td>${row.findings.map((finding) => escapeHtml(finding.title)).join("<br />") || "—"}</td>
</tr>`
    )
    .join("\n")}
</tbody>
</table>
<footer>Doorframe · Generated locally · No data leaves your machine.</footer>
</body>
</html>`;
}
