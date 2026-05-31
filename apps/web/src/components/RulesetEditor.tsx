"use client";

import { useState } from "react";
import type { Ruleset } from "@doorframe/core";

const FINDING_CATEGORIES = [
  "missing_verification",
  "missing_work_trace",
  "weak_wording",
  "multi_requirement",
  "non_verifiable",
  "duplicate_candidate",
  "stale_link",
  "closed_work_without_verification",
  "custom_rule"
] as const;

const label = { display: "block", fontWeight: 600, marginBottom: 4, fontSize: 14 } as const;
const field = { width: "100%", padding: 8, border: "1px solid #d3d8cf", borderRadius: 4, fontFamily: "monospace", fontSize: 13 } as const;
const section = { margin: "20px 0", padding: 16, border: "1px solid #e0e4db", borderRadius: 6 } as const;

export function RulesetEditor({ projectId, initial }: { projectId: string; initial: Ruleset }) {
  const [vagueTerms, setVagueTerms] = useState(initial.analyzer.vagueTerms.join(", "));
  const [jaccard, setJaccard] = useState(String(initial.analyzer.jaccardThreshold));
  const [minSignals, setMinSignals] = useState(String(initial.analyzer.nonVerifiableMinSignals));
  const [closed, setClosed] = useState(initial.analyzer.closedStatuses.join(", "));
  const [draft, setDraft] = useState(initial.analyzer.draftStatuses.join(", "));
  const [disabled, setDisabled] = useState<string[]>(initial.analyzer.disabledCategories);
  const [patterns, setPatterns] = useState(JSON.stringify(initial.requirementIdPatterns, null, 2));
  const [customRules, setCustomRules] = useState(JSON.stringify(initial.customRules, null, 2));
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toList(value: string): string[] {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const ruleset: Ruleset = {
        requirementIdPatterns: JSON.parse(patterns),
        analyzer: {
          vagueTerms: toList(vagueTerms),
          jaccardThreshold: Number(jaccard),
          nonVerifiableMinSignals: Number(minSignals),
          closedStatuses: toList(closed),
          draftStatuses: toList(draft),
          disabledCategories: disabled as Ruleset["analyzer"]["disabledCategories"]
        },
        customRules: JSON.parse(customRules)
      };

      const response = await fetch(`/api/projects/${projectId}/ruleset`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruleset)
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save ruleset.");
      }
      setStatus("Saved. Analysis re-run with the new ruleset.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save ruleset.");
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(category: string) {
    setDisabled((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category]
    );
  }

  return (
    <div>
      <div style={section}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Analyzer thresholds</h2>
        <label style={label}>Vague terms (comma separated)</label>
        <textarea style={{ ...field, minHeight: 60 }} value={vagueTerms} onChange={(e) => setVagueTerms(e.target.value)} />
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Duplicate Jaccard threshold</label>
            <input style={field} value={jaccard} onChange={(e) => setJaccard(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Non-verifiable min signals</label>
            <input style={field} value={minSignals} onChange={(e) => setMinSignals(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Closed statuses</label>
            <input style={field} value={closed} onChange={(e) => setClosed(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Draft statuses</label>
            <input style={field} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={section}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Disabled finding categories</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {FINDING_CATEGORIES.map((category) => (
            <label key={category} style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={disabled.includes(category)}
                onChange={() => toggleCategory(category)}
              />{" "}
              {category}
            </label>
          ))}
        </div>
      </div>

      <div style={section}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Requirement ID patterns (JSON)</h2>
        <textarea style={{ ...field, minHeight: 120 }} value={patterns} onChange={(e) => setPatterns(e.target.value)} />
      </div>

      <div style={section}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Custom rules (JSON)</h2>
        <textarea style={{ ...field, minHeight: 140 }} value={customRules} onChange={(e) => setCustomRules(e.target.value)} />
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{
          background: "var(--accent-strong)",
          color: "#fff",
          padding: "10px 18px",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 14
        }}
      >
        {saving ? "Saving…" : "Save ruleset"}
      </button>
      {status ? <p style={{ marginTop: 12, fontSize: 14 }}>{status}</p> : null}
    </div>
  );
}
