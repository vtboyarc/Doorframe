import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { TraceGraphClient, type TraceGraphEdge, type TraceGraphNode } from "@/components/TraceGraphClient";
import { getProjectData } from "@/lib/db";
import { requirementRows } from "@/lib/view-models";
import { panelClass } from "@/lib/ui";
import { projectPageMetadata } from "@/lib/metadata";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Trace graph");
}

export default async function TraceGraphPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const nodes: TraceGraphNode[] = [
    ...requirementRows(data).map((row) => ({
      id: row.id,
      type: "requirement" as const,
      label: row.externalId,
      title: row.title,
      findingCount: row.findingCount,
      hasGap: row.linkedWorkCount === 0 || row.linkedTestCount === 0,
      href: `/projects/${projectId}/requirements/${encodeURIComponent(row.externalId)}`
    })),
    ...data.workItems.map((workItem) => ({
      id: workItem.id,
      type: "workItem" as const,
      label: workItem.externalId,
      title: workItem.title
    })),
    ...data.testCases.map((testCase) => ({
      id: testCase.id,
      type: "testCase" as const,
      label: testCase.name,
      title: testCase.status,
      status: testCase.status
    }))
  ];
  const edges: TraceGraphEdge[] = data.traceLinks.map((link) => ({
    id: link.id,
    source: link.sourceId,
    target: link.targetId,
    label: link.linkType
  }));

  return (
    <PageShell project={data.project}>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Trace Graph</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Requirements (left), linked work items (middle), and linked tests (right) from imported local files.
        </p>
      </div>
      {nodes.length > 0 ? (
        <>
          {edges.length === 0 ? (
            <p className="mb-3 border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm">
              No trace links yet. Import a Jira CSV or JUnit XML file that mentions requirement IDs to connect the
              columns.
            </p>
          ) : null}
          <TraceGraphClient nodes={nodes} edges={edges} />
        </>
      ) : (
        <div className={`${panelClass} p-4 text-sm text-[var(--muted)]`}>
          Nothing to draw yet.{" "}
          <Link href={`/projects/${projectId}/imports`} className="text-[var(--accent-strong)] hover:underline">
            Import requirements, work items, or test results
          </Link>{" "}
          to render the trace graph.
        </div>
      )}
    </PageShell>
  );
}
