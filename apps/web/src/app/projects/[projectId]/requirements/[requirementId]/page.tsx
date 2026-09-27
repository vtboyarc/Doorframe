import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getProject, getProjectData, getRequirement } from "@/lib/db";
import { sentenceLabel, sourceTypeLabel } from "@/lib/labels";
import { routeIdCandidates, safeDecode } from "@/lib/params";
import { severityBadgeClass, testStatusClass } from "@/lib/severity";
import {
  childRequirements,
  findingsByPriority,
  linkedTestCases,
  linkedWorkItems,
  parentRequirement,
  requirementFindings
} from "@/lib/view-models";
import { labelClass, panelClass, primaryButtonClass, secondaryButtonClass, textLinkClass } from "@/lib/ui";

type Params = Promise<{ projectId: string; requirementId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { projectId, requirementId } = await params;
  const projectName = getProject(projectId)?.name ?? "Project not found";
  return { title: `${safeDecode(requirementId)} · ${projectName}` };
}

/** Only follow "back" links that stay inside this project. */
function safeBackHref(back: string | undefined, projectId: string): string | null {
  return back && back.startsWith(`/projects/${projectId}/`) && !back.startsWith("//") ? back : null;
}

export default async function RequirementDetailPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: Promise<{ back?: string }>;
}) {
  const { projectId, requirementId } = await params;
  const { back } = await searchParams;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const base = `/projects/${projectId}`;
  const externalOrId = safeDecode(requirementId);
  const requirement =
    routeIdCandidates(requirementId)
      .map((candidate) => getRequirement(projectId, candidate))
      .find(Boolean) ?? null;
  const backHref = safeBackHref(back, projectId) ?? `${base}/requirements`;
  const backLabel = backHref.startsWith(`${base}/matrix`)
    ? "Back to matrix"
    : backHref.startsWith(`${base}/findings`)
      ? "Back to finding"
      : backHref.startsWith(`${base}/baselines`)
        ? "Back to baselines"
        : "Back to requirements";

  if (!requirement) {
    return (
      <PageShell project={data.project}>
        <section className={`${panelClass} mx-auto max-w-xl p-6`}>
          <h1 className="break-words text-2xl font-semibold">Requirement {externalOrId} is not in this project</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            It may have been removed by a later import, or the ID may be spelled differently in the current data.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`${base}/requirements`} className={primaryButtonClass}>
              Browse requirements
            </Link>
            <Link href={`${base}/baselines`} className={secondaryButtonClass}>
              Compare baselines
            </Link>
          </div>
        </section>
      </PageShell>
    );
  }

  const workItems = linkedWorkItems(requirement, data);
  const testCases = linkedTestCases(requirement, data);
  const findings = findingsByPriority(requirementFindings(requirement, data));
  const parent = parentRequirement(requirement, data);
  const children = childRequirements(requirement, data);
  const position = data.requirements.findIndex((candidate) => candidate.id === requirement.id);
  const previous = position > 0 ? data.requirements[position - 1] : null;
  const next = position >= 0 && position < data.requirements.length - 1 ? data.requirements[position + 1] : null;
  const withBack = (externalId: string) =>
    `${base}/requirements/${encodeURIComponent(externalId)}${back ? `?back=${encodeURIComponent(backHref)}` : ""}`;

  const attributes: Array<[string, string | undefined]> = [
    ["Status", requirement.status],
    ["Verification method", requirement.verificationMethod],
    ["Type", requirement.type],
    ["Priority", requirement.priority],
    ["Source", sourceTypeLabel(requirement.source)]
  ];

  return (
    <PageShell project={data.project}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <Link href={backHref} className={textLinkClass}>
          <span aria-hidden="true">←</span> {backLabel}
        </Link>
        <nav aria-label="Adjacent requirements by ID" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href={`${base}/trace-graph?focus=${encodeURIComponent(requirement.externalId)}`}
            className={textLinkClass}
          >
            View in trace graph
          </Link>
          {previous ? (
            <Link
              href={withBack(previous.externalId)}
              title="Previous requirement by ID"
              aria-label={`Previous requirement by ID: ${previous.externalId}`}
              className={textLinkClass}
            >
              <span aria-hidden="true">←</span> {previous.externalId}
            </Link>
          ) : null}
          {next ? (
            <Link
              href={withBack(next.externalId)}
              title="Next requirement by ID"
              aria-label={`Next requirement by ID: ${next.externalId}`}
              className={textLinkClass}
            >
              {next.externalId} <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </nav>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className={`${panelClass} min-w-0 p-5`}>
          <div className="text-sm text-[var(--muted)]">{requirement.externalId}</div>
          <h1 className="mt-1 text-2xl font-semibold [overflow-wrap:anywhere]">{requirement.title}</h1>
          <div className="mt-4 whitespace-pre-wrap border border-[var(--line)] bg-[var(--background)] p-4 text-sm [overflow-wrap:anywhere]">
            {requirement.text || <span className="text-[var(--muted)]">No requirement text was imported.</span>}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {attributes.map(([label, value]) => (
              <div key={label}>
                <dt className={labelClass}>{label}</dt>
                <dd className="mt-0.5">{value || <span className="text-[var(--muted)]">Not set</span>}</dd>
              </div>
            ))}
            <div>
              <dt className={labelClass}>Parent</dt>
              <dd className="mt-0.5">
                {parent ? (
                  <Link href={withBack(parent.externalId)} className={textLinkClass}>
                    {parent.externalId} · {parent.title}
                  </Link>
                ) : requirement.parentExternalId ? (
                  <span>
                    {requirement.parentExternalId} <span className="text-[var(--muted)]">(not in this project)</span>
                  </span>
                ) : (
                  <span className="text-[var(--muted)]">None</span>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className={labelClass}>Child requirements</dt>
              <dd className="mt-0.5">
                {children.length > 0 ? (
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {children.map((child) => (
                      <Link key={child.id} href={withBack(child.externalId)} className={textLinkClass}>
                        {child.externalId}
                      </Link>
                    ))}
                  </span>
                ) : (
                  <span className="text-[var(--muted)]">None</span>
                )}
              </dd>
            </div>
          </dl>

          <details className="mt-6 border border-[var(--line)]">
            <summary className="px-4 py-3 text-sm font-medium">Imported raw attributes</summary>
            <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap border-t border-[var(--line)] bg-[var(--background)] p-4 text-xs text-[var(--foreground)] [overflow-wrap:anywhere]">
              {JSON.stringify(requirement.rawAttributes ?? {}, null, 2)}
            </pre>
          </details>
        </section>

        <aside className="min-w-0 space-y-4">
          <div id="work-items" className={`scroll-mt-4 ${panelClass} p-4`}>
            <h2 className="font-semibold">Linked work items ({workItems.length})</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {workItems.map((workItem) => (
                <div key={workItem.id} className="py-2 [overflow-wrap:anywhere]">
                  <div className="font-medium">{workItem.externalId}</div>
                  <div>{workItem.title}</div>
                  <div className="text-[var(--muted)]">{workItem.status ?? "No status"}</div>
                </div>
              ))}
              {workItems.length === 0 ? (
                <div className="py-2 text-[var(--warning)]">No linked work items.</div>
              ) : null}
            </div>
          </div>

          <div id="tests" className={`scroll-mt-4 ${panelClass} p-4`}>
            <h2 className="font-semibold">Linked tests ({testCases.length})</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {testCases.map((testCase) => (
                <div key={testCase.id} className="py-2 [overflow-wrap:anywhere]">
                  <div className="font-medium">{testCase.name}</div>
                  <div className="text-[var(--muted)]">
                    {testCase.classname ?? "No classname"} ·{" "}
                    <span className={`font-medium ${testStatusClass[testCase.status]}`}>{testCase.status}</span>
                  </div>
                  {testCase.failureMessage ? <div className="mt-1 text-[var(--danger)]">{testCase.failureMessage}</div> : null}
                </div>
              ))}
              {testCases.length === 0 ? <div className="py-2 text-[var(--warning)]">No linked tests.</div> : null}
            </div>
          </div>

          <div id="findings" className={`scroll-mt-4 ${panelClass} p-4`}>
            <h2 className="font-semibold">Findings ({findings.length})</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {findings.map((finding) => (
                <Link
                  key={finding.id}
                  href={`${base}/findings/${finding.id}?back=${encodeURIComponent(
                    `${base}/requirements/${encodeURIComponent(requirement.externalId)}`
                  )}`}
                  className="group -mx-2 block px-2 py-2 hover:bg-[var(--panel-strong)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium group-hover:text-[var(--accent-strong)]">{finding.title}</div>
                    <span aria-hidden="true" className="text-[var(--muted)] group-hover:text-[var(--accent-strong)]">
                      →
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`border px-1.5 py-0.5 text-xs font-medium uppercase ${severityBadgeClass[finding.severity]}`}>
                      {finding.severity}
                    </span>
                    <span className="text-[var(--muted)]">{sentenceLabel(finding.category)}</span>
                  </div>
                  {finding.recommendation ? <div className="mt-1 text-[var(--muted)]">{finding.recommendation}</div> : null}
                </Link>
              ))}
              {findings.length === 0 ? (
                <div className="py-2 text-[var(--muted)]">No findings for this requirement.</div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
