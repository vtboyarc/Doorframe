import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProject, listAuditEvents } from "@/lib/db";

const cell = { textAlign: "left" as const, borderBottom: "1px solid #d3d8cf", padding: 8, verticalAlign: "top" as const };

export default async function AuditPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    notFound();
  }

  const events = listAuditEvents(projectId);

  return (
    <PageShell projectId={projectId} title="Audit Log">
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
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td style={cell}>{new Date(event.timestamp).toLocaleString()}</td>
                <td style={cell}>{event.action}</td>
                <td style={cell}>{event.actor}</td>
                <td style={cell}>{event.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
