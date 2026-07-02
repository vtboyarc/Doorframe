import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { TraceGraphClient } from "@/components/TraceGraphClient";
import { getProjectData } from "@/lib/db";
import { panelClass } from "@/lib/ui";

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

  const nodes = [
    ...data.requirements.map((requirement) => ({
      id: requirement.id,
      type: "requirement",
      label: requirement.externalId,
      title: requirement.title
    })),
    ...data.workItems.map((workItem) => ({
      id: workItem.id,
      type: "workItem",
      label: workItem.externalId,
      title: workItem.title
    })),
    ...data.testCases.map((testCase) => ({
      id: testCase.id,
      type: "testCase",
      label: testCase.name,
      title: testCase.status,
      status: testCase.status
    }))
  ];
  const edges = data.traceLinks.map((link) => ({
    id: link.id,
    source: link.sourceId,
    target: link.targetId,
    label: link.linkType
  }));

  return (
    <PageShell project={data.project}>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Trace Graph</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Requirement to work item to test case relationships from imported local files.</p>
      </div>
      {nodes.length > 0 ? (
        <TraceGraphClient nodes={nodes} edges={edges} />
      ) : (
        <div className={`${panelClass} p-4 text-sm text-[var(--muted)]`}>Import data to render the trace graph.</div>
      )}
    </PageShell>
  );
}
