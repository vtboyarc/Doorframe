import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { getProject, getProjectCounts } from "@/lib/db";
import { BaselinesPanel } from "@/components/BaselinesPanel";
import { projectPageMetadata } from "@/lib/metadata";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Baselines");
}

export default async function BaselinesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    notFound();
  }

  return (
    <PageShell project={project}>
      <PageHeader
        title="Baselines"
        description="Capture a snapshot of the analyzed project before a review, then compare snapshots to see which requirements, links, tests, and findings changed. Re-importing updates records with matching IDs; records dropped from a newer export stay until you remove them on the Imports page."
      />
      <BaselinesPanel projectId={projectId} hasData={getProjectCounts(projectId).requirements > 0} />
    </PageShell>
  );
}
