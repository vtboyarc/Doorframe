"use client";

import { useCallback, useEffect, useState } from "react";
import type { BaselineDiff } from "@doorframe/core";

interface BaselineListItem {
  id: string;
  label: string;
  createdAt: string;
  requirementCount: number;
}

const button = {
  background: "var(--accent-strong)",
  color: "#fff",
  padding: "8px 14px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 14
} as const;

const cell = { textAlign: "left" as const, borderBottom: "1px solid #d3d8cf", padding: 8 };

export function BaselinesPanel({ projectId }: { projectId: string }) {
  const [baselines, setBaselines] = useState<BaselineListItem[]>([]);
  const [label, setLabel] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("current");
  const [diff, setDiff] = useState<BaselineDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/baselines`);
    if (response.ok) {
      const items = (await response.json()) as BaselineListItem[];
      setBaselines(items);
      if (!a && items.length > 0) {
        setA(items[0].id);
      }
    }
  }, [projectId, a]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/baselines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label })
    });
    if (!response.ok) {
      setError("Failed to create baseline.");
      return;
    }
    setLabel("");
    await load();
  }

  async function runDiff() {
    setError(null);
    setDiff(null);
    const response = await fetch(`/api/projects/${projectId}/baselines/diff?a=${a}&b=${b}`);
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Failed to compute diff.");
      return;
    }
    setDiff((await response.json()) as BaselineDiff);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center" }}>
        <input
          placeholder="Baseline label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ padding: 8, border: "1px solid #d3d8cf", borderRadius: 4, flex: 1 }}
        />
        <button style={button} onClick={create}>
          Capture baseline
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={cell}>Label</th>
            <th style={cell}>Created</th>
            <th style={cell}>Requirements</th>
          </tr>
        </thead>
        <tbody>
          {baselines.length === 0 ? (
            <tr>
              <td style={cell} colSpan={3}>
                No baselines yet.
              </td>
            </tr>
          ) : (
            baselines.map((baseline) => (
              <tr key={baseline.id}>
                <td style={cell}>{baseline.label}</td>
                <td style={cell}>{new Date(baseline.createdAt).toLocaleString()}</td>
                <td style={cell}>{baseline.requirementCount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Compare</h2>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <select value={a} onChange={(e) => setA(e.target.value)} style={{ padding: 8 }}>
          {baselines.map((baseline) => (
            <option key={baseline.id} value={baseline.id}>
              {baseline.label}
            </option>
          ))}
        </select>
        <span>→</span>
        <select value={b} onChange={(e) => setB(e.target.value)} style={{ padding: 8 }}>
          <option value="current">Current state</option>
          {baselines.map((baseline) => (
            <option key={baseline.id} value={baseline.id}>
              {baseline.label}
            </option>
          ))}
        </select>
        <button style={button} onClick={runDiff} disabled={!a}>
          Diff
        </button>
      </div>

      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}

      {diff ? (
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
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
        </div>
      ) : null}
    </div>
  );
}
