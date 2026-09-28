import { type ProjectData } from "@doorframe/core";
import { matrixRows } from "./shared";

/**
 * Characters that make Excel, LibreOffice, and similar tools read a cell as a formula when it
 * starts with them. Imported titles, statuses, and test names come from other tools' exports,
 * so they are not trusted.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Format one CSV cell. A cell that would start a formula gets a leading apostrophe so spreadsheet
 * tools show it as text, and cells containing quotes, commas, or line breaks are quoted.
 */
export function csvCell(value: string): string {
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/** Render the traceability matrix as CSV (one row per requirement). */
export function generateTraceabilityMatrixCsv(data: ProjectData): string {
  const header = [
    "Requirement ID",
    "Title",
    "Status",
    "Verification Method",
    "Work Items",
    "Test Cases",
    "Failing Tests",
    "Finding Count"
  ];
  const lines = [header.map(csvCell).join(",")];

  matrixRows(data).forEach((row) => {
    const failingTests = row.testCases.filter((test) => test.status === "failed" || test.status === "errored").length;
    lines.push(
      [
        row.requirement.externalId,
        row.requirement.title,
        row.requirement.status ?? "",
        row.requirement.verificationMethod ?? "",
        row.workItems.map((item) => item.externalId).join("; "),
        row.testCases.map((item) => `${item.name} (${item.status})`).join("; "),
        String(failingTests),
        String(row.findings.length)
      ]
        .map(csvCell)
        .join(",")
    );
  });

  return lines.join("\n");
}
