import Link from "next/link";
import { notFound } from "next/navigation";
import { LoadDemoButton } from "@/components/LoadDemoButton";
import { MetricGrid } from "@/components/MetricGrid";
import { PageShell } from "@/components/PageShell";
import { getProjectData, getProjectSummary } from "@/lib/db";

export default async function ProjectDashboardPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = getProjectData(projectId);
  const summary = getProjectSummary(projectId);

  if (!data || !summary) {
    notFound();
  }

  return (
    <PageShell project={data.project}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col justify-between gap-4 border border-[var(--line)] bg-white p-5 md:flex-row">
          <div>
            <h1 className="text-2xl font-semibold">{data.project.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Local SQLite project. Import exported data, review trace coverage, and generate an HTML report.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <LoadDemoButton projectId={projectId} />
            <Link
              href={`/projects/${projectId}/imports`}
              className="inline-flex min-h-10 items-center justify-center border border-[var(--accent-strong)] bg-[var(--accent)] px-4 text-white"
            >
              Import data
            </Link>
          </div>
        </section>

        <MetricGrid summary={summary} />

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="border border-[var(--line)] bg-white p-4">
            <h2 className="text-lg font-semibold">Recent imports</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {data.importBatches.slice(0, 5).map((batch) => (
                <div key={batch.id} className="py-3 text-sm">
                  <div className="font-medium">{batch.filename}</div>
                  <div className="text-[var(--muted)]">
                    {batch.sourceType} · {batch.recordCount} records · {new Date(batch.importedAt).toLocaleString()}
                  </div>
                </div>
              ))}
              {data.importBatches.length === 0 ? (
                <div className="py-3 text-sm text-[var(--muted)]">No imports yet. Start with the sample files in `examples/`.</div>
              ) : null}
            </div>
          </div>

          <div className="border border-[var(--line)] bg-white p-4">
            <h2 className="text-lg font-semibold">Highest priority findings</h2>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {data.findings.slice(0, 5).map((finding) => (
                <div key={finding.id} className="py-3 text-sm">
                  <div className="font-medium">{finding.title}</div>
                  <div className="text-[var(--muted)]">
                    {finding.severity} · {finding.category.replaceAll("_", " ")}
                  </div>
                </div>
              ))}
              {data.findings.length === 0 ? (
                <div className="py-3 text-sm text-[var(--muted)]">No findings yet.</div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
