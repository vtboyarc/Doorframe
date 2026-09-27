import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { Requirement } from "@doorframe/core";
import { PageShell } from "@/components/PageShell";
import { getProject, getProjectData } from "@/lib/db";
import { findingsListView, flaggedTerms, isFindingCategory, isFindingSeverity, mentionedEntities } from "@/lib/findings";
import { sentenceLabel, sourceTypeLabel } from "@/lib/labels";
import { severityBadgeClass, testStatusClass } from "@/lib/severity";
import { findingContext, linkedTestCases, linkedWorkItems } from "@/lib/view-models";
import { labelClass, panelClass, primaryButtonClass, secondaryButtonClass, textLinkClass } from "@/lib/ui";

type Params = Promise<{ projectId: string; findingId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { projectId, findingId } = await params;
  const data = getProjectData(projectId);
  const finding = data?.findings.find((item) => item.id === decodeURIComponent(findingId));
  const projectName = getProject(projectId)?.name ?? "Project not found";
  return { title: `${finding?.title ?? "Finding"} · ${projectName}` };
}

const entityTypeLabels = { requirement: "Requirement", workItem: "Work item", testCase: "Test case" } as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Requirement text with the flagged vague terms highlighted. */
function highlight(text: string, terms: string[]): ReactNode {
  if (terms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`\\b(${terms.map(escapeRegExp).join("|")})\\b`, "gi");
  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="bg-[var(--warning-soft)] px-0.5 text-[var(--warning)]">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function RequirementText({ requirement, terms = [] }: { requirement: Requirement; terms?: string[] }) {
  return (
    <div className="border border-[var(--line)] bg-[var(--background)] p-4 text-sm">
      <div className="mb-1 text-xs font-medium text-[var(--muted)]">
        {requirement.externalId} · {requirement.title}
      </div>
      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {requirement.text ? highlight(requirement.text, terms) : <span className="text-[var(--muted)]">No text imported.</span>}
      </p>
    </div>
  );
}

/** Only follow "back" links that stay inside this project. */
function safeBackHref(back: string | undefined, projectId: string): string | null {
  return back && back.startsWith(`/projects/${projectId}/`) && !back.startsWith("//") ? back : null;
}

export default async function FindingDetailPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: Promise<{ back?: string }>;
}) {
  const { projectId, findingId } = await params;
  const { back } = await searchParams;
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const base = `/projects/${projectId}`;
  const backHref = safeBackHref(back, projectId) ?? `${base}/findings`;
  const backLabel = backHref.startsWith(`${base}/requirements`) ? "Back to requirement" : "Back to findings";
  const finding = data.findings.find((item) => item.id === decodeURIComponent(findingId));

  if (!finding) {
    return (
      <PageShell project={data.project}>
        <section className={`${panelClass} mx-auto max-w-xl p-6`}>
          <h1 className="text-2xl font-semibold">This finding is no longer present</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            The latest analysis did not produce it again, usually because the gap was resolved by a newer import or a
            ruleset change.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`${base}/findings`} className={primaryButtonClass}>
              View current findings
            </Link>
            <Link href={base} className={secondaryButtonClass}>
              Open dashboard
            </Link>
          </div>
        </section>
      </PageShell>
    );
  }

  // Previous / next within the list the reviewer came from (same filters and order).
  const backParams = new URL(backHref, "http://local").searchParams;
  const listCategory = backParams.get("category");
  const listSeverity = backParams.get("severity");
  const ordered = findingsListView(
    data.findings,
    {
      category: isFindingCategory(listCategory) ? listCategory : undefined,
      severity: isFindingSeverity(listSeverity) ? listSeverity : undefined
    },
    Number.MAX_SAFE_INTEGER
  ).items;
  const position = ordered.findIndex((item) => item.id === finding.id);
  const previous = position > 0 ? ordered[position - 1] : null;
  const next = position >= 0 && position < ordered.length - 1 ? ordered[position + 1] : null;
  const findingHref = (id: string) => `${base}/findings/${id}${back ? `?back=${encodeURIComponent(backHref)}` : ""}`;

  const context = findingContext(finding, data);
  const mentioned = mentionedEntities(finding, data);
  const affectedRequirement = context.entityType === "requirement" ? (context.entity as Requirement | null) : null;
  const relatedRequirements = [
    ...context.relatedRequirements.filter((requirement) => requirement.id !== finding.entityId),
    ...mentioned.requirements
  ].filter((requirement, index, all) => all.findIndex((other) => other.id === requirement.id) === index);
  const linkedWork = affectedRequirement ? linkedWorkItems(affectedRequirement, data) : [];
  const linkedTests = affectedRequirement ? linkedTestCases(affectedRequirement, data) : [];
  const requirementHref = (externalId: string) =>
    `${base}/requirements/${encodeURIComponent(externalId)}?back=${encodeURIComponent(findingHref(finding.id))}`;

  return (
    <PageShell project={data.project}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <Link href={backHref} className={textLinkClass}>
          ← {backLabel}
        </Link>
        {ordered.length > 1 && position >= 0 ? (
          <nav aria-label="Adjacent findings" className="flex items-center gap-4">
            <span className="text-[var(--muted)]">
              {position + 1} of {ordered.length}
            </span>
            {previous ? (
              <Link href={findingHref(previous.id)} className={textLinkClass}>
                ← Previous
              </Link>
            ) : null}
            {next ? (
              <Link href={findingHref(next.id)} className={textLinkClass}>
                Next →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className={`${panelClass} min-w-0 p-5`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-0.5 text-xs font-medium uppercase ${severityBadgeClass[finding.severity]}`}>
              {finding.severity}
            </span>
            <span className="text-sm text-[var(--muted)]">{sentenceLabel(finding.category)}</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold [overflow-wrap:anywhere]">{finding.title}</h1>

          <div className="mt-5">
            <h2 className={labelClass}>What Doorframe found</h2>
            <p className="mt-2 whitespace-pre-wrap">{finding.description}</p>
          </div>

          {affectedRequirement ? (
            <div className="mt-5">
              <h2 className={labelClass}>{finding.category === "duplicate_candidate" ? "Compare the texts" : "Requirement text"}</h2>
              <div className={`mt-2 grid gap-3 ${finding.category === "duplicate_candidate" && mentioned.requirements.length > 0 ? "md:grid-cols-2" : ""}`}>
                <RequirementText requirement={affectedRequirement} terms={flaggedTerms(finding)} />
                {finding.category === "duplicate_candidate"
                  ? mentioned.requirements.map((requirement) => (
                      <RequirementText key={requirement.id} requirement={requirement} />
                    ))
                  : null}
              </div>
            </div>
          ) : null}

          <div className="mt-6 border-l-4 border-l-[var(--accent)] bg-[var(--background)] p-4">
            <h2 className="font-semibold">Recommended next step</h2>
            <p className="mt-1 text-sm">
              {finding.recommendation ?? "Review the affected record and its trace links, then update the source export."}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              After you fix the source data, re-import it on the{" "}
              <Link href={`${base}/imports`} className={textLinkClass}>
                Imports
              </Link>{" "}
              page. Analysis runs automatically after each import.
            </p>
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <section className={`${panelClass} p-4`}>
            <h2 className="font-semibold">Affected record</h2>
            {context.entity ? (
              <dl className="mt-3 grid gap-3 text-sm">
                <div>
                  <dt className={labelClass}>Type</dt>
                  <dd>{entityTypeLabels[context.entityType]}</dd>
                </div>
                <div>
                  <dt className={labelClass}>ID</dt>
                  <dd className="font-medium [overflow-wrap:anywhere]">
                    {affectedRequirement ? (
                      <Link href={requirementHref(affectedRequirement.externalId)} className={textLinkClass}>
                        {affectedRequirement.externalId} →
                      </Link>
                    ) : (
                      context.entity.externalId
                    )}
                  </dd>
                </div>
                <div>
                  <dt className={labelClass}>Title</dt>
                  <dd className="[overflow-wrap:anywhere]">{"name" in context.entity ? context.entity.name : context.entity.title}</dd>
                </div>
                {"status" in context.entity ? (
                  <div>
                    <dt className={labelClass}>Status</dt>
                    <dd className={context.entityType === "testCase" ? testStatusClass[context.entity.status] : undefined}>
                      {context.entity.status ?? <span className="text-[var(--muted)]">Not set</span>}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className={labelClass}>Source</dt>
                  <dd>{sourceTypeLabel(context.entity.source)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                The record is no longer in the imported data. Findings refresh automatically after each import.
              </p>
            )}
          </section>

          {affectedRequirement ? (
            <section className={`${panelClass} p-4`}>
              <h2 className="font-semibold">Linked evidence</h2>
              <div className="mt-2 grid gap-3 text-sm">
                <div>
                  <h3 className={labelClass}>Work items ({linkedWork.length})</h3>
                  {linkedWork.length > 0 ? (
                    <ul className="mt-1 grid gap-1">
                      {linkedWork.map((workItem) => (
                        <li key={workItem.id} className="[overflow-wrap:anywhere]">
                          {workItem.externalId} <span className="text-[var(--muted)]">· {workItem.status ?? "No status"}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[var(--warning)]">None linked.</p>
                  )}
                </div>
                <div>
                  <h3 className={labelClass}>Tests ({linkedTests.length})</h3>
                  {linkedTests.length > 0 ? (
                    <ul className="mt-1 grid gap-1">
                      {linkedTests.map((testCase) => (
                        <li key={testCase.id} className="[overflow-wrap:anywhere]">
                          {testCase.name}{" "}
                          <span className={`font-medium ${testStatusClass[testCase.status]}`}>{testCase.status}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[var(--warning)]">None linked.</p>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {mentioned.workItems.length > 0 ? (
            <section className={`${panelClass} p-4`}>
              <h2 className="font-semibold">Related work items</h2>
              <ul className="mt-2 divide-y divide-[var(--line)] text-sm">
                {mentioned.workItems.map((workItem) => (
                  <li key={workItem.id} className="py-2 [overflow-wrap:anywhere]">
                    <div className="font-medium">{workItem.externalId}</div>
                    <div>{workItem.title}</div>
                    <div className="text-[var(--muted)]">{workItem.status ?? "No status"}</div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={`${panelClass} p-4`}>
            <h2 className="font-semibold">{affectedRequirement ? "Other related requirements" : "Related requirements"}</h2>
            <div className="mt-2 divide-y divide-[var(--line)] text-sm">
              {relatedRequirements.map((requirement) => (
                <Link
                  key={requirement.id}
                  href={requirementHref(requirement.externalId)}
                  className="group -mx-2 block px-2 py-3 hover:bg-[var(--panel-strong)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--accent-strong)]">{requirement.externalId}</div>
                      <div className="[overflow-wrap:anywhere]">{requirement.title}</div>
                    </div>
                    <span aria-hidden="true" className="text-[var(--muted)] group-hover:text-[var(--accent-strong)]">
                      →
                    </span>
                  </div>
                </Link>
              ))}
              {relatedRequirements.length === 0 ? (
                <div className="py-2 text-[var(--muted)]">None.</div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
