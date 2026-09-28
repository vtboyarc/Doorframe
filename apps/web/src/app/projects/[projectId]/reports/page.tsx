import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PrintReportButton, ReportPreview } from "@/components/ReportPreview";
import { getProject, getProjectCounts } from "@/lib/db";
import { projectPageMetadata } from "@/lib/metadata";
import { panelClass, primaryButtonClass, secondaryButtonClass, textLinkClass } from "@/lib/ui";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Reports");
}

const PREVIEW_ID = "report-preview";

const downloads = [
  { format: "html", label: "HTML", detail: "Offline, print-friendly report" },
  { format: "md", label: "Markdown", detail: "For wikis, tickets, or notes" },
  { format: "csv", label: "CSV matrix", detail: "One row per requirement" },
  { format: "json", label: "JSON", detail: "Full data; input for doorframe diff" }
];

export default async function ReportsPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getProject(projectId);

  if (!project) {
    notFound();
  }

  const base = `/projects/${projectId}`;
  const reportUrl = `/api/projects/${projectId}/report`;
  const counts = getProjectCounts(projectId);
  const isEmpty = counts.requirements + counts.workItems + counts.testCases === 0;

  return (
    <PageShell project={project}>
      <PageHeader
        title="Reports"
        description="The traceability gap report summarizes coverage, findings, missing verification, missing work, failed tests, and weak wording for a review. It is generated locally and contains only this project's data."
        actions={
          isEmpty ? null : (
            <>
              <PrintReportButton frameId={PREVIEW_ID} />
              <a href={reportUrl} target="_blank" rel="noopener" className={primaryButtonClass}>
                <ExternalLink size={16} aria-hidden="true" />
                Open in new tab
              </a>
            </>
          )
        }
      />

      {isEmpty ? (
        <section className={`${panelClass} p-6`}>
          <h2 className="text-lg font-semibold">No data to report yet</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Import a requirements export and its Jira work items and JUnit results, then come back for the traceability
            report. To see an example first, load the fictional demo data from the dashboard.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`${base}/imports`} className={primaryButtonClass}>
              Import data
            </Link>
            <Link href={base} className={secondaryButtonClass}>
              Go to dashboard
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className={`${panelClass} mb-4 p-4 print:hidden`} aria-labelledby="downloads-heading">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <h2 id="downloads-heading" className="shrink-0 text-base font-semibold">
                Download
              </h2>
              <ul className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {downloads.map((item) => (
                  <li key={item.format}>
                    <a
                      href={`${reportUrl}?format=${item.format}&download=1`}
                      className="group flex h-full items-start gap-2 border border-[var(--line)] px-3 py-2 text-sm transition-colors hover:border-[var(--accent-strong)] hover:bg-[var(--panel-strong)]"
                    >
                      <Download
                        size={16}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-[var(--muted)] group-hover:text-[var(--accent-strong)]"
                      />
                      <span>
                        <span className="block font-medium group-hover:text-[var(--accent-strong)]">{item.label}</span>
                        <span className="block text-xs text-[var(--muted)]">{item.detail}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Showing what changed since the last review?{" "}
              <Link href={`${base}/baselines`} className={textLinkClass}>
                Compare baselines
              </Link>{" "}
              and download the baseline diff report from there.
            </p>
          </section>

          <ReportPreview frameId={PREVIEW_ID} src={`${reportUrl}?preview=1`} />
        </>
      )}
    </PageShell>
  );
}
