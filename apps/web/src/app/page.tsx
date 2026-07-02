import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { ProjectCreateForm } from "@/components/ProjectCreateForm";
import { StartDemoButton } from "@/components/StartDemoButton";
import { listProjects } from "@/lib/db";
import { panelClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const projects = listProjects();

  return (
    <PageShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h1 className="max-w-4xl text-3xl font-semibold">
            Doorframe turns requirements exports, Jira work items, and test results into a traceability gap report you can use before a review.
          </h1>
          <p className="mt-3 max-w-3xl text-[var(--muted)]">
            Open-source local-first requirements traceability and review tooling for regulated engineering teams.
          </p>
          <div className="mt-6 border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm">
            Doorframe runs locally by default and does not send imported project data to any external service. Do not use Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.
          </div>

          <section className={`mt-6 ${panelClass} p-5`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Start with the review artifact</h2>
                <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
                  Open the fictional Falcon Telemetry Gateway demo as a completed local report, then inspect the gaps behind it.
                </p>
              </div>
              <StartDemoButton />
            </div>
          </section>

          <h2 className="mt-8 text-xl font-semibold">Projects</h2>
          <div className="mt-3 grid gap-3">
            {projects.length > 0 ? (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={`${panelClass} p-4 hover:border-[var(--accent)]`}
                >
                  <div className="font-semibold">{project.name}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">Updated {new Date(project.updatedAt).toLocaleString()}</div>
                </Link>
              ))
            ) : (
              <div className={`${panelClass} p-4 text-sm text-[var(--muted)]`}>
                No local projects yet. Review the demo report or create an empty project to import your own exports.
              </div>
            )}
          </div>
        </section>
        <aside>
          <ProjectCreateForm />
        </aside>
      </div>
    </PageShell>
  );
}
