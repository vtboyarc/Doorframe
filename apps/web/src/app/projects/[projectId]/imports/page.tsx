import { notFound } from "next/navigation";
import { ImportPanel } from "@/components/ImportPanel";
import { PageShell } from "@/components/PageShell";
import { getProjectData } from "@/lib/db";

export default async function ImportsPage({
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
        <h1 className="text-2xl font-semibold">Imports</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload local CSV, JUnit XML, ReqIF, or ReqIFZ files. CSV imports require manual column mapping before saving.
        </p>
      </div>
      <ImportPanel projectId={projectId} />
    </PageShell>
  );
}
