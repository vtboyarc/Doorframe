import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProject, getRuleset } from "@/lib/db";
import { RulesetEditor } from "@/components/RulesetEditor";

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    notFound();
  }

  const ruleset = getRuleset(projectId);

  return (
    <PageShell project={project}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Project Settings &amp; Ruleset</h1>
      <p style={{ marginBottom: 16, color: "#5c6660" }}>
        Configure requirement ID patterns, analyzer thresholds, disabled finding categories, and custom rules.
        Saving re-runs analysis with the new ruleset.
      </p>
      <RulesetEditor projectId={projectId} initial={ruleset} />
    </PageShell>
  );
}
