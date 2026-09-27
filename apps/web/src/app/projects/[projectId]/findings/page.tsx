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
import { panelClass, primaryButtonClass, secondaryButtonClass, textLinkClass } from "@/lib/ui";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Findings");
}

type SearchValue = string | string[] | undefined;

function first(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const severityLabels: Record<FindingSeverity, [string, string]> = {
  error: ["error", "errors"],
  warning: ["warning", "warnings"],
  info: ["info", "info"]
};

const chipClass = "inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap border px-3 text-sm transition-colors";
const activeChipClass = "border-[var(--accent-strong)] bg-[var(--accent)] text-white";
const inactiveChipClass =
  "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent-strong)] hover:text-[var(--foreground)]";

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
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="text-[var(--muted)]">Severity:</span>
            <Link href={listHref({ category })} aria-current={!severity ? "page" : undefined} className={`${chipClass} ${!severity ? activeChipClass : inactiveChipClass}`}>
              All
            </Link>
            {FINDING_SEVERITIES.map((item) => {
              const count = view.severityCounts[item];
              const active = severity === item;
              return (
                <Link
                  key={item}
                  href={listHref({ category, severity: active ? undefined : item })}
                  aria-current={active ? "page" : undefined}
                  className={`${chipClass} ${active ? activeChipClass : inactiveChipClass}`}
                >
                  <span className="tabular-nums">{count}</span> {severityLabels[item][count === 1 ? 0 : 1]}
                </Link>
              );
            })}
          </div>

          <nav
            aria-label="Finding categories"
            className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:px-0"
          >
            <Link
              href={listHref({ severity })}
              aria-current={!category ? "page" : undefined}
              className={`${chipClass} ${!category ? activeChipClass : inactiveChipClass}`}
            >
              All categories
            </Link>
            {visibleCategories.map((item) => (
              <Link
                key={item}
                href={listHref({ category: item, severity })}
                aria-current={category === item ? "page" : undefined}
                className={`${chipClass} ${category === item ? activeChipClass : inactiveChipClass}`}
              >
                {sentenceLabel(item)}
                <span className="tabular-nums">{view.categoryCounts[item]}</span>
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
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-[var(--muted)]">
                Page {view.page} of {view.pageCount}
              </span>
              {view.page < view.pageCount ? (
                <Link href={listHref({ category, severity, page: view.page + 1 })} className={secondaryButtonClass}>
                  Next →
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
