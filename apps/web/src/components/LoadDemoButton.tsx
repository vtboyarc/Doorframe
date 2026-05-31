"use client";

import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoadDemoButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDemo() {
    const confirmed = window.confirm(
      "Load fictional Doorframe sample data (Falcon Telemetry Gateway) into this project?\n\n" +
        "This adds demo records, trace links, and findings to the current project. If this project " +
        "already holds real imported data, the sample data will be mixed in. Load the demo into a " +
        "fresh project instead."
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const response = await fetch(`/api/projects/${projectId}/demo`, {
      method: "POST"
    });
    const payload = (await response.json()) as {
      recordCount?: number;
      linkCount?: number;
      findingCount?: number;
      error?: string;
    };

    setIsLoading(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Demo data could not be loaded.");
      return;
    }

    setMessage(
      `Loaded ${payload.recordCount ?? 0} records, ${payload.linkCount ?? 0} trace links, and ${
        payload.findingCount ?? 0
      } findings.`
    );
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={loadDemo}
        disabled={isLoading}
        className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--foreground)] bg-white px-4 disabled:opacity-60"
      >
        <Database size={16} />
        {isLoading ? "Loading demo" : "Load Demo Project"}
      </button>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Loads fictional sample data (Falcon Telemetry Gateway). Use a fresh project so it is not
        mixed with real imports.
      </p>
      {message ? <div className="mt-2 text-sm text-[var(--muted)]">{message}</div> : null}
    </div>
  );
}
