import { Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoadDemoButton } from "@/components/LoadDemoButton";
import { LocalTime } from "@/components/LocalTime";
import { MetricGrid } from "@/components/MetricGrid";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getProjectData } from "@/lib/db";
import { sentenceLabel, sourceTypeLabel } from "@/lib/labels";
import { projectPageMetadata } from "@/lib/metadata";
import { severityBadgeClass } from "@/lib/severity";
import { dashboardStats, findingsByPriority, projectSummary } from "@/lib/view-models";
import { panelClass, primaryButtonClass, secondaryButtonClass, textLinkClass } from "@/lib/ui";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params);
}

export default async function ProjectDashboardPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const summary = projectSummary(data);
  const stats = dashboardStats(data, summary);
  const base = `/projects/${projectId}`;
  const hasProjectData = summary.totalRequirements > 0 || summary.totalWorkItems > 0 || summary.totalTests > 0;
  const priorityFindings = findingsByPriority(data.findings).slice(0, 5);
  const setupSteps = [
    {
      done: summary.totalRequirements > 0,
      title: "Import requirements",
      text: "Requirements CSV, ReqIF, or ReqIFZ export.",
      href: `${base}/imports?type=requirements-csv`
    },
    {
      done: summary.totalWorkItems > 0,
      title: "Import work items",
      text: "Jira CSV export that mentions requirement IDs.",
      href: `${base}/imports?type=jira-csv`
    },
    {
      done: summary.totalTests > 0,
      title: "Import test results",
      text: "JUnit XML whose test names or properties mention requirement IDs.",
      href: `${base}/imports?type=junit-xml`
    }
  ];
  const setupComplete = setupSteps.every((step) => step.done);
  const nextStep = setupSteps.find((step) => !step.done);

  return (
    <PageShell project={data.project}>
      <PageHeader
        title={data.project.name}
        description={
          hasProjectData ? (
            <>
              Updated <LocalTime iso={data.project.updatedAt} /> · {data.importBatches.length} import
              {data.importBatches.length === 1 ? "" : "s"} · stored locally in SQLite
            </>
          ) : (
            "This project is empty. Import your exports to start the traceability review."
          )
        }
        actions={
          hasProjectData ? (
            <>
              <Link href={`${base}/imports`} className={secondaryButtonClass}>
                Import data
              </Link>
              <Link href={`${base}/reports`} className={primaryButtonClass}>
                Open report
              </Link>
            </>
          ) : null
        }
      />

      <div className="flex flex-col gap-6">
        {!setupComplete ? (
          <section className={`${panelClass} p-5`} aria-labelledby="get-started-heading">
            <h2 id="get-started-heading" className="text-lg font-semibold">
              {hasProjectData ? "Finish importing" : "Get started"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Import requirements first so later work-item and test imports can link to them by requirement ID.
            </p>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">
              {setupSteps.map((step, index) => (
                <li key={step.title}>
                  <Link
                    href={step.href}
                    className={`group flex h-full gap-3 border p-4 transition-colors hover:bg-[var(--panel-strong)] ${
                      step === nextStep ? "border-[var(--accent-strong)]" : "border-[var(--line)]"
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center border text-xs ${
                        step.done
                          ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                          : "border-[var(--accent-strong)] text-[var(--accent-strong)]"
                      }`}
                    >
                      {step.done ? <Check size={14} aria-label="Done" /> : index + 1}
                    </span>
                    <span>
                      <span className="block font-medium group-hover:text-[var(--accent-strong)]">{step.title}</span>
                      <span className="mt-1 block text-sm text-[var(--muted)]">{step.text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {!hasProjectData ? (
              <div className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--muted)]">
                  Just exploring? Fill this empty project with the fictional Falcon Telemetry Gateway data.
                </p>
                <LoadDemoButton projectId={projectId} />
              </div>
            ) : null}
          </section>
        ) : null}

        {hasProjectData ? <MetricGrid projectId={projectId} summary={summary} stats={stats} /> : null}

        {hasProjectData ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className={`${panelClass} min-w-0 p-4`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recent imports</h2>
              <Link href={`${base}/imports`} className={`shrink-0 whitespace-nowrap text-sm ${textLinkClass}`}>
                View imports <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {data.importBatches.slice(0, 5).map((batch) => (
                <div key={batch.id} className="py-3 text-sm">
                  <div className="break-words font-medium">{batch.filename}</div>
                  <div className="text-[var(--muted)]">
                    {sourceTypeLabel(batch.sourceType)} · {batch.recordCount} record{batch.recordCount === 1 ? "" : "s"} ·{" "}
                    <LocalTime iso={batch.importedAt} />
                    {batch.errors.length > 0 ? (
                      <span className="text-[var(--warning)]">
                        {" "}
                        · {batch.errors.length} warning{batch.errors.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
              {data.importBatches.length === 0 ? (
                <div className="py-3 text-sm text-[var(--muted)]">
                  No imports yet.{" "}
                  <Link href={`${base}/imports`} className={textLinkClass}>
                    Import a requirements export
                  </Link>{" "}
                  to begin.
                </div>
              ) : null}
            </div>
          </div>

          <div className={`${panelClass} min-w-0 p-4`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Highest priority findings</h2>
              {data.findings.length > 0 ? (
                <Link href={`${base}/findings`} className={`shrink-0 whitespace-nowrap text-sm ${textLinkClass}`}>
                  View all {data.findings.length} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {priorityFindings.map((finding) => (
                <Link
                  key={finding.id}
                  href={`${base}/findings/${finding.id}`}
                  className="group -mx-2 block px-2 py-3 text-sm hover:bg-[var(--panel-strong)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium group-hover:text-[var(--accent-strong)]">{finding.title}</div>
                    <span aria-hidden="true" className="text-[var(--muted)] group-hover:text-[var(--accent-strong)]">
                      →
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`border px-1.5 py-0.5 text-xs font-medium uppercase ${severityBadgeClass[finding.severity]}`}>
                      {finding.severity}
                    </span>
                    <span className="text-[var(--muted)]">{sentenceLabel(finding.category)}</span>
                  </div>
                </Link>
              ))}
              {data.findings.length === 0 ? (
                <div className="py-3 text-sm text-[var(--muted)]">
                  {hasProjectData
                    ? "No findings for the current data and ruleset."
                    : "No findings yet. Findings appear after the first import."}
                </div>
              ) : null}
            </div>
          </div>
        </section>
        ) : null}
      </div>
    </PageShell>
  );
}
