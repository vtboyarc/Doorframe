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
      <h1 className="text-2xl font-semibold">Project Settings &amp; Ruleset</h1>
      <p className="mt-1 mb-5 text-sm text-[var(--muted)]">
        Configure requirement ID patterns, analyzer thresholds, disabled finding categories, and custom rules.
        Saving re-runs analysis with the new ruleset.
      </p>
      <RulesetEditor projectId={projectId} initial={ruleset} />
    </PageShell>
  );
}
