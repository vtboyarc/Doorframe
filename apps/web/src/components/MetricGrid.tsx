import type { ProjectSummary } from "@doorframe/core";

const metrics: Array<[keyof ProjectSummary, string]> = [
  ["totalRequirements", "Requirements"],
  ["totalWorkItems", "Work items"],
  ["totalTests", "Tests"],
  ["totalTraceLinks", "Trace links"],
  ["totalFindings", "Findings"],
  ["requirementsWithoutWork", "Requirements without work"],
  ["requirementsWithoutTests", "Requirements without tests"],
  ["weakRequirements", "Weak requirements"],
  ["failedTestsLinkedToRequirements", "Failed tests linked to requirements"]
];

export function MetricGrid({ summary }: { summary: ProjectSummary }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map(([key, label]) => (
        <div key={key} className="border border-[var(--line)] bg-white p-4">
          <div className="text-3xl font-semibold">{summary[key]}</div>
          <div className="mt-1 text-sm text-[var(--muted)]">{label}</div>
        </div>
      ))}
    </section>
  );
}
