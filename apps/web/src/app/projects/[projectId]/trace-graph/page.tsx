import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TraceGraphClient } from "@/components/TraceGraphClient";
import { getProjectData } from "@/lib/db";
import { projectPageMetadata } from "@/lib/metadata";
import { graphNotice, traceGraphData, type TraceGraphNotice } from "@/lib/trace-graph";
import { panelClass, textLinkClass } from "@/lib/ui";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Trace graph");
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function GraphNotice({ notice }: { notice: TraceGraphNotice }) {
  const tone =
    notice.cause === "no-links"
      ? "border-[var(--warning)] bg-[var(--warning-soft)]"
      : "border-[var(--info)] bg-[var(--info-soft)]";

  return (
    <p className={`mb-3 border p-3 text-sm ${tone}`}>
      {notice.segments.map((segment, index) =>
        typeof segment === "string" ? (
          <span key={index}>{segment}</span>
        ) : (
          <Link key={index} href={segment.href} className={`${textLinkClass} underline`}>
            {segment.text}
          </Link>
        )
      )}
    </p>
  );
}

export default async function TraceGraphPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ focus?: string | string[]; view?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { focus, view } = await searchParams;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const graph = traceGraphData(data, projectId);
  const notice = graphNotice(graph, projectId);

  return (
    <PageShell project={data.project}>
      <PageHeader
        title="Trace Graph"
        description="Linked work items (left), requirements (middle), and linked tests (right) from imported local files."
      />
      {graph.nodes.length > 0 ? (
        <>
          {notice ? <GraphNotice notice={notice} /> : null}
          <TraceGraphClient
            nodes={graph.nodes}
            edges={graph.edges}
            initialFocus={firstValue(focus)}
            initialView={firstValue(view)}
          />
        </>
      ) : (
        <div className={`${panelClass} p-4 text-sm text-[var(--muted)]`}>
          Nothing to draw yet.{" "}
          <Link href={`/projects/${projectId}/imports`} className={textLinkClass}>
            Import requirements, work items, or test results
          </Link>{" "}
          to render the trace graph.
        </div>
      )}
    </PageShell>
  );
}
