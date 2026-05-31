import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProjectData } from "@/lib/db";

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

  return (
    <PageShell project={data.project}>
      <div className="grid gap-4 lg:grid-cols-[460px_1fr]">
        <section className="border border-[var(--line)] bg-white p-5">
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Generate a local HTML report with project summary, traceability matrix, findings, missing verification, missing work items, failed tests by requirement, and weak language.
          </p>
          <a
            href={`/api/projects/${projectId}/report`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex min-h-10 items-center gap-2 border border-[var(--accent-strong)] bg-[var(--accent)] px-4 text-white"
          >
            <ExternalLink size={16} />
            Open HTML report
          </a>
        </section>
        <iframe
          title="Traceability report preview"
          src={`/api/projects/${projectId}/report`}
          className="h-[720px] w-full border border-[var(--line)] bg-white"
        />
      </div>
    </PageShell>
  );
}
