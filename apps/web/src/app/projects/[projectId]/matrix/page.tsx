import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProject, getProjectData } from "@/lib/db";
import { matrixRows } from "@doorframe/reporting";
import { panelClass } from "@/lib/ui";

const cellClass = "border-b border-[var(--line)] px-3 py-3 text-left align-top";

export default async function MatrixPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    notFound();
  }

  const data = getProjectData(projectId)!;
  const rows = matrixRows(data);
  const covered = rows.filter((row) => row.workItems.length > 0 && row.testCases.length > 0).length;
  const coverage = rows.length === 0 ? 0 : Math.round((covered / rows.length) * 100);

  return (
    <PageShell project={project}>
      <h1 className="text-2xl font-semibold">Traceability Matrix</h1>
      <p className="mt-1 mb-5 text-sm text-[var(--muted)]">
        {rows.length} requirements · {coverage}% with both linked work and tests
      </p>
      {rows.length === 0 ? (
        <p className={`${panelClass} p-4 text-sm text-[var(--muted)]`}>No requirements yet. Import data to populate the matrix.</p>
      ) : (
        <div className={`${panelClass} overflow-hidden`}>
          <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={cellClass}>Requirement</th>
              <th className={cellClass}>Title</th>
              <th className={cellClass}>Status</th>
              <th className={cellClass}>Work items</th>
              <th className={cellClass}>Tests</th>
              <th className={cellClass}>Findings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.requirement.id}>
                <td className={cellClass}>
                  <Link
                    href={`/projects/${projectId}/requirements/${encodeURIComponent(row.requirement.externalId)}`}
                    className="font-medium text-[var(--accent-strong)] hover:underline"
                  >
                    {row.requirement.externalId}
                  </Link>
                </td>
                <td className={cellClass}>
                  <Link
                    href={`/projects/${projectId}/requirements/${encodeURIComponent(row.requirement.externalId)}`}
                    className="hover:text-[var(--accent-strong)] hover:underline"
                  >
                    {row.requirement.title}
                  </Link>
                </td>
                <td className={cellClass}>{row.requirement.status ?? "—"}</td>
                <td className={cellClass}>{row.workItems.map((w) => w.externalId).join(", ") || "—"}</td>
                <td className={cellClass}>
                  {row.testCases.map((t) => `${t.name} (${t.status})`).join(", ") || "—"}
                </td>
                <td className={cellClass}>
                  {row.findings.length > 0 ? (
                    <Link
                      href={`/projects/${projectId}/requirements/${encodeURIComponent(row.requirement.externalId)}#findings`}
                      className="font-medium text-[var(--accent-strong)] hover:underline"
                    >
                      {row.findings.length}
                    </Link>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
