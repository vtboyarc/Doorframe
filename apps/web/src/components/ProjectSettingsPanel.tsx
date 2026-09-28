"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PROJECT_NAME_MAX_LENGTH } from "@/lib/limits";
import { dangerButtonClass, fieldClass, panelClass, secondaryButtonClass } from "@/lib/ui";

function requestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError) {
    return "Could not reach the local Doorframe server. Check that it is still running, then try again.";
  }

  return error instanceof Error ? error.message : fallback;
}

/** Rename the project. */
export function ProjectNameForm({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const unchanged = value.trim() === name;

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) {
      setMessage({ tone: "error", text: "Enter a project name." });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: value.trim() })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "The project could not be renamed.");
      }

      setMessage({ tone: "success", text: "Project renamed." });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: requestErrorMessage(error, "The project could not be renamed.") });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={rename} className={`${panelClass} p-4`} noValidate>
      <h2 className="text-lg font-semibold">Project</h2>
      <label htmlFor="project-rename" className="mt-3 block text-sm font-medium">
        Project name
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          id="project-rename"
          value={value}
          maxLength={PROJECT_NAME_MAX_LENGTH}
          onChange={(event) => {
            setValue(event.target.value);
            setMessage(null);
          }}
          className={`${fieldClass} sm:max-w-md`}
        />
        <button type="submit" disabled={isSaving || unchanged} className={secondaryButtonClass}>
          {isSaving ? "Saving…" : "Rename"}
        </button>
      </div>
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-2 text-sm ${message.tone === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

/** Permanently delete the project after an explicit confirmation step. */
export function DeleteProjectPanel({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteProject() {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "The project could not be deleted.");
      }

      router.push("/");
    } catch (deleteError) {
      setIsDeleting(false);
      setError(requestErrorMessage(deleteError, "The project could not be deleted."));
    }
  }

  return (
    <section className="border border-[var(--danger)] p-4" aria-labelledby="delete-project-heading">
      <h2 id="delete-project-heading" className="text-lg font-semibold">
        Delete project
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Removes this project and all of its imported records, findings, baselines, and audit history from the local
        database. Your original export files are not touched. This cannot be undone.
      </p>
      {isConfirming ? (
        <div role="alertdialog" aria-labelledby="delete-confirm-text" className="mt-4 bg-[var(--danger-soft)] p-3">
          <p id="delete-confirm-text" className="text-sm">
            Delete <strong className="[overflow-wrap:anywhere]">{name}</strong> permanently?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={deleteProject} disabled={isDeleting} className={dangerButtonClass}>
              <Trash2 size={16} aria-hidden="true" />
              {isDeleting ? "Deleting…" : "Delete permanently"}
            </button>
            <button type="button" onClick={() => setIsConfirming(false)} disabled={isDeleting} className={secondaryButtonClass}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setIsConfirming(true)} className={`mt-4 ${dangerButtonClass}`}>
          <Trash2 size={16} aria-hidden="true" />
          Delete project…
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
