"use client";

import { useCallback, useEffect, useState } from "react";
import type { BaselineDiff } from "@doorframe/core";
import { panelClass } from "@/lib/ui";

interface BaselineListItem {
  id: string;
  label: string;
  createdAt: string;
  requirementCount: number;
}

const buttonClass =
  "min-h-10 border border-[var(--accent-strong)] bg-[var(--accent)] px-4 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50";
const fieldClass =
  "min-h-10 border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none transition focus:border-[var(--accent-strong)]";
const cellClass = "border-b border-[var(--line)] px-3 py-3 text-left";

export function BaselinesPanel({ projectId }: { projectId: string }) {
  const [baselines, setBaselines] = useState<BaselineListItem[]>([]);
  const [label, setLabel] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("current");
  const [diff, setDiff] = useState<BaselineDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/baselines`);
    if (response.ok) {
      const items = (await response.json()) as BaselineListItem[];
      setBaselines(items);
      setA((current) => current || items[0]?.id || "");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setError(null);
    setIsWorking(true);
    const response = await fetch(`/api/projects/${projectId}/baselines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label })
    });
    if (!response.ok) {
      setError("Failed to create baseline.");
      setIsWorking(false);
      return;
    }
    setLabel("");
    await load();
    setIsWorking(false);
  }

  async function runDiff() {
    setError(null);
    setDiff(null);
    setIsWorking(true);
    const response = await fetch(`/api/projects/${projectId}/baselines/diff?a=${a}&b=${b}`);
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Failed to compute diff.");
      setIsWorking(false);
      return;
    }
    setDiff((await response.json()) as BaselineDiff);
    setIsWorking(false);
  }

  return (
    <div className="grid gap-5">
      <section className={`${panelClass} p-4`}>
        <h2 className="font-semibold">Capture current state</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Create a named, immutable snapshot for a later comparison.</p>
        <div className="mt-4 flex items-center gap-2">
          <input
            placeholder="Baseline label"
            aria-label="Baseline label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={`flex-1 ${fieldClass}`}
          />
          <button type="button" className={buttonClass} onClick={create} disabled={isWorking || !label.trim()}>
            {isWorking ? "Working…" : "Capture baseline"}
          </button>
        </div>
      </section>

      <div className={`${panelClass} overflow-hidden`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={cellClass}>Label</th>
              <th className={cellClass}>Created</th>
              <th className={cellClass}>Requirements</th>
            </tr>
          </thead>
          <tbody>
            {baselines.length === 0 ? (
              <tr>
                <td className={`${cellClass} text-[var(--muted)]`} colSpan={3}>
                  No baselines yet.
                </td>
              </tr>
            ) : (
              baselines.map((baseline) => (
                <tr key={baseline.id}>
                  <td className={cellClass}>{baseline.label}</td>
                  <td className={`${cellClass} font-mono text-xs text-[var(--muted)]`}>
                    {new Date(baseline.createdAt).toLocaleString()}
                  </td>
                  <td className={cellClass}>{baseline.requirementCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className={`${panelClass} p-4`}>
        <h2 className="font-semibold">Compare snapshots</h2>
        <div className="mt-4 flex items-center gap-2">
          <select aria-label="Starting baseline" value={a} onChange={(e) => setA(e.target.value)} className={fieldClass}>
            {baselines.map((baseline) => (
              <option key={baseline.id} value={baseline.id}>
                {baseline.label}
              </option>
            ))}
          </select>
          <span>→</span>
          <select aria-label="Comparison baseline" value={b} onChange={(e) => setB(e.target.value)} className={fieldClass}>
            <option value="current">Current state</option>
            {baselines.map((baseline) => (
              <option key={baseline.id} value={baseline.id}>
                {baseline.label}
              </option>
            ))}
          </select>
          <button type="button" className={buttonClass} onClick={runDiff} disabled={isWorking || !a}>
            Compare
          </button>
        </div>
      </section>

      {error ? (
        <p role="alert" className="border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {diff ? (
        <section className={`${panelClass} p-4 text-sm leading-relaxed`} aria-live="polite">
          <h2 className="mb-3 font-semibold">Comparison result</h2>
          <p>
            <strong>Requirements:</strong> +{diff.requirements.added.length} added, -
            {diff.requirements.removed.length} removed, {diff.requirements.modified.length} modified
          </p>
          {diff.requirements.added.length > 0 ? <p>Added: {diff.requirements.added.join(", ")}</p> : null}
          {diff.requirements.removed.length > 0 ? <p>Removed: {diff.requirements.removed.join(", ")}</p> : null}
          {diff.requirements.modified.length > 0 ? (
            <ul>
              {diff.requirements.modified.map((mod) => (
                <li key={mod.externalId}>
                  {mod.externalId}: {mod.changes.map((change) => change.field).join(", ")}
                </li>
              ))}
            </ul>
          ) : null}
          <p>
            <strong>Work items:</strong> +{diff.workItems.added.length} / -{diff.workItems.removed.length}
          </p>
          <p>
            <strong>Tests:</strong> +{diff.testCases.added.length} / -{diff.testCases.removed.length},{" "}
            {diff.testCases.statusChanged.length} status change(s)
          </p>
          <p>
            <strong>Findings:</strong> {diff.findings.added} added, {diff.findings.resolved} resolved
          </p>
        </section>
      ) : null}
    </div>
  );
}
