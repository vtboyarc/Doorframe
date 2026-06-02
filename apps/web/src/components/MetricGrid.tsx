import type { ProjectSummary } from "@doorframe/core";

type Metric = {
  key: keyof ProjectSummary;
  label: string;
  // When set, a non-zero value is a gap and is highlighted in that tone.
  gap?: "warning" | "error";
};

const metrics: Metric[] = [
  { key: "totalRequirements", label: "Requirements" },
  { key: "totalWorkItems", label: "Work items" },
  { key: "totalTests", label: "Tests" },
  { key: "totalTraceLinks", label: "Trace links" },
  { key: "totalFindings", label: "Findings" },
  { key: "requirementsWithoutWork", label: "Requirements without work", gap: "warning" },
  { key: "requirementsWithoutTests", label: "Requirements without tests", gap: "warning" },
  { key: "weakRequirements", label: "Weak requirements", gap: "warning" },
  { key: "failedTestsLinkedToRequirements", label: "Failed tests linked to requirements", gap: "error" }
];

const tones = {
  warning: { bar: "border-l-4 border-l-[var(--warning)]", num: "text-[var(--warning)]" },
  error: { bar: "border-l-4 border-l-[var(--danger)]", num: "text-[var(--danger)]" }
} as const;

export function MetricGrid({ summary }: { summary: ProjectSummary }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map(({ key, label, gap }) => {
        const value = summary[key];
        const flagged = gap !== undefined && typeof value === "number" && value > 0;
        const tone = gap ? tones[gap] : null;

        return (
          <div
            key={key}
            className={`border border-[var(--line)] bg-white p-4 ${flagged && tone ? tone.bar : ""}`}
          >
            <div className={`text-3xl font-semibold ${flagged && tone ? tone.num : ""}`}>{value}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">{label}</div>
          </div>
        );
      })}
    </section>
  );
}
