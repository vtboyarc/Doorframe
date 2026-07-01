import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { RequirementsTable } from "@/components/RequirementsTable";
import { getProjectData } from "@/lib/db";
import { filterRequirementRows, requirementRows } from "@/lib/view-models";

const viewLabels: Record<string, string> = {
  "without-work": "Requirements without linked work",
  "without-tests": "Requirements without linked tests",
  "failed-tests": "Requirements with failed or errored tests"
};

export default async function RequirementsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { projectId } = await params;
  const { view } = await searchParams;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const rows = filterRequirementRows(requirementRows(data), view);
  const activeViewLabel = view ? viewLabels[view] : undefined;

  return (
    <PageShell project={data.project}>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Requirements</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Sort and filter imported requirements, then open a requirement to review linked work, tests, findings, and raw attributes.
        </p>
      </div>
      {activeViewLabel ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm">
          <div>
            Showing <span className="font-semibold">{rows.length}</span> matching item{rows.length === 1 ? "" : "s"}: {activeViewLabel}
          </div>
          <Link href={`/projects/${projectId}/requirements`} className="text-[var(--accent-strong)] hover:underline">
            Clear view
          </Link>
        </div>
      ) : null}
      <RequirementsTable projectId={projectId} rows={rows} />
    </PageShell>
  );
}
