import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProjectData } from "@/lib/db";
import { humanize, severityBadgeClass } from "@/lib/severity";
import { findingsByPriority } from "@/lib/view-models";
import { panelClass } from "@/lib/ui";

const activeFilterClass = "border-[var(--accent-strong)] bg-[var(--accent)] text-white";
const inactiveFilterClass = "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent)]";

const categories = [
  "missing_verification",
  "missing_work_trace",
  "weak_wording",
  "duplicate_candidate",
  "stale_link",
  "closed_work_without_verification",
  "multi_requirement",
  "non_verifiable"
];

export default async function FindingsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { projectId } = await params;
  const { category } = await searchParams;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const findings = findingsByPriority(
    category
      ? data.findings.filter((finding) => finding.category === category)
      : data.findings
  );

  return (
    <PageShell project={data.project}>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Findings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Review analyzer output grouped by category and severity.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/projects/${projectId}/findings`}
          aria-current={!category ? "page" : undefined}
          className={`border px-3 py-2 text-sm ${!category ? activeFilterClass : inactiveFilterClass}`}
        >
          All
        </Link>
        {categories.map((item) => (
          <Link
            key={item}
            href={`/projects/${projectId}/findings?category=${item}`}
            aria-current={category === item ? "page" : undefined}
            className={`border px-3 py-2 text-sm ${category === item ? activeFilterClass : inactiveFilterClass}`}
          >
            {humanize(item)}
          </Link>
        ))}
      </div>

      <div className="grid gap-3">
        {findings.map((finding) => (
          <article key={finding.id} className={panelClass}>
            <Link
              href={`/projects/${projectId}/findings/${finding.id}`}
              className="group block p-4 hover:bg-[var(--background)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`border px-2 py-1 text-xs font-medium uppercase ${severityBadgeClass[finding.severity]}`}>
                    {finding.severity}
                  </span>
                  <span className="text-sm text-[var(--muted)]">{humanize(finding.category)}</span>
                </div>
                <span className="whitespace-nowrap text-sm text-[var(--accent-strong)]">
                  View details <span aria-hidden="true" className="inline-block transition group-hover:translate-x-0.5">→</span>
                </span>
              </div>
              <h2 className="mt-2 font-semibold group-hover:text-[var(--accent-strong)]">{finding.title}</h2>
              <p className="mt-1 text-sm">{finding.description}</p>
              {finding.recommendation ? (
                <p className="mt-2 text-sm text-[var(--accent-strong)]">{finding.recommendation}</p>
              ) : null}
            </Link>
          </article>
        ))}
        {findings.length === 0 ? (
          <div className={`${panelClass} p-4 text-sm text-[var(--muted)]`}>No findings match this filter.</div>
        ) : null}
      </div>
    </PageShell>
  );
}
