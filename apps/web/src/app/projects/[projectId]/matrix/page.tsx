import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProject, getProjectData } from "@/lib/db";
import { matrixRows } from "@doorframe/reporting";

const cell = { textAlign: "left" as const, borderBottom: "1px solid #d3d8cf", padding: 8, verticalAlign: "top" as const };

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
    <PageShell projectId={projectId} title="Traceability Matrix">
      <p style={{ marginBottom: 16, color: "#5c6660" }}>
        {rows.length} requirements · {coverage}% with both linked work and tests
      </p>
      {rows.length === 0 ? (
        <p>No requirements yet. Import data to populate the matrix.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={cell}>Requirement</th>
              <th style={cell}>Title</th>
              <th style={cell}>Status</th>
              <th style={cell}>Work items</th>
              <th style={cell}>Tests</th>
              <th style={cell}>Findings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.requirement.id}>
                <td style={cell}>{row.requirement.externalId}</td>
                <td style={cell}>{row.requirement.title}</td>
                <td style={cell}>{row.requirement.status ?? "—"}</td>
                <td style={cell}>{row.workItems.map((w) => w.externalId).join(", ") || "—"}</td>
                <td style={cell}>
                  {row.testCases.map((t) => `${t.name} (${t.status})`).join(", ") || "—"}
                </td>
                <td style={cell}>{row.findings.length || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
