import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { DeleteProjectPanel, ProjectNameForm } from "@/components/ProjectSettingsPanel";
import { getProject, getRuleset } from "@/lib/db";
import { RulesetEditor } from "@/components/RulesetEditor";
import { projectPageMetadata } from "@/lib/metadata";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Settings");
}

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    notFound();
  }

  const ruleset = getRuleset(projectId);

  return (
    <PageShell project={project}>
      <PageHeader
        title="Settings"
        description="Rename the project, tune how Doorframe analyzes it, or delete it. Saving the ruleset re-runs analysis."
      />
      <div className="grid grid-cols-1 gap-6">
        <ProjectNameForm projectId={projectId} name={project.name} />
        <section aria-labelledby="ruleset-heading">
          <h2 id="ruleset-heading" className="mb-3 text-lg font-semibold">
            Analysis ruleset
          </h2>
          <RulesetEditor projectId={projectId} initial={ruleset} />
        </section>
        <DeleteProjectPanel projectId={projectId} name={project.name} />
      </div>
    </PageShell>
  );
}
