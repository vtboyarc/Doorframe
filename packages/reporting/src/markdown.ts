import { type ProjectData } from "@doorframe/core";
import { matrixRows, summarizeReport } from "./shared";

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

/** Render a project's traceability data as a Markdown report. */
export function generateMarkdownTraceabilityReport(data: ProjectData): string {
  const matrix = matrixRows(data);
  const summary = summarizeReport(data);
  const lines: string[] = [];

  lines.push("# Doorframe Traceability Report");
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString()} · Local-first requirements traceability._`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("| --- | --- |");
  lines.push(`| Requirements | ${data.requirements.length} |`);
  lines.push(`| Work items | ${data.workItems.length} |`);
  lines.push(`| Tests | ${data.testCases.length} |`);
  lines.push(`| Trace links | ${data.traceLinks.length} |`);
  lines.push(`| Findings | ${data.findings.length} |`);
  lines.push(`| Requirements without work | ${summary.requirementsWithoutWork} |`);
  lines.push(`| Requirements without tests | ${summary.requirementsWithoutTests} |`);
  lines.push(`| Failing tests | ${summary.failingTests} |`);
  lines.push("");
  lines.push("## Traceability Matrix");
  lines.push("");
  lines.push("| Requirement | Title | Status | Work items | Tests | Findings |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  matrix.forEach((row) => {
    const work = row.workItems.map((item) => item.externalId).join(", ") || "—";
    const tests = row.testCases.map((item) => `${item.name} (${item.status})`).join(", ") || "—";
    const findings = row.findings.map((finding) => finding.title).join("; ") || "—";
    lines.push(
      `| ${cell(row.requirement.externalId)} | ${cell(row.requirement.title)} | ${cell(
        row.requirement.status ?? ""
      )} | ${cell(work)} | ${cell(tests)} | ${cell(findings)} |`
    );
  });
  lines.push("");

  if (data.findings.length > 0) {
    lines.push("## Findings");
    lines.push("");
    lines.push("| Severity | Category | Title | Recommendation |");
    lines.push("| --- | --- | --- | --- |");
    data.findings.forEach((finding) => {
      lines.push(
        `| ${finding.severity} | ${finding.category} | ${cell(finding.title)} | ${cell(
          finding.recommendation ?? ""
        )} |`
      );
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("Doorframe · Generated locally · No data leaves your machine.");
  lines.push("");

  return lines.join("\n");
}
