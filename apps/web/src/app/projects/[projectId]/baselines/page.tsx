import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProject } from "@/lib/db";
import { BaselinesPanel } from "@/components/BaselinesPanel";

export default async function BaselinesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    notFound();
  }

  return (
    <PageShell project={project}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Baselines &amp; Diff</h1>
      <p style={{ marginBottom: 16, color: "#5c6660" }}>
        Capture an immutable snapshot of the analyzed project, then compare two baselines (or a baseline against the
        current state) to see what changed.
      </p>
      <BaselinesPanel projectId={projectId} />
    </PageShell>
  );
}
