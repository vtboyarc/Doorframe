import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { PageShell } from "@/components/PageShell";
import { ProjectCreateForm } from "@/components/ProjectCreateForm";
import { RefreshOnMount } from "@/components/RefreshOnMount";
import { StartDemoButton } from "@/components/StartDemoButton";
import { listProjectsWithCounts } from "@/lib/db";
import { DEMO_PROJECT_NAME } from "@/lib/demo";
import { panelClass, primaryButtonClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

const steps = [
  { title: "Create a project", text: "One local project per program, release, or review." },
  { title: "Import exports", text: "Requirements CSV or ReqIF, Jira CSV work items, and JUnit XML results." },
  { title: "Review the gaps", text: "Work through findings, then export the HTML report for the review." }
];

function nextDemoName(existingNames: Set<string>): string {
  if (!existingNames.has(DEMO_PROJECT_NAME)) {
    return DEMO_PROJECT_NAME;
  }

  let copy = 2;
  while (existingNames.has(`${DEMO_PROJECT_NAME} (${copy})`)) {
    copy += 1;
  }
  return `${DEMO_PROJECT_NAME} (${copy})`;
}

export default function HomePage() {
  const projects = listProjectsWithCounts();
  const demoProject = projects.find((project) => project.name.startsWith(DEMO_PROJECT_NAME) && project.requirementCount > 0);
  const demoName = nextDemoName(new Set(projects.map((project) => project.name)));

  return (
    <PageShell>
      <RefreshOnMount />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Find traceability gaps before your next review.
          </h1>
          <p className="mt-3 max-w-3xl text-base text-[var(--muted)]">
            Doorframe turns requirements exports, Jira work items, and JUnit test results into a traceability gap report.
            It runs on this machine and works without AI.
          </p>

          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className={`${panelClass} p-4`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="grid h-6 w-6 shrink-0 place-items-center border border-[var(--accent-strong)] text-xs text-[var(--accent-strong)]">
                    {index + 1}
                  </span>
                  {step.title}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm">
            Doorframe runs locally by default and does not send imported project data to any external service. Do not use
            Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that
            use in your environment.
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <section className={`${panelClass} p-4`}>
            <h2 className="text-base font-semibold">Try the fictional demo</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Falcon Telemetry Gateway is sample data with deliberate gaps: missing trace links, failing tests, weak wording,
              and a changed baseline.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {demoProject ? (
                <>
                  <Link href={`/projects/${demoProject.id}/reports`} className={`w-full ${primaryButtonClass}`}>
                    Open demo report
                  </Link>
                  <StartDemoButton projectName={demoName} label="Start a fresh demo copy" variant="secondary" />
                </>
              ) : (
                <StartDemoButton projectName={demoName} />
              )}
            </div>
          </section>
          <ProjectCreateForm />
        </aside>
      </div>

      <section className="mt-8" aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="text-xl font-semibold">
          Projects
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {projects.length > 0 ? (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={`group ${panelClass} block min-w-0 p-4 transition-colors hover:border-[var(--accent-strong)] hover:bg-[var(--panel-strong)]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 break-words font-semibold group-hover:text-[var(--accent-strong)]">
                    {project.name}
                  </div>
                  <span aria-hidden="true" className="text-[var(--muted)] group-hover:text-[var(--accent-strong)]">
                    →
                  </span>
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {project.requirementCount} requirement{project.requirementCount === 1 ? "" : "s"} ·{" "}
                  {project.findingCount} finding{project.findingCount === 1 ? "" : "s"} · Updated{" "}
                  <LocalTime iso={project.updatedAt} />
                </div>
              </Link>
            ))
          ) : (
            <div className={`${panelClass} p-4 text-sm text-[var(--muted)] md:col-span-2`}>
              No local projects yet. Open the demo report to see what Doorframe produces, or create a project to import your
              own exports.
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
