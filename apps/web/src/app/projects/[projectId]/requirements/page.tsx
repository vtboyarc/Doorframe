import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { RequirementsTable } from "@/components/RequirementsTable";
import { getProjectData } from "@/lib/db";
import { requirementRows } from "@/lib/view-models";

export default async function RequirementsPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  return (
    <PageShell project={data.project}>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Requirements</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Sort and filter imported requirements, then open a requirement to review linked work, tests, findings, and raw attributes.
        </p>
      </div>
      <RequirementsTable projectId={projectId} rows={requirementRows(data)} />
    </PageShell>
  );
}
