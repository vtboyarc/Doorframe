import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import type { AuditEvent } from "@doorframe/core";
import { countAuditEvents, getProject, listAuditEvents } from "@/lib/db";
import { auditActionLabel } from "@/lib/labels";
import { projectPageMetadata } from "@/lib/metadata";
import { auditEventTarget } from "@/lib/view-models";
import { panelClass, textLinkClass } from "@/lib/ui";

const AUDIT_PAGE_SIZE = 200;
const AUDIT_MAX_LIMIT = 5000;

function numberDetail(details: AuditEvent["details"], key: string): number | undefined {
  const value = details?.[key];
  return typeof value === "number" ? value : undefined;
}

/** Short muted facts from the stored event details, e.g. "42 records · 12 links · 3 messages". */
function detailSummary(event: AuditEvent) {
  const records = numberDetail(event.details, "recordCount");
  const links = numberDetail(event.details, "linkCount");
  const messages = numberDetail(event.details, "errorCount");
  const parts = [
    records !== undefined ? `${records} record${records === 1 ? "" : "s"}` : null,
    links !== undefined ? `${links} link${links === 1 ? "" : "s"}` : null
  ].filter(Boolean);

  if (parts.length === 0 && !messages) {
    return null;
  }

  return (
    <div className="mt-0.5 text-xs text-[var(--muted)]">
      {parts.join(" · ")}
      {messages ? (
        <span className="text-[var(--warning)]">
          {parts.length > 0 ? " · " : ""}
          {messages} import message{messages === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}
const headerClass =
  "sticky top-0 z-10 whitespace-nowrap border-b border-[var(--line)] bg-[var(--panel)] px-3 py-3 text-left text-xs font-semibold uppercase text-[var(--muted)]";
const cellClass = "border-b border-[var(--line)] px-3 py-3 text-left align-top";

export function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  return projectPageMetadata(params, "Audit log");
}

export default async function AuditPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { projectId } = await params;
  const { limit: rawLimit } = await searchParams;
  const project = getProject(projectId);
  if (!project) {
    notFound();
  }

  const limit = Math.min(AUDIT_MAX_LIMIT, Math.max(AUDIT_PAGE_SIZE, Number(rawLimit) || AUDIT_PAGE_SIZE));
  const total = countAuditEvents(projectId);
  const events = listAuditEvents(projectId, limit);

  return (
    <PageShell project={project}>
      <PageHeader
        title="Audit log"
        description="A local record of imports, analysis runs, baselines, ruleset changes, and opened or downloaded reports. Doorframe has no user accounts, so events are attributed to the operating-system account running it."
      />
      {events.length === 0 ? (
        <p className={`${panelClass} p-4 text-sm text-[var(--muted)]`}>
          No activity recorded yet. Imports, analysis runs, and reports will appear here.
        </p>
      ) : (
        <>
          <div className={`${panelClass} max-h-[75vh] overflow-auto`}>
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={headerClass}>When</th>
                  <th className={headerClass}>Action</th>
                  <th className={headerClass}>OS user</th>
                  <th className={headerClass}>Summary</th>
                  <th className={headerClass}>
                    <span className="sr-only">Related page</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const target = auditEventTarget(projectId, event.action);

                  return (
                    <tr key={event.id} className="hover:bg-[var(--panel-strong)]">
                      <td className={`${cellClass} whitespace-nowrap text-[var(--muted)]`}>
                        <LocalTime iso={event.timestamp} />
                      </td>
                      <td className={`${cellClass} whitespace-nowrap font-medium`}>{auditActionLabel(event.action)}</td>
                      <td className={`${cellClass} whitespace-nowrap text-[var(--muted)]`}>{event.actor}</td>
                      <td className={`${cellClass} [overflow-wrap:anywhere]`}>
                        {event.summary}
                        {detailSummary(event)}
                      </td>
                      <td className={`${cellClass} whitespace-nowrap text-right`}>
                        <Link href={target.href} className={textLinkClass}>
                          {target.label} →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
            <span>
              Showing the latest {events.length} of {total} event{total === 1 ? "" : "s"}
            </span>
            {total > events.length && limit < AUDIT_MAX_LIMIT ? (
              <Link href={`/projects/${projectId}/audit?limit=${limit + AUDIT_PAGE_SIZE}`} className={textLinkClass}>
                Show older events
              </Link>
            ) : null}
          </div>
        </>
      )}
    </PageShell>
  );
}
