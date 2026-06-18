import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProject, listAuditEvents } from "@/lib/db";
import { auditEventTarget } from "@/lib/view-models";

const cell = { textAlign: "left" as const, borderBottom: "1px solid #d3d8cf", padding: 8, verticalAlign: "top" as const };

export default async function AuditPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    notFound();
  }

  const events = listAuditEvents(projectId);

  return (
    <PageShell project={project}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Audit Log</h1>
      <p style={{ marginBottom: 16, color: "#5c6660" }}>
        Local record of imports, analysis runs, baselines, ruleset changes, and report generation.
      </p>
      {events.length === 0 ? (
        <p>No activity recorded yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={cell}>When</th>
              <th style={cell}>Action</th>
              <th style={cell}>Actor</th>
              <th style={cell}>Summary</th>
              <th style={cell}>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const target = auditEventTarget(projectId, event.action);

              return (
                <tr key={event.id}>
                  <td style={cell}>{new Date(event.timestamp).toLocaleString()}</td>
                  <td style={cell}>{event.action}</td>
                  <td style={cell}>{event.actor}</td>
                  <td style={cell}>{event.summary}</td>
                  <td style={cell}>
                    <Link href={target.href} className="whitespace-nowrap text-[var(--accent-strong)] hover:underline">
                      {target.label} →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
