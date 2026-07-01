import type { FindingSeverity, TestStatus } from "@doorframe/core";

// Severity badge styling for findings. Full class strings are written out
// literally so Tailwind's scanner picks them up at build time.
export const severityBadgeClass: Record<FindingSeverity, string> = {
  error: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
  warning: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
  info: "border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]"
};

// Text color for a test result by status.
export const testStatusClass: Record<TestStatus, string> = {
  failed: "text-[var(--danger)]",
  errored: "text-[var(--danger)]",
  passed: "text-[var(--success)]",
  skipped: "text-[var(--muted)]"
};

// Node border/text color for the trace graph, by test status. Graph nodes
// keep react-flow's default white card background, so these stay dark for
// contrast instead of tracking the dark-theme CSS variables.
export function testStatusColor(status: string): string | null {
  if (status === "failed" || status === "errored") {
    return "#b42318";
  }

  if (status === "passed") {
    return "#1a7f37";
  }

  return null;
}

export function humanize(value: string): string {
  return value.replaceAll("_", " ");
}
