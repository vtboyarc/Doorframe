"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("New Doorframe Project");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createProject() {
    setIsSaving(true);
    setError(null);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      setIsSaving(false);
      setError("Project could not be created.");
      return;
    }

    const payload = (await response.json()) as { project: { id: string } };
    router.push(`/projects/${payload.project.id}`);
    router.refresh();
  }

  return (
    <div className="border border-[var(--line)] bg-white p-4">
      <h2 className="text-base font-semibold">Create empty project</h2>
      <label className="mt-3 block text-sm font-medium" htmlFor="project-name">
        Project name
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-10 flex-1 border border-[var(--line)] px-3"
        />
        <button
          type="button"
          onClick={createProject}
          disabled={isSaving}
          className="min-h-10 border border-[var(--accent-strong)] bg-[var(--accent)] px-4 text-white disabled:opacity-60"
        >
          {isSaving ? "Creating" : "Create project"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
