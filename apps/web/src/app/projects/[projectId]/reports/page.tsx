import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getProjectData } from "@/lib/db";
import { projectPageMetadata } from "@/lib/metadata";
import { panelClass, primaryButtonClass, textLinkClass } from "@/lib/ui";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Reports");
}

const downloads = [
  { format: "html", label: "HTML report", detail: "Offline, print-friendly copy of the report shown here." },
  { format: "md", label: "Markdown", detail: "Summary and findings for wikis, tickets, or review notes." },
  { format: "csv", label: "CSV matrix", detail: "One row per requirement for spreadsheets." },
  { format: "json", label: "JSON", detail: "Full analyzed data. Also the input format for doorframe diff." }
];

export default async function ReportsPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const base = `/projects/${projectId}`;
  const reportUrl = `/api/projects/${projectId}/report`;
  const isEmpty = data.requirements.length === 0 && data.workItems.length === 0 && data.testCases.length === 0;

  return (
    <PageShell project={data.project}>
      <PageHeader
        title="Reports"
        description="The traceability gap report summarizes coverage, findings, missing verification, missing work, failed tests, and weak wording for a review. It is generated locally and contains only this project's data."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className={`${panelClass} h-fit p-5`}>
          <h2 className="text-lg font-semibold">Traceability report</h2>
          {isEmpty ? (
            <p className="mt-2 border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm">
              This project has no imported data yet, so the report will be empty.{" "}
              <Link href={`${base}/imports`} className={textLinkClass}>
                Import data
              </Link>{" "}
              first.
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Open it in a new tab to read or print. Use your browser&apos;s print dialog to save a PDF.
            </p>
          )}
          <a href={reportUrl} target="_blank" rel="noopener" className={`mt-4 w-full ${primaryButtonClass}`}>
            <ExternalLink size={16} aria-hidden="true" />
            Open HTML report
          </a>

          <h3 className="mt-6 text-sm font-semibold">Download</h3>
          <ul className="mt-2 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {downloads.map((item) => (
              <li key={item.format}>
                <a
                  href={`${reportUrl}?format=${item.format}&download=1`}
                  className="group flex items-start gap-3 py-3 text-sm hover:bg-[var(--panel-strong)]"
                >
                  <Download
                    size={16}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-[var(--muted)] group-hover:text-[var(--accent-strong)]"
                  />
                  <span>
                    <span className="block font-medium group-hover:text-[var(--accent-strong)]">{item.label}</span>
                    <span className="block text-[var(--muted)]">{item.detail}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-[var(--muted)]">
            Need to show what changed since the last review?{" "}
            <Link href={`${base}/baselines`} className={textLinkClass}>
              Compare baselines
            </Link>
            .
          </p>
        </section>

        <section className="min-w-0" aria-label="Report preview">
          <iframe
            title="Traceability report preview"
            src={`${reportUrl}?preview=1`}
            className={`h-[75vh] min-h-[480px] w-full ${panelClass}`}
          />
        </section>
      </div>
    </PageShell>
  );
}
