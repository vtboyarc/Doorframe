import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { matrixRows } from "@doorframe/reporting";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { RestoredScrollBox } from "@/components/RestoredScrollBox";
import { getProjectData } from "@/lib/db";
import { projectPageMetadata } from "@/lib/metadata";
import { testStatusClass } from "@/lib/severity";
import { coveragePercent } from "@/lib/view-models";
import { panelClass, primaryButtonClass, secondaryButtonClass, tableScrollClass, textLinkClass } from "@/lib/ui";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Traceability matrix");
}

const headerClass =
  "sticky top-0 z-10 whitespace-nowrap border-b border-[var(--line)] bg-[var(--panel)] px-3 py-3 text-left text-xs font-semibold uppercase text-[var(--muted)]";
const cellClass = "border-b border-[var(--line)] px-3 py-3 text-left align-top";

function gapBadge(text: string) {
  return (
    <span className="inline-flex whitespace-nowrap border border-[var(--warning)] bg-[var(--warning-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--warning)]">
      {text}
    </span>
  );
}

export default async function MatrixPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const data = getProjectData(projectId);
  if (!data) {
    notFound();
  }

  const base = `/projects/${projectId}`;
  const rows = matrixRows(data);
  const covered = rows.filter((row) => row.workItems.length > 0 && row.testCases.length > 0).length;
  const requirementHref = (externalId: string, hash = "") =>
    `${base}/requirements/${encodeURIComponent(externalId)}?back=${encodeURIComponent(`${base}/matrix`)}${hash}`;

  return (
    <PageShell project={data.project}>
      <PageHeader
        title="Traceability matrix"
        description={
          rows.length > 0
            ? `${covered} of ${rows.length} requirements (${coveragePercent(covered, rows.length)}%) have both linked work and tests.`
            : "Each requirement with its linked work items, tests, and findings."
        }
        actions={
          rows.length > 0 ? (
            <a href={`/api/projects/${projectId}/report?format=csv&download=1`} className={secondaryButtonClass}>
              <Download size={16} aria-hidden="true" />
              Download CSV
            </a>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <section className={`${panelClass} p-6`}>
          <h2 className="text-lg font-semibold">No requirements yet</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Import requirements to populate the matrix.</p>
          <Link href={`${base}/imports?type=requirements-csv`} className={`mt-4 ${primaryButtonClass}`}>
            Import requirements
          </Link>
        </section>
      ) : (
        <RestoredScrollBox className={`${panelClass} ${tableScrollClass}`}>
          <table className="w-full min-w-[880px] border-collapse text-sm print:min-w-0">
            <caption className="sr-only">Traceability matrix</caption>
            <thead>
              <tr>
                <th className={headerClass}>Requirement</th>
                <th className={headerClass}>Title</th>
                <th className={headerClass}>Status</th>
                <th className={headerClass}>Work items</th>
                <th className={headerClass}>Tests</th>
                <th className={headerClass}>Findings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.requirement.id} className="hover:bg-[var(--panel-strong)]">
                  <td className={`${cellClass} whitespace-nowrap`}>
                    <Link
                      href={requirementHref(row.requirement.externalId)}
                      className="font-medium text-[var(--accent-strong)] hover:underline"
                    >
                      {row.requirement.externalId}
                    </Link>
                  </td>
                  <td className={cellClass}>{row.requirement.title}</td>
                  <td className={`${cellClass} whitespace-nowrap`}>
                    {row.requirement.status ?? <span className="text-[var(--muted)]">—</span>}
                  </td>
                  <td className={cellClass}>
                    {row.workItems.length > 0 ? (
                      <ul className="grid gap-1">
                        {row.workItems.map((workItem) => (
                          <li key={workItem.id} className="whitespace-nowrap" title={workItem.title}>
                            {workItem.externalId}
                            {workItem.status ? <span className="text-[var(--muted)]"> · {workItem.status}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      gapBadge("No work")
                    )}
                  </td>
                  <td className={cellClass}>
                    {row.testCases.length > 0 ? (
                      <ul className="grid gap-1">
                        {row.testCases.map((testCase) => (
                          <li key={testCase.id} className="[overflow-wrap:anywhere]">
                            {testCase.name}{" "}
                            <span className={`whitespace-nowrap font-medium ${testStatusClass[testCase.status]}`}>
                              {testCase.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      gapBadge("No tests")
                    )}
                  </td>
                  <td className={`${cellClass} whitespace-nowrap`}>
                    {row.findings.length > 0 ? (
                      <Link href={requirementHref(row.requirement.externalId, "#findings")} className={`font-medium ${textLinkClass}`}>
                        {row.findings.length}
                      </Link>
                    ) : (
                      <span className="text-[var(--muted)]">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </RestoredScrollBox>
      )}
    </PageShell>
  );
}
