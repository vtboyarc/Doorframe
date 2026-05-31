import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProjectData } from "@/lib/db";

const categories = [
  "missing_verification",
  "missing_work_trace",
  "weak_wording",
  "duplicate_candidate",
  "stale_link",
  "closed_work_without_verification",
  "multi_requirement",
  "non_verifiable"
];

export default async function FindingsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { projectId } = await params;
  const { category } = await searchParams;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const findings = category
    ? data.findings.filter((finding) => finding.category === category)
    : data.findings;

  return (
    <PageShell project={data.project}>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Findings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Review analyzer output grouped by category and severity.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/projects/${projectId}/findings`}
          className="border border-[var(--line)] bg-white px-3 py-2 text-sm"
        >
          All
        </Link>
        {categories.map((item) => (
          <Link
            key={item}
            href={`/projects/${projectId}/findings?category=${item}`}
            className="border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            {item.replaceAll("_", " ")}
          </Link>
        ))}
      </div>

      <div className="grid gap-3">
        {findings.map((finding) => (
          <article key={finding.id} className="border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-[var(--line)] px-2 py-1 text-xs uppercase">{finding.severity}</span>
              <span className="text-sm text-[var(--muted)]">{finding.category.replaceAll("_", " ")}</span>
            </div>
            <h2 className="mt-2 font-semibold">{finding.title}</h2>
            <p className="mt-1 text-sm">{finding.description}</p>
            {finding.recommendation ? <p className="mt-2 text-sm text-[var(--accent-strong)]">{finding.recommendation}</p> : null}
          </article>
        ))}
        {findings.length === 0 ? (
          <div className="border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">No findings match this filter.</div>
        ) : null}
      </div>
    </PageShell>
  );
}
