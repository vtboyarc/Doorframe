import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { RequirementsTable } from "@/components/RequirementsTable";
import { getProjectData } from "@/lib/db";
import { projectPageMetadata } from "@/lib/metadata";
import {
  filterRequirementRows,
  isRequirementView,
  requirementRows,
  toListRow,
  type RequirementView
} from "@/lib/view-models";
import { activeChipClass, chipClass, chipCountClass, inactiveChipClass, panelClass, primaryButtonClass } from "@/lib/ui";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Requirements");
}

const views: Array<{ value?: RequirementView; label: string }> = [
  { label: "All" },
  { value: "without-work", label: "Without work" },
  { value: "without-tests", label: "Without tests" },
  { value: "without-passing-tests", label: "Without a passing test" },
  { value: "failed-tests", label: "Failed or errored tests" }
];

export default async function RequirementsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string; q?: string; sort?: string }>;
}) {
  const { projectId } = await params;
  const { view: rawView, q, sort } = await searchParams;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const view = isRequirementView(rawView) ? rawView : undefined;
  const allRows = requirementRows(data);
  const rows = filterRequirementRows(allRows, view).map(toListRow);
  const base = `/projects/${projectId}`;

  return (
    <PageShell project={data.project}>
      <PageHeader
        title="Requirements"
        description="Filter and sort imported requirements, then open one to review its linked work, tests, findings, and imported attributes."
      />

      {allRows.length === 0 ? (
        <section className={`${panelClass} p-6`}>
          <h2 className="text-lg font-semibold">No requirements imported yet</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Import a requirements CSV, ReqIF, or ReqIFZ export to start. Work items and test results can then link to these
            requirements by ID.
          </p>
          <Link href={`${base}/imports?type=requirements-csv`} className={`mt-4 ${primaryButtonClass}`}>
            Import requirements
          </Link>
        </section>
      ) : (
        <>
          <nav aria-label="Requirement views" className="mb-3 flex flex-wrap gap-2">
            {views.map((option) => {
              const active = option.value === view;
              const count = filterRequirementRows(allRows, option.value).length;
              return (
                <Link
                  key={option.label}
                  href={option.value ? `${base}/requirements?view=${option.value}` : `${base}/requirements`}
                  aria-current={active ? "true" : undefined}
                  className={`${chipClass} ${active ? activeChipClass : inactiveChipClass}`}
                >
                  {option.label}
                  <span className={chipCountClass}>{count}</span>
                </Link>
              );
            })}
          </nav>
          <RequirementsTable
            // Remount when the view changes so the table starts from the new rows.
            key={view ?? "all"}
            projectId={projectId}
            rows={rows}
            view={view}
            initialQuery={q ?? ""}
            initialSort={sort}
          />
        </>
      )}
    </PageShell>
  );
}
