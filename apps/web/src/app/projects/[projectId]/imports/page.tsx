import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportHistory } from "@/components/ImportHistory";
import { ImportPanel } from "@/components/ImportPanel";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getProjectData } from "@/lib/db";
import { isImportSourceType, type ImportSourceType } from "@/lib/import-types";
import { projectPageMetadata } from "@/lib/metadata";
import { textLinkClass } from "@/lib/ui";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Imports");
}

export default async function ImportsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { type } = await searchParams;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  // The dashboard links here with ?type=... to preselect the import type.
  const initialType: ImportSourceType = isImportSourceType(type) ? type : "requirements-csv";
  const isEmptyProject = data.requirements.length + data.workItems.length + data.testCases.length === 0;

  return (
    <PageShell project={data.project}>
      <PageHeader
        title="Imports"
        description="Import local exports. Start with requirements, then Jira work items and JUnit results. Files are processed on this machine."
      />

      {isEmptyProject ? (
        <p className="-mt-2 mb-4 text-sm text-[var(--muted)]">
          Just exploring? Load the fictional Falcon Telemetry Gateway data from the{" "}
          <Link href={`/projects/${projectId}`} className={textLinkClass}>
            project dashboard
          </Link>
          .
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-6">
        <ImportPanel key={initialType} projectId={projectId} initialType={initialType} />
        <ImportHistory batches={data.importBatches} />
      </div>
    </PageShell>
  );
}
