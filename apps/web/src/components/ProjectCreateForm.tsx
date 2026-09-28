"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PROJECT_NAME_MAX_LENGTH } from "@/lib/limits";
import { fieldClass, panelClass, primaryButtonClass } from "@/lib/ui";

export function ProjectCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a project name.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
      });
      const payload = (await response.json().catch(() => ({}))) as { project?: { id: string }; error?: string };

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "The project could not be created.");
      }

      router.push(`/projects/${payload.project.id}/imports`);
    } catch (createError) {
      setIsSaving(false);
      setError(
        createError instanceof TypeError
          ? "Could not reach the local Doorframe server. Check that it is still running, then try again."
          : createError instanceof Error
            ? createError.message
            : "The project could not be created."
      );
    }
  }

  return (
    <form onSubmit={createProject} className={`${panelClass} p-4`} noValidate>
      <h2 className="text-base font-semibold">Create a project</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Start empty, then import a requirements CSV or ReqIF export, a Jira CSV, and JUnit XML results.
      </p>
      <label className="mt-4 block text-sm font-medium" htmlFor="project-name">
        Project name
      </label>
      <input
        id="project-name"
        value={name}
        maxLength={PROJECT_NAME_MAX_LENGTH}
        placeholder="e.g. Ground station increment 4"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "project-name-error" : undefined}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        className={`mt-2 ${fieldClass}`}
      />
      <button type="submit" disabled={isSaving} aria-busy={isSaving} className={`mt-3 w-full ${primaryButtonClass}`}>
        {isSaving ? "Creating…" : "Create project"}
      </button>
      {error ? (
        <p id="project-name-error" role="alert" className="mt-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
