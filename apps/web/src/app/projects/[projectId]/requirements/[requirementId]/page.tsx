import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProjectData, getRequirement } from "@/lib/db";
import { linkedTestCases, linkedWorkItems, requirementFindings } from "@/lib/view-models";

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
  const findings = requirementFindings(requirement, data.findings);

  return (
    <PageShell project={data.project}>
      <Link href={`/projects/${projectId}/requirements`} className="text-sm text-[var(--accent-strong)]">
        Back to requirements
      </Link>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="border border-[var(--line)] bg-white p-5">
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
          <div className="border border-[var(--line)] bg-white p-4">
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

          <div className="border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">Linked tests</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {testCases.map((testCase) => (
                <div key={testCase.id} className="py-2">
                  <div className="font-medium">{testCase.name}</div>
                  <div className="text-[var(--muted)]">{testCase.classname ?? "No classname"} · {testCase.status}</div>
                  {testCase.failureMessage ? <div className="mt-1 text-[var(--danger)]">{testCase.failureMessage}</div> : null}
                </div>
              ))}
              {testCases.length === 0 ? <div className="py-2 text-[var(--muted)]">No linked tests.</div> : null}
            </div>
          </div>

          <div className="border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">Findings</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {findings.map((finding) => (
                <div key={finding.id} className="py-2">
                  <div className="font-medium">{finding.title}</div>
                  <div className="text-[var(--muted)]">{finding.category.replaceAll("_", " ")} · {finding.severity}</div>
                  {finding.recommendation ? <div className="mt-1">{finding.recommendation}</div> : null}
                </div>
              ))}
              {findings.length === 0 ? <div className="py-2 text-[var(--muted)]">No findings for this requirement.</div> : null}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
