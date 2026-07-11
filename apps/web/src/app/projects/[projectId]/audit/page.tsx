import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProject, listAuditEvents } from "@/lib/db";
import { auditEventTarget } from "@/lib/view-models";
import { panelClass } from "@/lib/ui";

const cellClass = "border-b border-[var(--line)] px-3 py-3 text-left align-top";

export default async function AuditPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    notFound();
  }

  const events = listAuditEvents(projectId);

  return (
    <PageShell project={project}>
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="mt-1 mb-5 text-sm text-[var(--muted)]">
        Local record of imports, analysis runs, baselines, ruleset changes, and report generation.
      </p>
      {events.length === 0 ? (
        <p className={`${panelClass} p-4 text-sm text-[var(--muted)]`}>No activity recorded yet.</p>
      ) : (
        <div className={`${panelClass} overflow-hidden`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={cellClass}>When</th>
                <th className={cellClass}>Action</th>
                <th className={cellClass}>Actor</th>
                <th className={cellClass}>Summary</th>
                <th className={cellClass}>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const target = auditEventTarget(projectId, event.action);

                return (
                  <tr key={event.id}>
                    <td className={`${cellClass} whitespace-nowrap font-mono text-xs text-[var(--muted)]`}>
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className={cellClass}>{event.action}</td>
                    <td className={cellClass}>{event.actor}</td>
                    <td className={cellClass}>{event.summary}</td>
                    <td className={cellClass}>
                      <Link href={target.href} className="whitespace-nowrap text-[var(--accent-strong)] hover:underline">
                        {target.label} →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
