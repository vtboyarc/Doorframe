import { type ProjectData } from "@doorframe/core";
import { matrixRows } from "./shared";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
    const failingTests = row.testCases.filter((test) => test.status === "failed").length;
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
