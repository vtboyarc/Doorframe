"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImportMessageList } from "@/components/ImportMessageList";
import { requestRemoveRecords } from "@/lib/import-client";
import {
  entityCount,
  findingsSentence,
  keepOrRemoveText,
  importedSentence,
  linksSentence,
  missingRecordsText,
  removeConfirmText,
  removedSummaryText,
  removeMissingLabel
} from "@/lib/import-messages";
import { MAX_REMOVABLE_RECORDS, type ImportResponse, type MissingRecords, type RemoveRecordsResponse } from "@/lib/import-types";
import { dangerButtonClass, secondaryButtonClass, textLinkClass } from "@/lib/ui";

type RemovalState =
  | { status: "idle" }
  | { status: "confirming" }
  | { status: "removing" }
  | { status: "removed"; result: RemoveRecordsResponse }
  | { status: "error"; message: string };

/** Outcome of the latest import: what changed, where to go next, and records the file no longer has. */
export function ImportResultPanel({ projectId, result }: { projectId: string; result: ImportResponse }) {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const imported = result.status === "imported";
  const tone = imported
    ? "border-[var(--success)] bg-[var(--success-soft)]"
    : "border-[var(--warning)] bg-[var(--warning-soft)]";

  return (
    <section aria-label="Import result" className={`min-w-0 border p-4 ${tone}`}>
      {imported ? (
        <>
          <p className="break-words font-medium [overflow-wrap:anywhere]">{importedSentence(result)}</p>
          <p className="mt-1 text-sm">
            {linksSentence(result.linkCount)} {findingsSentence(result.findingCount)}
          </p>
          <nav aria-label="Next steps" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            <Link href={`${base}/findings`} className={textLinkClass}>
              Review findings →
            </Link>
            <Link href={`${base}/requirements`} className={textLinkClass}>
              View requirements →
            </Link>
            <Link href={`${base}/reports`} className={textLinkClass}>
              Open report →
            </Link>
          </nav>
        </>
      ) : (
        <>
          <p className="break-words font-medium [overflow-wrap:anywhere]">Nothing was imported from {result.filename}.</p>
          {result.message ? <p className="mt-1 text-sm">{result.message}</p> : null}
          {result.detail ? (
            <details className="mt-2 text-sm">
              <summary className="text-[var(--muted)]">Technical detail</summary>
              <p className="mt-1 break-words font-mono text-xs text-[var(--muted)] [overflow-wrap:anywhere]">
                {result.detail}
              </p>
            </details>
          ) : null}
        </>
      )}

      {result.errors.length > 0 ? (
        <div className="mt-3 border-t border-[var(--line-strong)] pt-3">
          <ImportMessageList messages={result.errors} />
        </div>
      ) : null}

      {imported && result.missing ? <MissingRecordsBlock projectId={projectId} missing={result.missing} /> : null}
    </section>
  );
}

function MissingRecordsBlock({ projectId, missing }: { projectId: string; missing: MissingRecords }) {
  const router = useRouter();
  const [removal, setRemoval] = useState<RemovalState>({ status: "idle" });
  const canRemove = missing.externalIds.length === missing.count;
  const confirming = removal.status === "confirming" || removal.status === "removing";

  async function removeMissing() {
    setRemoval({ status: "removing" });
    const outcome = await requestRemoveRecords(projectId, missing.entityType, missing.externalIds);
    if (!outcome.ok) {
      setRemoval({ status: "error", message: outcome.failure.message });
      return;
    }

    setRemoval({ status: "removed", result: outcome.data });
    router.refresh();
  }

  return (
    <div className="mt-3 border-t border-[var(--line-strong)] pt-3 text-sm">
      <p className="break-words [overflow-wrap:anywhere]">{missingRecordsText(missing)}</p>

      {removal.status === "removed" ? (
        <p className="mt-2 font-medium">{removedSummaryText(removal.result)}</p>
      ) : (
        <>
          <p className="mt-1 text-[var(--muted)]">{keepOrRemoveText(missing.count)}</p>

          {!canRemove ? (
            <p className="mt-2 text-[var(--muted)]">
              Doorframe removes up to {MAX_REMOVABLE_RECORDS.toLocaleString("en-US")} records at a time from this page.
              This many missing records usually means the file is a partial export.
            </p>
          ) : confirming ? (
            <div className="mt-3 border border-[var(--danger)] bg-[var(--panel)] p-3">
              <p>{removeConfirmText(missing)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={() => void removeMissing()}
                  disabled={removal.status === "removing"}
                  aria-busy={removal.status === "removing"}
                >
                  {removal.status === "removing" ? "Removing…" : `Remove ${entityCount(missing.entityType, missing.count)}`}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => setRemoval({ status: "idle" })}
                  disabled={removal.status === "removing"}
                  autoFocus
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={`mt-3 ${secondaryButtonClass}`} onClick={() => setRemoval({ status: "confirming" })}>
              {removeMissingLabel(missing.count)}
            </button>
          )}

          {removal.status === "error" ? (
            <p role="alert" className="mt-2 text-[var(--danger)]">
              {removal.message}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
