import Link from "next/link";
import type { ProjectSummary } from "@doorframe/core";

type Metric = {
  key: keyof ProjectSummary;
  label: string;
  href: (projectId: string) => string;
  // When set, a non-zero value is a gap and is highlighted in that tone.
  gap?: "warning" | "error";
};

const metrics: Metric[] = [
  { key: "totalRequirements", label: "Requirements", href: (id) => `/projects/${id}/requirements` },
  { key: "totalWorkItems", label: "Work items", href: (id) => `/projects/${id}/matrix` },
  { key: "totalTests", label: "Tests", href: (id) => `/projects/${id}/matrix` },
  { key: "totalTraceLinks", label: "Trace links", href: (id) => `/projects/${id}/matrix` },
  { key: "totalFindings", label: "Findings", href: (id) => `/projects/${id}/findings` },
  {
    key: "requirementsWithoutWork",
    label: "Requirements without work",
    href: (id) => `/projects/${id}/requirements?view=without-work`,
    gap: "warning"
  },
  {
    key: "requirementsWithoutTests",
    label: "Requirements without tests",
    href: (id) => `/projects/${id}/requirements?view=without-tests`,
    gap: "warning"
  },
  {
    key: "weakRequirements",
    label: "Weak requirements",
    href: (id) => `/projects/${id}/findings?category=weak_wording`,
    gap: "warning"
  },
  {
    key: "failedTestsLinkedToRequirements",
    label: "Requirements with failed or errored tests",
    href: (id) => `/projects/${id}/requirements?view=failed-tests`,
    gap: "error"
  }
];

const tones = {
  warning: { bar: "border-l-4 border-l-[var(--warning)]", num: "text-[var(--warning)]" },
  error: { bar: "border-l-4 border-l-[var(--danger)]", num: "text-[var(--danger)]" }
} as const;

export function MetricGrid({
  projectId,
  summary
}: {
  projectId: string;
  summary: ProjectSummary;
}) {
  return (
    <section aria-label="Project metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map(({ key, label, href, gap }) => {
        const value = summary[key];
        const flagged = gap !== undefined && typeof value === "number" && value > 0;
        const tone = gap ? tones[gap] : null;

        return (
          <Link
            key={key}
            href={href(projectId)}
            aria-label={`${label}: ${value}. Open details.`}
            className={`group border border-[var(--line)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              flagged && tone ? tone.bar : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-3xl font-semibold ${flagged && tone ? tone.num : ""}`}>{value}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{label}</div>
              </div>
              <span aria-hidden="true" className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]">
                →
              </span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
