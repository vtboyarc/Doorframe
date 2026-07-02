"use client";

import { useState } from "react";
import type { Ruleset } from "@doorframe/core";
import { humanize } from "@/lib/severity";
import { panelClass } from "@/lib/ui";

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

const sectionClass = `${panelClass} p-4`;
const labelClass = "block text-sm font-medium";
const fieldClass = `mt-1 w-full ${panelClass} px-3 py-2 font-mono text-sm`;

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
    <div className="space-y-4">
      <div className={sectionClass}>
        <h2 className="text-lg font-semibold">Analyzer thresholds</h2>
        <div className="mt-3">
          <label className={labelClass}>Vague terms (comma separated)</label>
          <textarea
            className={`${fieldClass} min-h-[60px]`}
            value={vagueTerms}
            onChange={(e) => setVagueTerms(e.target.value)}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Duplicate Jaccard threshold</label>
            <input className={fieldClass} value={jaccard} onChange={(e) => setJaccard(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Non-verifiable min signals</label>
            <input className={fieldClass} value={minSignals} onChange={(e) => setMinSignals(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Closed statuses</label>
            <input className={fieldClass} value={closed} onChange={(e) => setClosed(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Draft statuses</label>
            <input className={fieldClass} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className="text-lg font-semibold">Disabled finding categories</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FINDING_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={disabled.includes(category)}
                onChange={() => toggleCategory(category)}
              />
              <span className="capitalize">{humanize(category)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className="text-lg font-semibold">Requirement ID patterns (JSON)</h2>
        <textarea
          className={`${fieldClass} mt-3 min-h-[120px]`}
          value={patterns}
          onChange={(e) => setPatterns(e.target.value)}
        />
      </div>

      <div className={sectionClass}>
        <h2 className="text-lg font-semibold">Custom rules (JSON)</h2>
        <textarea
          className={`${fieldClass} mt-3 min-h-[140px]`}
          value={customRules}
          onChange={(e) => setCustomRules(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="min-h-10 border border-[var(--accent-strong)] bg-[var(--accent)] px-4 text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save ruleset"}
        </button>
        {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
      </div>
    </div>
  );
}
