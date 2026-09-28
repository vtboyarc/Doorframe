const sourceTypeLabels: Record<string, string> = {
  "requirements-csv": "Requirements CSV",
  "jira-csv": "Jira CSV",
  "junit-xml": "JUnit XML",
  reqif: "ReqIF",
  reqifz: "ReqIFZ",
  demo: "Demo data"
};

/** Readable name for an import batch source type, e.g. "jira-csv" -> "Jira CSV". */
export function sourceTypeLabel(sourceType: string): string {
  return sourceTypeLabels[sourceType] ?? sourceType;
}

/** Sentence-case label for a snake_case value, e.g. "missing_work_trace" -> "Missing work trace". */
export function sentenceLabel(value: string): string {
  const words = value.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const auditActionLabels: Record<string, string> = {
  "project.created": "Project created",
  "project.renamed": "Project renamed",
  "import.completed": "Import",
  "analysis.rerun": "Analysis run",
  "baseline.created": "Baseline captured",
  "ruleset.updated": "Ruleset updated",
  "report.generated": "Report generated",
  "records.removed": "Records removed"
};

/** Readable name for an audit action, e.g. "report.generated" -> "Report generated". */
export function auditActionLabel(action: string): string {
  return auditActionLabels[action] ?? sentenceLabel(action.replaceAll(".", " "));
}
