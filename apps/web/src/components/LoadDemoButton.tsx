"use client";

import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoadDemoButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDemo() {
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
      {message ? <div className="mt-2 text-sm text-[var(--muted)]">{message}</div> : null}
    </div>
  );
}
