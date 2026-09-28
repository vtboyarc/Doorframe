"use client";

import { ArrowLeftRight, Download } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { BaselineDiff, RequirementFieldChange } from "@doorframe/core";
import type { BaselineDiffDetails } from "@/lib/baseline-details";
import { baselinesUrl, CURRENT_STATE, defaultSelection, selectionFromParams } from "@/lib/baseline-selection";
import { sentenceLabel } from "@/lib/labels";
import { BASELINE_LABEL_MAX_LENGTH } from "@/lib/limits";
import { severityBadgeClass } from "@/lib/severity";
import { fieldClass, labelClass, panelClass, primaryButtonClass, secondaryButtonClass, textLinkClass } from "@/lib/ui";
import { useUrlState } from "@/lib/use-url-state";

interface BaselineListItem {
  id: string;
  label: string;
  createdAt: string;
  requirementCount: number;
  findingCount?: number;
}

type DiffResponse = BaselineDiff & { details: BaselineDiffDetails };

const fieldLabels: Record<RequirementFieldChange["field"], string> = {
  title: "Title",
  text: "Text",
  status: "Status",
  type: "Type",
  priority: "Priority",
  verificationMethod: "Verification method",
  parentExternalId: "Parent"
};

const concernClass = {
  high: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
  medium: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
  low: "border-[var(--line-strong)] text-[var(--muted)]"
} as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function totalChanges(details: BaselineDiffDetails, diff: BaselineDiff): number {
  return (
    details.addedRequirements.length +
    details.removedRequirements.length +
    details.changedRequirements.length +
    diff.workItems.added.length +
    diff.workItems.removed.length +
    diff.testCases.added.length +
    diff.testCases.removed.length +
    diff.testCases.statusChanged.length +
    details.addedLinks.length +
    details.removedLinks.length +
    details.newFindings.length +
    details.resolvedFindings.length
  );
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

function requestError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) {
    return "Could not reach the local Doorframe server. Check that it is still running.";
  }

  return error instanceof Error ? error.message : fallback;
}

export function BaselinesPanel({ projectId, hasData }: { projectId: string; hasData: boolean }) {
  const [baselines, setBaselines] = useState<BaselineListItem[] | null>(null);
  const [label, setLabel] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState(CURRENT_STATE);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const load = useCallback(async (): Promise<BaselineListItem[]> => {
    try {
      const response = await fetch(`/api/projects/${projectId}/baselines`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error();
      }

      const items = (await response.json()) as BaselineListItem[];
      setBaselines(items);
      return items;
    } catch {
      setCompareError("Baselines could not be loaded. Refresh the page to try again.");
      setBaselines([]);
      return [];
    }
  }, [projectId]);

  // Start from the comparison named in the URL (?a=&b=), so browser Back and "Back to baselines"
  // return to it; otherwise compare the two latest snapshots.
  useEffect(() => {
    void load().then((items) => {
      const selection = selectionFromParams(items, new URLSearchParams(window.location.search));
      setA(selection.a);
      setB(selection.b);
    });
  }, [load]);

  // Keep the selection in the URL once the baselines are loaded, and follow the URL when it
  // changes from outside (the Baselines tab, browser Back or Forward).
  useUrlState(baselines ? baselinesUrl(projectId, { a, b }) : null, (params) => {
    if (baselines) {
      const selection = selectionFromParams(baselines, params);
      setA(selection.a);
      setB(selection.b);
    }
  });

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
        if (!response.ok) {
          throw new Error(await errorMessage(response, "The comparison could not be computed."));
        }
        const body = (await response.json()) as DiffResponse;
        if (!cancelled) {
          setCompareError(null);
          setDiff(body);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDiff(null);
          setCompareError(requestError(error, "The comparison could not be computed."));
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
    setCaptureError(null);
    setCaptureMessage(null);
    setIsCapturing(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/baselines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() })
      });
      if (!response.ok) {
        throw new Error(
          await errorMessage(
            response,
            "The baseline could not be captured. Check that the Doorframe data folder is writable and try again."
          )
        );
      }

      const body = (await response.json()) as { label: string };
      setLabel("");
      setCaptureMessage(`Captured baseline "${body.label}".`);
      const items = await load();
      const selection = defaultSelection(items);
      setA(selection.a);
      setB(selection.b);
    } catch (error) {
      setCaptureError(requestError(error, "The baseline could not be captured."));
    } finally {
      setIsCapturing(false);
    }
  }

  const byId = new Map((baselines ?? []).map((baseline) => [baseline.id, baseline]));
  const labelFor = (id: string) => (id === CURRENT_STATE ? "Current state" : (byId.get(id)?.label ?? "Baseline"));
  const optionLabel = (baseline: BaselineListItem) => `${baseline.label} · ${formatDate(baseline.createdAt)}`;
  const createdAt = (id: string) =>
    id === CURRENT_STATE ? Number.POSITIVE_INFINITY : Date.parse(byId.get(id)?.createdAt ?? "");
  const reversed = Boolean(a) && a !== b && createdAt(a) > createdAt(b);
  const requirementHref = (externalId: string) =>
    `/projects/${projectId}/requirements/${encodeURIComponent(externalId)}?back=${encodeURIComponent(
      baselinesUrl(projectId, { a, b })
    )}`;
  const details = diff?.details;

  return (
    <div className="grid grid-cols-1 gap-5">
      <section className={`${panelClass} p-4`} aria-labelledby="capture-heading">
        <h2 id="capture-heading" className="font-semibold">
          Capture current state
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Saves an immutable snapshot of the current requirements, work items, tests, trace links, and findings. Capture one
          before a review, then capture another after the next import to see what changed.
        </p>
        {hasData ? (
          <form onSubmit={capture} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="baseline-label" className="sr-only">
              Baseline label
            </label>
            <input
              id="baseline-label"
              placeholder="Label, e.g. Sprint 14 review (optional)"
              value={label}
              maxLength={BASELINE_LABEL_MAX_LENGTH}
              onChange={(event) => {
                setLabel(event.target.value);
                setCaptureError(null);
              }}
              className={`flex-1 ${fieldClass}`}
            />
            <button type="submit" className={primaryButtonClass} disabled={isCapturing} aria-busy={isCapturing}>
              {isCapturing ? "Capturing…" : "Capture baseline"}
            </button>
          </form>
        ) : (
          <p className="mt-3 border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm">
            Import requirements before capturing a baseline.{" "}
            <Link href={`/projects/${projectId}/imports`} className={textLinkClass}>
              Go to Imports
            </Link>
          </p>
        )}
        {captureMessage ? (
          <p role="status" className="mt-2 text-sm text-[var(--success)]">
            {captureMessage}
          </p>
        ) : null}
        {captureError ? (
          <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
            {captureError}
          </p>
        ) : null}
      </section>

      <section className={panelClass} aria-label="Saved baselines">
        {baselines === null ? (
          <p className="p-4 text-sm text-[var(--muted)]">Loading baselines…</p>
        ) : baselines.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">No baselines yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase text-[var(--muted)]">
                  <th className="border-b border-[var(--line)] px-3 py-3 text-left font-semibold">Baseline</th>
                  <th className="border-b border-[var(--line)] px-3 py-3 text-left font-semibold">Captured</th>
                  <th className="border-b border-[var(--line)] px-3 py-3 text-right font-semibold">Requirements</th>
                  <th className="border-b border-[var(--line)] px-3 py-3 text-right font-semibold">Findings</th>
                </tr>
              </thead>
              <tbody>
                {baselines.map((baseline) => (
                  <tr key={baseline.id} className="border-b border-[var(--line)] last:border-b-0">
                    <td className="px-3 py-3 font-medium [overflow-wrap:anywhere]">{baseline.label}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-[var(--muted)]">{formatDate(baseline.createdAt)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{baseline.requirementCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{baseline.findingCount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${panelClass} p-4`} aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="font-semibold">
          Compare snapshots
        </h2>
        {baselines === null ? (
          <p className="mt-1 text-sm text-[var(--muted)]">Loading baselines…</p>
        ) : baselines.length === 0 ? (
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
                  {baselines.map((baseline) => (
                    <option key={baseline.id} value={baseline.id}>
                      {optionLabel(baseline)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (b !== CURRENT_STATE) {
                    setA(b);
                    setB(a);
                  }
                }}
                disabled={b === CURRENT_STATE}
                title={b === CURRENT_STATE ? "Current state is always the later side" : "Swap From and To"}
                aria-label="Swap From and To"
                className={`${secondaryButtonClass} justify-self-start px-3`}
              >
                <ArrowLeftRight size={16} aria-hidden="true" />
              </button>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">To (later)</span>
                <select value={b} onChange={(event) => setB(event.target.value)} className={`mt-1 ${fieldClass}`}>
                  <option value={CURRENT_STATE}>Current state</option>
                  {baselines.map((baseline) => (
                    <option key={baseline.id} value={baseline.id}>
                      {optionLabel(baseline)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {a && a === b ? (
              <p className="mt-3 text-sm text-[var(--warning)]">Choose two different snapshots to compare.</p>
            ) : null}
            {reversed ? (
              <p className="mt-3 text-sm text-[var(--warning)]">
                &ldquo;From&rdquo; is newer than &ldquo;To&rdquo;, so additions appear as removals. Use the swap button to
                reverse them.
              </p>
            ) : null}
            {isComparing && !diff ? <p className="mt-3 text-sm text-[var(--muted)]">Comparing…</p> : null}
            {compareError ? (
              <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
                {compareError}
              </p>
            ) : null}
          </>
        )}
      </section>

      {diff && details && a !== b ? (
        <section
          className={`${panelClass} p-4 text-sm transition-opacity ${isComparing ? "opacity-60" : ""}`}
          aria-busy={isComparing}
          aria-labelledby="diff-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="diff-heading" className="min-w-0 font-semibold [overflow-wrap:anywhere]">
              Changes from {labelFor(a)} to {labelFor(b)}
            </h2>
            <a
              href={`/api/projects/${projectId}/baselines/diff?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&format=html&download=1`}
              className={secondaryButtonClass}
            >
              <Download size={16} aria-hidden="true" />
              Download diff report (HTML)
            </a>
          </div>
          <p className="sr-only" role="status">
            Comparison updated: {details.addedRequirements.length} added, {details.removedRequirements.length} removed,{" "}
            {details.changedRequirements.length} changed requirements.
          </p>

          {/* Each value sits at the bottom of its tile, so values in a row line up when a long name wraps. */}
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
            {[
              ["Requirements added", details.addedRequirements.length],
              ["Requirements removed", details.removedRequirements.length],
              ["Requirements changed", details.changedRequirements.length],
              [
                "Tests added / removed / status changed",
                `${diff.testCases.added.length} / ${diff.testCases.removed.length} / ${diff.testCases.statusChanged.length}`
              ],
              ["New findings", details.newFindings.length],
              ["Resolved findings", details.resolvedFindings.length],
              ["Work items added / removed", `${diff.workItems.added.length} / ${diff.workItems.removed.length}`],
              ["Trace links added / removed", `${details.addedLinks.length} / ${details.removedLinks.length}`]
            ].map(([name, value]) => (
              <div key={name} className="flex flex-col justify-between bg-[var(--panel)] p-3">
                <dt className="text-xs text-[var(--muted)]">{name}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {totalChanges(details, diff) === 0 ? (
            <p className="mt-4 text-[var(--muted)]">No differences between these snapshots.</p>
          ) : null}

          {details.changedRequirements.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-semibold">Changed requirements</h3>
              <ul className="mt-2 grid gap-3">
                {details.changedRequirements.map((changed) => (
                  <li key={changed.externalId} className="border border-[var(--line)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={requirementHref(changed.externalId)} className={`font-medium ${textLinkClass}`}>
                        {changed.externalId}
                      </Link>
                      <span className="[overflow-wrap:anywhere]">{changed.title}</span>
                      <span
                        className={`border px-1.5 py-0.5 text-xs font-medium uppercase ${concernClass[changed.concern]}`}
                      >
                        {changed.concern} concern
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-3">
                      {changed.changes.map((change) => (
                        <div key={change.field} className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)]">
                          <dt className={labelClass}>{fieldLabels[change.field]}</dt>
                          <dd className="[overflow-wrap:anywhere]">
                            {change.wordDiff ? (
                              <p className="leading-7">
                                {change.wordDiff.map((token, index) => (
                                  <span key={index}>
                                    {token.type === "removed" ? (
                                      <del className="bg-[var(--danger-soft)] px-0.5 text-[var(--danger)]">
                                        {token.value}
                                      </del>
                                    ) : token.type === "added" ? (
                                      <ins className="bg-[var(--success-soft)] px-0.5 text-[var(--success)] no-underline">
                                        {token.value}
                                      </ins>
                                    ) : (
                                      token.value
                                    )}{" "}
                                  </span>
                                ))}
                              </p>
                            ) : (
                              <p>
                                <span className="text-[var(--muted)] line-through">{change.before || "(empty)"}</span>
                                <span aria-hidden="true"> → </span>
                                <span className="sr-only"> changed to </span>
                                <span className="font-medium">{change.after || "(empty)"}</span>
                              </p>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {changed.affectedWorkItems.length > 0 || changed.affectedTests.length > 0 ? (
                      <p className="mt-3 text-[var(--muted)] [overflow-wrap:anywhere]">
                        <span className="font-medium text-[var(--foreground)]">Re-check:</span>{" "}
                        {[...changed.affectedWorkItems, ...changed.affectedTests].join(", ")}
                      </p>
                    ) : null}
                    {changed.recommendations.length > 0 ? (
                      <ul className="mt-2 list-inside list-disc text-[var(--muted)]">
                        {changed.recommendations.map((recommendation) => (
                          <li key={recommendation}>{recommendation}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {details.addedRequirements.length > 0 || details.removedRequirements.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold">Added requirements</h3>
                {details.addedRequirements.length > 0 ? (
                  <ul className="mt-2 grid gap-1">
                    {details.addedRequirements.map((requirement) => (
                      <li key={requirement.externalId} className="[overflow-wrap:anywhere]">
                        <span className="mr-1 font-mono text-[var(--success)]" aria-hidden="true">
                          +
                        </span>
                        <Link href={requirementHref(requirement.externalId)} className={textLinkClass}>
                          {requirement.externalId}
                        </Link>{" "}
                        <span className="text-[var(--muted)]">{requirement.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[var(--muted)]">None.</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold">Removed requirements</h3>
                {details.removedRequirements.length > 0 ? (
                  <ul className="mt-2 grid gap-1">
                    {details.removedRequirements.map((requirement) => (
                      <li key={requirement.externalId} className="[overflow-wrap:anywhere]">
                        <span className="mr-1 font-mono text-[var(--danger)]" aria-hidden="true">
                          −
                        </span>
                        {requirement.externalId} <span className="text-[var(--muted)]">{requirement.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[var(--muted)]">None.</p>
                )}
              </div>
            </div>
          ) : null}

          {details.newFindings.length > 0 || details.resolvedFindings.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["New findings", details.newFindings],
                  ["Resolved findings", details.resolvedFindings]
                ] as const
              ).map(([heading, items]) => (
                <div key={heading}>
                  <h3 className="font-semibold">{heading}</h3>
                  {items.length > 0 ? (
                    <ul className="mt-2 grid gap-2">
                      {items.map((finding) => (
                        <li key={`${finding.category}-${finding.title}`} className="[overflow-wrap:anywhere]">
                          <span
                            className={`mr-2 border px-1.5 py-0.5 text-xs font-medium uppercase ${severityBadgeClass[finding.severity]}`}
                          >
                            {finding.severity}
                          </span>
                          {finding.title}
                          <span className="text-[var(--muted)]"> · {sentenceLabel(finding.category)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[var(--muted)]">None.</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {diff.testCases.statusChanged.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-semibold">Test status changes</h3>
              <ul className="mt-2 grid gap-1">
                {diff.testCases.statusChanged.map((change) => (
                  <li key={change.externalId} className="[overflow-wrap:anywhere]">
                    <span className="font-medium">{change.externalId}</span>: {change.before} → {change.after}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {details.addedLinks.length > 0 || details.removedLinks.length > 0 ? (
            <details className="mt-6 border border-[var(--line)]">
              <summary className="px-3 py-2 font-medium">
                Trace link changes ({details.addedLinks.length} added, {details.removedLinks.length} removed)
              </summary>
              <ul className="grid gap-1 border-t border-[var(--line)] p-3 font-mono text-xs">
                {details.addedLinks.map((link) => (
                  <li key={`added-${link}`} className="[overflow-wrap:anywhere]">
                    <span className="text-[var(--success)]">+ </span>
                    {link}
                  </li>
                ))}
                {details.removedLinks.map((link) => (
                  <li key={`removed-${link}`} className="[overflow-wrap:anywhere]">
                    <span className="text-[var(--danger)]">− </span>
                    {link}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
