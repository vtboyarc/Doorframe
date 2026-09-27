"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { BaselineDiff, RequirementFieldChange } from "@doorframe/core";
import { BASELINE_LABEL_MAX_LENGTH } from "@/lib/limits";
import { humanize } from "@/lib/severity";
import { panelClass } from "@/lib/ui";

interface BaselineListItem {
  id: string;
  label: string;
  createdAt: string;
  requirementCount: number;
  findingCount?: number;
}

const CURRENT = "current";

const buttonClass =
  "inline-flex min-h-10 shrink-0 items-center justify-center border border-[var(--accent-strong)] bg-[var(--accent)] px-4 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] hover:text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50";
const fieldClass =
  "min-h-10 w-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm transition focus:border-[var(--accent-strong)]";
const cellClass = "border-b border-[var(--line)] px-3 py-3 text-left";

const fieldLabels: Record<RequirementFieldChange["field"], string> = {
  title: "Title",
  text: "Text",
  status: "Status",
  type: "Type",
  priority: "Priority",
  verificationMethod: "Verification method",
  parentExternalId: "Parent"
};

// Compare the previous baseline with the latest one when there are two or more;
// otherwise compare the only baseline with the current project state.
function defaultSelection(items: BaselineListItem[]): { a: string; b: string } {
  if (items.length >= 2) {
    return { a: items[1].id, b: items[0].id };
  }

  return { a: items[0]?.id ?? "", b: CURRENT };
}

function hasChanges(diff: BaselineDiff): boolean {
  return (
    diff.requirements.added.length +
      diff.requirements.removed.length +
      diff.requirements.modified.length +
      diff.workItems.added.length +
      diff.workItems.removed.length +
      diff.testCases.added.length +
      diff.testCases.removed.length +
      diff.testCases.statusChanged.length +
      diff.traceLinks.added +
      diff.traceLinks.removed +
      diff.findings.added +
      diff.findings.resolved >
    0
  );
}

export function BaselinesPanel({ projectId }: { projectId: string }) {
  const [baselines, setBaselines] = useState<BaselineListItem[] | null>(null);
  const [label, setLabel] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState(CURRENT);
  const [diff, setDiff] = useState<BaselineDiff | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const load = useCallback(async (): Promise<BaselineListItem[]> => {
    try {
      const response = await fetch(`/api/projects/${projectId}/baselines`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Baselines could not be loaded.");
      }

      const items = (await response.json()) as BaselineListItem[];
      setBaselines(items);
      return items;
    } catch {
      setError("Baselines could not be loaded. Refresh the page to try again.");
      setBaselines([]);
      return [];
    }
  }, [projectId]);

  useEffect(() => {
    void load().then((items) => {
      const selection = defaultSelection(items);
      setA(selection.a);
      setB(selection.b);
    });
  }, [load]);

  // Re-run the comparison whenever the selection changes.
  useEffect(() => {
    if (!a || a === b) {
      setDiff(null);
      return;
    }

    let cancelled = false;
    setIsComparing(true);
    fetch(`/api/projects/${projectId}/baselines/diff?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`, {
      cache: "no-store"
    })
      .then(async (response) => {
        const body = (await response.json()) as BaselineDiff & { error?: string };
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setDiff(null);
          setError(body.error ?? "The comparison could not be computed.");
          return;
        }

        setError(null);
        setDiff(body);
      })
      .catch(() => {
        if (!cancelled) {
          setDiff(null);
          setError("The comparison could not be computed.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsComparing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, a, b]);

  async function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCaptureMessage(null);
    setIsCapturing(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/baselines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() })
      });
      const body = (await response.json()) as { label?: string; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "The baseline could not be captured.");
      }

      setLabel("");
      setCaptureMessage(`Captured baseline "${body.label}".`);
      const items = await load();
      const selection = defaultSelection(items);
      setA(selection.a);
      setB(selection.b);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "The baseline could not be captured.");
    } finally {
      setIsCapturing(false);
    }
  }

  const labelFor = (id: string) =>
    id === CURRENT ? "Current state" : (baselines?.find((baseline) => baseline.id === id)?.label ?? "Baseline");
  const requirementHref = (externalId: string) =>
    `/projects/${projectId}/requirements/${encodeURIComponent(externalId)}`;

  return (
    <div className="grid grid-cols-1 gap-5">
      <section className={`${panelClass} p-4`}>
        <h2 className="font-semibold">Capture current state</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Saves an immutable snapshot of the current requirements, work items, tests, trace links, and findings. Capture
          one before a review, then capture another after the next import to see what changed.
        </p>
        <form onSubmit={capture} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="baseline-label" className="sr-only">
            Baseline label
          </label>
          <input
            id="baseline-label"
            placeholder="Label, e.g. Sprint 14 review (optional)"
            value={label}
            maxLength={BASELINE_LABEL_MAX_LENGTH}
            onChange={(event) => setLabel(event.target.value)}
            className={`flex-1 ${fieldClass}`}
          />
          <button type="submit" className={buttonClass} disabled={isCapturing}>
            {isCapturing ? "Capturing…" : "Capture baseline"}
          </button>
        </form>
        {captureMessage ? (
          <p role="status" className="mt-2 text-sm text-[var(--success)]">
            {captureMessage}
          </p>
        ) : null}
      </section>

      <section className={`${panelClass} overflow-x-auto`} aria-label="Saved baselines">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="text-xs uppercase text-[var(--muted)]">
              <th className={`${cellClass} font-semibold`}>Baseline</th>
              <th className={`${cellClass} font-semibold`}>Captured</th>
              <th className={`${cellClass} text-right font-semibold`}>Requirements</th>
              <th className={`${cellClass} text-right font-semibold`}>Findings</th>
            </tr>
          </thead>
          <tbody>
            {baselines === null ? (
              <tr>
                <td className={`${cellClass} text-[var(--muted)]`} colSpan={4}>
                  Loading baselines…
                </td>
              </tr>
            ) : baselines.length === 0 ? (
              <tr>
                <td className={`${cellClass} text-[var(--muted)]`} colSpan={4}>
                  No baselines yet. Capture the current state above to start tracking changes.
                </td>
              </tr>
            ) : (
              baselines.map((baseline) => (
                <tr key={baseline.id}>
                  <td className={`${cellClass} font-medium`}>{baseline.label}</td>
                  <td className={`${cellClass} whitespace-nowrap text-[var(--muted)]`}>
                    {new Date(baseline.createdAt).toLocaleString()}
                  </td>
                  <td className={`${cellClass} text-right tabular-nums`}>{baseline.requirementCount}</td>
                  <td className={`${cellClass} text-right tabular-nums`}>{baseline.findingCount ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className={`${panelClass} p-4`}>
        <h2 className="font-semibold">Compare snapshots</h2>
        {baselines !== null && baselines.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Capture at least one baseline to compare it with the current state or with a later baseline.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pick an earlier snapshot and a later one. The comparison updates as soon as you change either side.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
              <label className="block text-sm">
                <span className="text-[var(--muted)]">From (earlier)</span>
                <select value={a} onChange={(event) => setA(event.target.value)} className={`mt-1 ${fieldClass}`}>
                  {(baselines ?? []).map((baseline) => (
                    <option key={baseline.id} value={baseline.id}>
                      {baseline.label}
                    </option>
                  ))}
                </select>
              </label>
              <span aria-hidden="true" className="hidden pb-2 text-[var(--muted)] sm:block">
                →
              </span>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">To (later)</span>
                <select value={b} onChange={(event) => setB(event.target.value)} className={`mt-1 ${fieldClass}`}>
                  <option value={CURRENT}>Current state</option>
                  {(baselines ?? []).map((baseline) => (
                    <option key={baseline.id} value={baseline.id}>
                      {baseline.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {a && a === b ? (
              <p className="mt-3 text-sm text-[var(--warning)]">Choose two different snapshots to compare.</p>
            ) : null}
          </>
        )}
      </section>

      {error ? (
        <p role="alert" className="border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {diff && a !== b ? (
        <section
          className={`${panelClass} p-4 text-sm transition-opacity ${isComparing ? "opacity-60" : ""}`}
          aria-live="polite"
          aria-busy={isComparing}
        >
          <h2 className="font-semibold">
            Changes from {labelFor(a)} to {labelFor(b)}
          </h2>

          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
            {[
              ["Requirements added", diff.requirements.added.length],
              ["Requirements removed", diff.requirements.removed.length],
              ["Requirements changed", diff.requirements.modified.length],
              ["Test status changes", diff.testCases.statusChanged.length],
              ["New findings", diff.findings.added],
              ["Resolved findings", diff.findings.resolved],
              ["Work items added / removed", `${diff.workItems.added.length} / ${diff.workItems.removed.length}`],
              ["Trace links added / removed", `${diff.traceLinks.added} / ${diff.traceLinks.removed}`]
            ].map(([name, value]) => (
              <div key={name} className="bg-[var(--panel)] p-3">
                <dt className="text-xs text-[var(--muted)]">{name}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {!hasChanges(diff) ? (
            <p className="mt-4 text-[var(--muted)]">No differences between these snapshots.</p>
          ) : null}

          {diff.requirements.modified.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-semibold">Changed requirements</h3>
              <ul className="mt-2 grid gap-3">
                {diff.requirements.modified.map((modified) => (
                  <li key={modified.externalId} className="border border-[var(--line)] p-3">
                    <Link href={requirementHref(modified.externalId)} className="font-medium text-[var(--accent-strong)] hover:underline">
                      {modified.externalId}
                    </Link>
                    <dl className="mt-2 grid gap-2">
                      {modified.changes.map((change) => (
                        <div key={change.field} className="grid gap-1 sm:grid-cols-[140px_1fr]">
                          <dt className="text-xs uppercase text-[var(--muted)]">{fieldLabels[change.field]}</dt>
                          <dd className="grid gap-1">
                            <div className="border-l-2 border-l-[var(--danger)] bg-[var(--danger-soft)] px-2 py-1">
                              <span className="sr-only">Before: </span>
                              {change.before || <span className="text-[var(--muted)]">(empty)</span>}
                            </div>
                            <div className="border-l-2 border-l-[var(--success)] bg-[var(--success-soft)] px-2 py-1">
                              <span className="sr-only">After: </span>
                              {change.after || <span className="text-[var(--muted)]">(empty)</span>}
                            </div>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {diff.requirements.added.length > 0 || diff.requirements.removed.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold">Added requirements</h3>
                {diff.requirements.added.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {diff.requirements.added.map((externalId) => (
                      <li key={externalId}>
                        <Link
                          href={requirementHref(externalId)}
                          className="inline-block border border-[var(--success)] px-2 py-0.5 text-[var(--success)] hover:underline"
                        >
                          {externalId}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[var(--muted)]">None.</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold">Removed requirements</h3>
                {diff.requirements.removed.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {diff.requirements.removed.map((externalId) => (
                      <li key={externalId} className="border border-[var(--danger)] px-2 py-0.5 text-[var(--danger)]">
                        {externalId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[var(--muted)]">None.</p>
                )}
              </div>
            </div>
          ) : null}

          {diff.testCases.statusChanged.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-semibold">Test status changes</h3>
              <ul className="mt-2 grid gap-1">
                {diff.testCases.statusChanged.map((change) => (
                  <li key={change.externalId} className="break-words">
                    <span className="font-medium">{change.externalId}</span>: {change.before} → {change.after}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {Object.keys(diff.findings.byCategory).length > 0 ? (
            <div className="mt-6 overflow-x-auto">
              <h3 className="font-semibold">Findings by category</h3>
              <table className="mt-2 w-full border-collapse">
                <thead>
                  <tr className="text-xs uppercase text-[var(--muted)]">
                    <th className={`${cellClass} font-semibold`}>Category</th>
                    <th className={`${cellClass} text-right font-semibold`}>New</th>
                    <th className={`${cellClass} text-right font-semibold`}>Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(diff.findings.byCategory).map(([category, change]) => (
                    <tr key={category}>
                      <td className={`${cellClass} capitalize`}>{humanize(category)}</td>
                      <td className={`${cellClass} text-right tabular-nums`}>{change.added}</td>
                      <td className={`${cellClass} text-right tabular-nums`}>{change.removed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
