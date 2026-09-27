import Link from "next/link";
import type { ProjectSummary } from "@doorframe/core";
import type { DashboardStats } from "@/lib/view-models";
import { panelClass } from "@/lib/ui";

type GapMetric = {
  label: string;
  value: number;
  href: string;
  tone: "warning" | "error";
};

const tones = {
  warning: { bar: "border-l-[var(--warning)]", num: "text-[var(--warning)]" },
  error: { bar: "border-l-[var(--danger)]", num: "text-[var(--danger)]" }
} as const;

const heroLinkClass =
  "group block p-5 transition-colors hover:bg-[var(--panel-strong)] focus-visible:outline-offset-[-2px]";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function MetricGrid({
  projectId,
  summary,
  stats
}: {
  projectId: string;
  summary: ProjectSummary;
  stats: DashboardStats;
}) {
  const base = `/projects/${projectId}`;
  const { error, warning, info } = stats.findingsBySeverity;
  const findingTone = error > 0 ? "text-[var(--danger)]" : warning > 0 ? "text-[var(--warning)]" : "";
  const gaps: GapMetric[] = [
    {
      label: "Requirements without linked work",
      value: summary.requirementsWithoutWork,
      href: `${base}/requirements?view=without-work`,
      tone: "warning"
    },
    {
      label: "Requirements without a passing test",
      value: stats.requirementsWithoutPassingTests,
      href: `${base}/requirements?view=without-passing-tests`,
      tone: "error"
    },
    {
      label: "Requirements with failed or errored tests",
      value: summary.failedTestsLinkedToRequirements,
      href: `${base}/requirements?view=failed-tests`,
      tone: "error"
    },
    {
      label: "Weak wording findings",
      value: summary.weakRequirements,
      href: `${base}/findings?category=weak_wording`,
      tone: "warning"
    }
  ];

  return (
    <section aria-label="Project metrics" className="grid gap-4">
      <div className={`grid grid-cols-3 divide-x divide-[var(--line)] ${panelClass}`}>
        <Link href={`${base}/requirements`} className={heroLinkClass}>
          <div className="text-5xl font-semibold leading-none tabular-nums">{summary.totalRequirements}</div>
          <div className="mt-3 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Requirements</div>
          <div className="mt-1 text-sm text-[var(--muted)]">Imported and analyzed</div>
        </Link>
        <Link href={`${base}/matrix`} className={heroLinkClass}>
          <div className="text-5xl font-semibold leading-none tabular-nums">{stats.fullyTracedPercent}%</div>
          <div className="mt-3 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Fully traced</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {summary.linkedRequirements} of {summary.totalRequirements} linked to work and tests
          </div>
        </Link>
        <Link href={`${base}/findings`} className={heroLinkClass}>
          <div className={`text-5xl font-semibold leading-none tabular-nums ${findingTone}`}>
            {summary.totalFindings}
          </div>
          <div className="mt-3 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Findings</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {plural(error, "error")} · {plural(warning, "warning")} · {info} info
          </div>
        </Link>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">Gaps to review</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {gaps.map((gap) => {
            const flagged = gap.value > 0;
            return (
              <Link
                key={gap.label}
                href={gap.href}
                className={`group ${panelClass} border-l-4 p-4 transition-colors hover:bg-[var(--panel-strong)] ${
                  flagged ? tones[gap.tone].bar : "border-l-[var(--line)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`text-3xl font-semibold tabular-nums ${flagged ? tones[gap.tone].num : ""}`}>{gap.value}</div>
                  <span
                    aria-hidden="true"
                    className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]"
                  >
                    →
                  </span>
                </div>
                <div className="mt-2 text-sm text-[var(--muted)]">{gap.label}</div>
              </Link>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Inventory: {plural(summary.totalWorkItems, "work item")} · {plural(summary.totalTests, "test")} ·{" "}
        <Link href={`${base}/trace-graph`} className="text-[var(--accent-strong)] hover:underline">
          {plural(summary.totalTraceLinks, "trace link")}
        </Link>
      </p>
    </section>
  );
}
