import type { FindingSeverity } from "@doorframe/core";

/** Report labels match the wording the Doorframe web app uses for the same values. */

const SOURCE_TYPE_LABELS: Record<string, string> = {
  "requirements-csv": "Requirements CSV",
  "jira-csv": "Jira CSV",
  "junit-xml": "JUnit XML",
  reqif: "ReqIF",
  reqifz: "ReqIFZ",
  demo: "Demo data",
  "jira-api": "Jira API",
  github: "GitHub",
  gitlab: "GitLab",
  jenkins: "Jenkins"
};

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info"
};

/** Readable name for an import source type, e.g. "junit-xml" -> "JUnit XML". Unknown types are shown as stored. */
export function sourceTypeLabel(sourceType: string): string {
  return SOURCE_TYPE_LABELS[sourceType] ?? sourceType;
}

/** Sentence-case label for a finding category, e.g. "missing_work_trace" -> "Missing work trace". */
export function categoryLabel(category: string): string {
  const words = category.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Readable finding severity, e.g. "error" -> "Error". */
export function severityLabel(severity: FindingSeverity): string {
  return SEVERITY_LABELS[severity] ?? severity;
}
