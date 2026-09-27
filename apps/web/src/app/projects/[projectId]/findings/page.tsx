import Link from "next/link";
import { notFound } from "next/navigation";
import type { FindingCategory, FindingSeverity } from "@doorframe/core";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getFindings, getProject, getProjectCounts } from "@/lib/db";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  FINDINGS_PAGE_SIZE,
  findingsListView,
  isFindingCategory,
  isFindingSeverity
} from "@/lib/findings";
import { sentenceLabel } from "@/lib/labels";
import { projectPageMetadata } from "@/lib/metadata";
import { severityBadgeClass } from "@/lib/severity";
import {
  activeChipClass,
  chipClass,
  chipCountClass,
  inactiveChipClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textLinkClass
} from "@/lib/ui";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Findings");
}

type SearchValue = string | string[] | undefined;

function first(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const severityLabels: Record<FindingSeverity, string> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info"
};

export default async function FindingsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ category?: SearchValue; severity?: SearchValue; page?: SearchValue }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const project = getProject(projectId);

  if (!project) {
    notFound();
  }

  const rawCategory = first(query.category);
  const rawSeverity = first(query.severity);
  const category = isFindingCategory(rawCategory) ? rawCategory : undefined;
  const severity = isFindingSeverity(rawSeverity) ? rawSeverity : undefined;
  const findings = getFindings(projectId);
  const view = findingsListView(findings, { category, severity, page: Number(first(query.page)) || 1 });
  const counts = getProjectCounts(projectId);
  const hasData = counts.requirements + counts.workItems + counts.testCases > 0;
  const base = `/projects/${projectId}`;

  const listHref = (next: { category?: FindingCategory; severity?: FindingSeverity; page?: number }) => {
    const search = new URLSearchParams();
    if (next.category) search.set("category", next.category);
    if (next.severity) search.set("severity", next.severity);
    if (next.page && next.page > 1) search.set("page", String(next.page));
    const text = search.toString();
    return `${base}/findings${text ? `?${text}` : ""}`;
  };
  const currentListHref = listHref({ category, severity, page: view.page });
  const firstShown = view.total === 0 ? 0 : (view.page - 1) * FINDINGS_PAGE_SIZE + 1;
  const lastShown = Math.min(view.page * FINDINGS_PAGE_SIZE, view.total);
  const visibleCategories = FINDING_CATEGORIES.filter(
    (item) => view.categoryCounts[item] > 0 || item === category
  );

  return (
    <PageShell project={project}>
      <PageHeader
        title="Findings"
        description="Traceability gaps and wording issues from the latest analysis, errors first. Open a finding to see the affected records and the recommended next step."
      />

      {findings.length === 0 ? (
        <section className={`${panelClass} p-6`}>
          {hasData ? (
            <>
              <h2 className="text-lg font-semibold">No findings</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                The latest analysis found no gaps across {counts.requirements} requirement
                {counts.requirements === 1 ? "" : "s"} with the current ruleset.
              </p>
              <Link href={`${base}/settings`} className={`mt-4 ${secondaryButtonClass}`}>
                Review the ruleset
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">No data imported yet</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Import a requirements export and its work items and test results. Analysis runs automatically after each
                import.
              </p>
              <Link href={`${base}/imports`} className={`mt-4 ${primaryButtonClass}`}>
                Import data
              </Link>
            </>
          )}
        </section>
      ) : (
        <>
          <nav aria-labelledby="severity-filter-label" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span id="severity-filter-label" className="text-[var(--muted)]">
              Severity:
            </span>
            <Link
              href={listHref({ category })}
              aria-current={!severity ? "true" : undefined}
              className={`${chipClass} ${!severity ? activeChipClass : inactiveChipClass}`}
            >
              All
            </Link>
            {FINDING_SEVERITIES.map((item) => {
              const count = view.severityCounts[item];
              const active = severity === item;
              return (
                <Link
                  key={item}
                  href={listHref({ category, severity: active ? undefined : item })}
                  aria-current={active ? "true" : undefined}
                  className={`${chipClass} ${active ? activeChipClass : inactiveChipClass}`}
                >
                  {severityLabels[item]}
                  <span className={chipCountClass}>{count}</span>
                </Link>
              );
            })}
          </nav>

          <nav aria-label="Finding categories" className="mb-4 flex flex-wrap gap-2">
            <Link
              href={listHref({ severity })}
              aria-current={!category ? "true" : undefined}
              className={`${chipClass} ${!category ? activeChipClass : inactiveChipClass}`}
            >
              All categories
            </Link>
            {visibleCategories.map((item) => (
              <Link
                key={item}
                href={listHref({ category: item, severity })}
                aria-current={category === item ? "true" : undefined}
                className={`${chipClass} ${category === item ? activeChipClass : inactiveChipClass}`}
              >
                {sentenceLabel(item)}
                <span className={chipCountClass}>{view.categoryCounts[item]}</span>
              </Link>
            ))}
          </nav>

          {rawCategory && !category ? (
            <p className="mb-3 text-sm text-[var(--warning)]">Unknown category &ldquo;{rawCategory}&rdquo;. Showing all categories.</p>
          ) : null}

          <p className="mb-3 text-sm text-[var(--muted)]" aria-live="polite">
            {view.total === 0
              ? "No findings match these filters."
              : `Showing ${firstShown}–${lastShown} of ${view.total} finding${view.total === 1 ? "" : "s"}`}
            {view.total === 0 ? (
              <>
                {" "}
                <Link href={`${base}/findings`} className={textLinkClass}>
                  Show all findings
                </Link>
              </>
            ) : null}
          </p>

          <div className="grid gap-3">
            {view.items.map((finding) => (
              <article
                key={finding.id}
                className={`group relative ${panelClass} p-4 transition-colors hover:border-[var(--accent-strong)] hover:bg-[var(--panel-strong)]`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`border px-2 py-0.5 text-xs font-medium uppercase ${severityBadgeClass[finding.severity]}`}>
                    {finding.severity}
                  </span>
                  <span className="text-sm text-[var(--muted)]">{sentenceLabel(finding.category)}</span>
                </div>
                <h2 className="mt-2 font-semibold">
                  <Link
                    href={`${base}/findings/${finding.id}?back=${encodeURIComponent(currentListHref)}`}
                    className="after:absolute after:inset-0 group-hover:text-[var(--accent-strong)]"
                  >
                    {finding.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm">{finding.description}</p>
                {finding.recommendation ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--foreground)]">Next step:</span> {finding.recommendation}
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          {view.pageCount > 1 ? (
            <nav aria-label="Findings pages" className="mt-4 flex items-center justify-between gap-3 text-sm">
              {view.page > 1 ? (
                <Link href={listHref({ category, severity, page: view.page - 1 })} className={secondaryButtonClass}>
                  <span aria-hidden="true">←</span> Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-[var(--muted)]">
                Page {view.page} of {view.pageCount}
              </span>
              {view.page < view.pageCount ? (
                <Link href={listHref({ category, severity, page: view.page + 1 })} className={secondaryButtonClass}>
                  Next <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
