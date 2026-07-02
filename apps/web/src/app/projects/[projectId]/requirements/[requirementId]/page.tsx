import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProjectData, getRequirement } from "@/lib/db";
import { humanize, severityBadgeClass, testStatusClass } from "@/lib/severity";
import { linkedTestCases, linkedWorkItems, requirementFindings } from "@/lib/view-models";
import { panelClass } from "@/lib/ui";

export default async function RequirementDetailPage({
  params
}: {
  params: Promise<{ projectId: string; requirementId: string }>;
}) {
  const { projectId, requirementId } = await params;
  const data = getProjectData(projectId);
  const requirement = getRequirement(projectId, decodeURIComponent(requirementId));

  if (!data || !requirement) {
    notFound();
  }

  const workItems = linkedWorkItems(requirement, data);
  const testCases = linkedTestCases(requirement, data);
  const findings = requirementFindings(requirement, data);

  return (
    <PageShell project={data.project}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href={`/projects/${projectId}/requirements`} className="text-[var(--accent-strong)] hover:underline">
          ← Back to requirements
        </Link>
        <Link href={`/projects/${projectId}/findings`} className="text-[var(--accent-strong)] hover:underline">
          View all findings
        </Link>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className={`${panelClass} p-5`}>
          <div className="text-sm text-[var(--muted)]">{requirement.externalId}</div>
          <h1 className="mt-1 text-2xl font-semibold">{requirement.title}</h1>
          <div className="mt-4 whitespace-pre-wrap border border-[var(--line)] bg-[var(--background)] p-4 text-sm">
            {requirement.text}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Status</dt>
              <dd>{requirement.status ?? "Unspecified"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Verification method</dt>
              <dd>{requirement.verificationMethod ?? "Unspecified"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Type</dt>
              <dd>{requirement.type ?? "Unspecified"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Priority</dt>
              <dd>{requirement.priority ?? "Unspecified"}</dd>
            </div>
          </dl>

          <h2 className="mt-6 text-lg font-semibold">Raw attributes</h2>
          <pre className="mt-2 max-h-[360px] overflow-auto border border-[var(--line)] bg-[#101820] p-4 text-xs text-white">
            {JSON.stringify(requirement.rawAttributes ?? {}, null, 2)}
          </pre>
        </section>

        <aside className="space-y-4">
          <div id="work-items" className={`scroll-mt-4 ${panelClass} p-4`}>
            <h2 className="font-semibold">Linked work items</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {workItems.map((workItem) => (
                <div key={workItem.id} className="py-2">
                  <div className="font-medium">{workItem.externalId}</div>
                  <div>{workItem.title}</div>
                  <div className="text-[var(--muted)]">{workItem.status ?? "No status"}</div>
                </div>
              ))}
              {workItems.length === 0 ? <div className="py-2 text-[var(--muted)]">No linked work items.</div> : null}
            </div>
          </div>

          <div id="tests" className={`scroll-mt-4 ${panelClass} p-4`}>
            <h2 className="font-semibold">Linked tests</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {testCases.map((testCase) => (
                <div key={testCase.id} className="py-2">
                  <div className="font-medium">{testCase.name}</div>
                  <div className="text-[var(--muted)]">
                    {testCase.classname ?? "No classname"} ·{" "}
                    <span className={`font-medium ${testStatusClass[testCase.status]}`}>{testCase.status}</span>
                  </div>
                  {testCase.failureMessage ? <div className="mt-1 text-[var(--danger)]">{testCase.failureMessage}</div> : null}
                </div>
              ))}
              {testCases.length === 0 ? <div className="py-2 text-[var(--muted)]">No linked tests.</div> : null}
            </div>
          </div>

          <div id="findings" className={`scroll-mt-4 ${panelClass} p-4`}>
            <h2 className="font-semibold">Findings</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {findings.map((finding) => (
                <Link
                  key={finding.id}
                  href={`/projects/${projectId}/findings/${finding.id}`}
                  className="group block py-2 hover:bg-[var(--background)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium group-hover:text-[var(--accent-strong)]">{finding.title}</div>
                    <span aria-hidden="true" className="text-[var(--muted)] group-hover:text-[var(--accent-strong)]">→</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`border px-1.5 py-0.5 text-xs font-medium uppercase ${severityBadgeClass[finding.severity]}`}>
                      {finding.severity}
                    </span>
                    <span className="text-[var(--muted)]">{humanize(finding.category)}</span>
                  </div>
                  {finding.recommendation ? <div className="mt-1">{finding.recommendation}</div> : null}
                </Link>
              ))}
              {findings.length === 0 ? <div className="py-2 text-[var(--muted)]">No findings for this requirement.</div> : null}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
