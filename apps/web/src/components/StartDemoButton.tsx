"use client";

import { FileSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartDemoButton() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDemo() {
    setIsStarting(true);
    setError(null);

    const createResponse = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Falcon Telemetry Gateway Demo" })
    });

    if (!createResponse.ok) {
      setIsStarting(false);
      setError("Demo project could not be created.");
      return;
    }

    const payload = (await createResponse.json()) as { project: { id: string } };
    const demoResponse = await fetch(`/api/projects/${payload.project.id}/demo`, {
      method: "POST"
    });

    if (!demoResponse.ok) {
      setIsStarting(false);
      setError("Demo data could not be loaded.");
      return;
    }

    router.push(`/projects/${payload.project.id}/reports`);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={startDemo}
        disabled={isStarting}
        className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap border border-[var(--accent-strong)] bg-[var(--accent)] px-4 text-white disabled:opacity-60 sm:w-auto"
      >
        <FileSearch size={17} />
        {isStarting ? "Preparing demo" : "Open demo report"}
      </button>
      {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
