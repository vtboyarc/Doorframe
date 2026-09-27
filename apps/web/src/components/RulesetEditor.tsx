"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { DEFAULT_RULESET, type FindingCategory, type Ruleset } from "@doorframe/core";
import { FINDING_CATEGORIES } from "@/lib/findings";
import { sentenceLabel } from "@/lib/labels";
import {
  formValuesFromRuleset,
  NON_VERIFIABLE_SIGNAL_COUNT,
  parseRulesetForm,
  type RulesetFormField,
  type RulesetFormValues
} from "@/lib/ruleset-form";
import { fieldClass, panelClass, primaryButtonClass, secondaryButtonClass, textLinkClass } from "@/lib/ui";

const monoFieldClass = `${fieldClass} py-2 font-mono`;

const customRuleExample = `[
  {
    "id": "timing-units",
    "title": "Timing requirement without units",
    "description": "Mentions timing but gives no unit.",
    "severity": "warning",
    "condition": { "field": "text", "matches": "\\\\bwithin\\\\b", "notMatches": "\\\\b(ms|seconds?|minutes?)\\\\b" },
    "recommendation": "State the timing threshold with units."
  }
]`;

function rowsFor(value: string, min: number, max = 16): number {
  return Math.min(max, Math.max(min, value.split("\n").length + 1));
}

type Status = { tone: "success" | "error"; text: ReactNode } | null;

function Field({
  id,
  label,
  help,
  error,
  children
}: {
  id: string;
  label: string;
  help: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      <p id={`${id}-help`} className="mt-1 text-xs text-[var(--muted)]">
        {help}
      </p>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RulesetEditor({ projectId, initial }: { projectId: string; initial: Ruleset }) {
  const router = useRouter();
  const baseId = useId();
  const [saved, setSaved] = useState<RulesetFormValues>(() => formValuesFromRuleset(initial));
  const [values, setValues] = useState<RulesetFormValues>(saved);
  const [errors, setErrors] = useState<Partial<Record<RulesetFormField, string>>>({});
  const [status, setStatus] = useState<Status>(null);
  const [isSaving, setIsSaving] = useState(false);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const id = (field: string) => `${baseId}-${field}`;
  const describedBy = (field: RulesetFormField) =>
    [`${id(field)}-help`, errors[field] ? `${id(field)}-error` : null].filter(Boolean).join(" ");
  const invalid = (field: RulesetFormField) => (errors[field] ? "border-[var(--danger)]" : "");

  function update<K extends keyof RulesetFormValues>(field: K, value: RulesetFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setStatus(null);
    if (field !== "disabledCategories") {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function toggleCategory(category: FindingCategory) {
    update(
      "disabledCategories",
      values.disabledCategories.includes(category)
        ? values.disabledCategories.filter((item) => item !== category)
        : [...values.disabledCategories, category]
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseRulesetForm(values);
    setErrors(parsed.errors);
    if (!parsed.ruleset) {
      setStatus({ tone: "error", text: "Fix the highlighted fields, then save again." });
      return;
    }

    setIsSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/ruleset`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.ruleset)
      });
      const body = (await response.json().catch(() => ({}))) as {
        ruleset?: Ruleset;
        findingCount?: number;
        previousFindingCount?: number;
        error?: string;
      };
      if (!response.ok || !body.ruleset) {
        throw new Error(body.error ?? "The ruleset could not be saved.");
      }

      const next = formValuesFromRuleset(body.ruleset);
      const patternsChanged = next.requirementIdPatterns !== saved.requirementIdPatterns;
      setSaved(next);
      setValues(next);
      setStatus({
        tone: "success",
        text: (
          <>
            Saved. Analysis re-run: {body.findingCount} finding{body.findingCount === 1 ? "" : "s"} (was{" "}
            {body.previousFindingCount}).{" "}
            <Link href={`/projects/${projectId}/findings`} className={textLinkClass}>
              View findings
            </Link>
            {patternsChanged ? (
              <>
                {" "}
                ID pattern changes apply to the next Jira or JUnit import;{" "}
                <Link href={`/projects/${projectId}/imports`} className={textLinkClass}>
                  re-import those files
                </Link>{" "}
                to update trace links.
              </>
            ) : null}
          </>
        )
      });
      router.refresh();
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof TypeError
            ? "Could not reach the local Doorframe server. Check that it is still running, then try again."
            : error instanceof Error
              ? error.message
              : "The ruleset could not be saved."
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <section className={`${panelClass} p-4`}>
        <h3 className="font-semibold">Analyzer thresholds</h3>
        <div className="mt-3 grid grid-cols-1 gap-4">
          <Field
            id={id("vagueTerms")}
            label="Vague terms"
            help="Words and phrases flagged as weak wording. Separate with commas."
          >
            <textarea
              id={id("vagueTerms")}
              rows={2}
              value={values.vagueTerms}
              onChange={(event) => update("vagueTerms", event.target.value)}
              aria-describedby={describedBy("vagueTerms")}
              className={`${fieldClass} py-2`}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id={id("jaccardThreshold")}
              label="Duplicate similarity threshold"
              help="How similar two requirements' wording must be (0–1) to flag them as possible duplicates. Higher means fewer, closer matches. Default 0.82."
              error={errors.jaccardThreshold}
            >
              <input
                id={id("jaccardThreshold")}
                type="number"
                inputMode="decimal"
                min={0.01}
                max={1}
                step={0.01}
                value={values.jaccardThreshold}
                onChange={(event) => update("jaccardThreshold", event.target.value)}
                aria-invalid={errors.jaccardThreshold ? true : undefined}
                aria-describedby={describedBy("jaccardThreshold")}
                className={`${fieldClass} ${invalid("jaccardThreshold")}`}
              />
            </Field>
            <Field
              id={id("nonVerifiableMinSignals")}
              label="Measurable signals required"
              help={`Flag a requirement as possibly not verifiable when it has fewer than this many of ${NON_VERIFIABLE_SIGNAL_COUNT} signals: numbers, thresholds, conditions, inputs or outputs, actors, units. Default 2; 0 turns the check off.`}
              error={errors.nonVerifiableMinSignals}
            >
              <input
                id={id("nonVerifiableMinSignals")}
                type="number"
                inputMode="numeric"
                min={0}
                max={NON_VERIFIABLE_SIGNAL_COUNT}
                step={1}
                value={values.nonVerifiableMinSignals}
                onChange={(event) => update("nonVerifiableMinSignals", event.target.value)}
                aria-invalid={errors.nonVerifiableMinSignals ? true : undefined}
                aria-describedby={describedBy("nonVerifiableMinSignals")}
                className={`${fieldClass} ${invalid("nonVerifiableMinSignals")}`}
              />
            </Field>
            <Field
              id={id("closedStatuses")}
              label="Closed work item statuses"
              help="Work items with these statuses count as done. Case-insensitive; separate with commas."
            >
              <input
                id={id("closedStatuses")}
                value={values.closedStatuses}
                onChange={(event) => update("closedStatuses", event.target.value)}
                aria-describedby={describedBy("closedStatuses")}
                autoCapitalize="off"
                className={fieldClass}
              />
            </Field>
            <Field
              id={id("draftStatuses")}
              label="Draft or changed requirement statuses"
              help={'Requirements whose status contains any of these are treated as unsettled, so "review" also matches "in review". Case-insensitive.'}
            >
              <input
                id={id("draftStatuses")}
                value={values.draftStatuses}
                onChange={(event) => update("draftStatuses", event.target.value)}
                aria-describedby={describedBy("draftStatuses")}
                autoCapitalize="off"
                className={fieldClass}
              />
            </Field>
          </div>
        </div>
      </section>

      <fieldset className={`${panelClass} p-4`}>
        <legend className="float-left mb-1 w-full font-semibold">Turn off finding categories</legend>
        <p className="clear-both text-xs text-[var(--muted)]">Checked categories are skipped on the next analysis run.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FINDING_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.disabledCategories.includes(category)}
                onChange={() => toggleCategory(category)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {sentenceLabel(category)}
            </label>
          ))}
        </div>
      </fieldset>

      <section className={`${panelClass} p-4`}>
        <Field
          id={id("requirementIdPatterns")}
          label="Requirement ID patterns (JSON)"
          help="Used when importing Jira CSV and JUnit XML to find requirement IDs in text. Each entry has a name and a regex whose first capture group is the ID. Changes apply to the next import."
          error={errors.requirementIdPatterns}
        >
          <textarea
            id={id("requirementIdPatterns")}
            rows={rowsFor(values.requirementIdPatterns, 6)}
            value={values.requirementIdPatterns}
            onChange={(event) => update("requirementIdPatterns", event.target.value)}
            aria-invalid={errors.requirementIdPatterns ? true : undefined}
            aria-describedby={describedBy("requirementIdPatterns")}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className={`${monoFieldClass} ${invalid("requirementIdPatterns")}`}
          />
        </Field>
      </section>

      <section className={`${panelClass} p-4`}>
        <Field
          id={id("customRules")}
          label="Custom rules (JSON)"
          help="Extra checks run against each requirement. A rule flags a requirement when a field matches (or does not match) a case-insensitive regex."
          error={errors.customRules}
        >
          <textarea
            id={id("customRules")}
            rows={rowsFor(values.customRules, 4)}
            value={values.customRules}
            onChange={(event) => update("customRules", event.target.value)}
            aria-invalid={errors.customRules ? true : undefined}
            aria-describedby={describedBy("customRules")}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className={`${monoFieldClass} ${invalid("customRules")}`}
          />
        </Field>
        <details className="mt-3 text-sm">
          <summary className="text-[var(--accent-strong)]">Custom rule format and example</summary>
          <p className="mt-2 text-[var(--muted)]">
            Fields: <code>id</code>, <code>title</code>, <code>description</code>, <code>severity</code> (info, warning,
            error), and <code>condition</code> with a <code>field</code> (text, title, status, type, priority,
            verificationMethod) plus <code>matches</code> and/or <code>notMatches</code>. Optional:{" "}
            <code>recommendation</code>, <code>enabled</code>.
          </p>
          <pre className="mt-2 overflow-auto border border-[var(--line)] bg-[var(--background)] p-3 text-xs">
            {customRuleExample}
          </pre>
        </details>
      </section>

      <div className="ruleset-save-bar sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-[var(--line)] bg-[var(--background)] px-4 py-3 sm:mx-0 sm:px-0 print:hidden">
        <button type="submit" disabled={isSaving || !dirty} aria-busy={isSaving} className={primaryButtonClass}>
          {isSaving ? "Saving and re-running analysis…" : "Save ruleset"}
        </button>
        <button type="button" onClick={() => setValues(saved)} disabled={!dirty || isSaving} className={secondaryButtonClass}>
          Discard changes
        </button>
        <button
          type="button"
          onClick={() => {
            setValues(formValuesFromRuleset(DEFAULT_RULESET));
            setErrors({});
            setStatus(null);
          }}
          disabled={isSaving}
          className={secondaryButtonClass}
        >
          Restore defaults
        </button>
        {dirty && !status ? <span className="text-sm text-[var(--warning)]">Unsaved changes</span> : null}
        {status ? (
          <p
            role={status.tone === "error" ? "alert" : "status"}
            className={`text-sm ${status.tone === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
          >
            {status.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
