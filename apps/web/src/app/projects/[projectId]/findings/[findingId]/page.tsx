import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProjectData } from "@/lib/db";
import { humanize, severityBadgeClass, testStatusClass } from "@/lib/severity";
import { findingContext } from "@/lib/view-models";

export default async function FindingDetailPage({
  params
}: {
  params: Promise<{ projectId: string; findingId: string }>;
}) {
  const { projectId, findingId } = await params;
  const data = getProjectData(projectId);
  const finding = data?.findings.find((item) => item.id === decodeURIComponent(findingId));

  if (!data || !finding) {
    notFound();
  }

  const context = findingContext(finding, data);
  const entityTypeLabel = {
    requirement: "requirement",
    workItem: "work item",
    testCase: "test case"
  }[context.entityType];

  return (
    <PageShell project={data.project}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href={`/projects/${projectId}/findings`} className="text-[var(--accent-strong)] hover:underline">
          ← Back to findings
        </Link>
        {context.entityType === "requirement" && context.entity ? (
          <Link
            href={`/projects/${projectId}/requirements/${encodeURIComponent(context.entity.id)}`}
            className="text-[var(--accent-strong)] hover:underline"
          >
            Open full requirement →
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="border border-[var(--line)] bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-1 text-xs font-medium uppercase ${severityBadgeClass[finding.severity]}`}>
              {finding.severity}
            </span>
            <span className="text-sm text-[var(--muted)]">{humanize(finding.category)}</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold">{finding.title}</h1>

          <div className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">What Doorframe found</h2>
            <p className="mt-2 whitespace-pre-wrap">{finding.description}</p>
          </div>

          <div className="mt-6 border-l-4 border-l-[var(--accent)] bg-[var(--background)] p-4">
            <h2 className="font-semibold">Recommended next step</h2>
            <p className="mt-1 text-sm">
              {finding.recommendation ?? "Review the affected entity and its trace links, then update the source data and re-run analysis."}
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">Affected entity</h2>
            {context.entity ? (
              <dl className="mt-3 grid gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase text-[var(--muted)]">Type</dt>
                  <dd>{entityTypeLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-[var(--muted)]">ID</dt>
                  <dd className="font-medium">{context.entity.externalId}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-[var(--muted)]">Title</dt>
                  <dd>{"name" in context.entity ? context.entity.name : context.entity.title}</dd>
                </div>
                {"status" in context.entity ? (
                  <div>
                    <dt className="text-xs uppercase text-[var(--muted)]">Status</dt>
                    <dd className={context.entityType === "testCase" ? testStatusClass[context.entity.status] : undefined}>
                      {context.entity.status ?? "Unspecified"}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs uppercase text-[var(--muted)]">Source</dt>
                  <dd>{context.entity.source}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                The source entity is no longer present. Re-run analysis to refresh findings after imports change.
              </p>
            )}
          </section>

          <section className="border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">Related requirements</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {context.relatedRequirements.map((requirement) => (
                <Link
                  key={requirement.id}
                  href={`/projects/${projectId}/requirements/${encodeURIComponent(requirement.id)}`}
                  className="group block py-3 hover:bg-[var(--background)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--accent-strong)]">{requirement.externalId}</div>
                      <div>{requirement.title}</div>
                    </div>
                    <span aria-hidden="true" className="text-[var(--muted)] group-hover:text-[var(--accent-strong)]">→</span>
                  </div>
                </Link>
              ))}
              {context.relatedRequirements.length === 0 ? (
                <div className="py-2 text-[var(--muted)]">No linked requirements.</div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
