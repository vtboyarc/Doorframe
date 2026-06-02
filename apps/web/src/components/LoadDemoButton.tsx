"use client";

import { AlertTriangle, Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoadDemoButton({
  projectId,
  hasProjectData = false
}: {
  projectId: string;
  hasProjectData?: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function requestLoadDemo() {
    if (hasProjectData && !isConfirming) {
      setIsConfirming(true);
      setMessage(null);
      return;
    }

    await loadDemo();
  }

  async function loadDemo() {
    setIsLoading(true);
    setIsConfirming(false);
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
    <div className="max-w-md">
      <button
        type="button"
        onClick={requestLoadDemo}
        disabled={isLoading}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-[var(--foreground)] bg-white px-4 disabled:opacity-60 sm:w-auto"
      >
        <Database size={16} />
        {isLoading ? "Loading demo" : hasProjectData ? "Add demo data" : "Load Demo Project"}
      </button>
      {isConfirming ? (
        <div className="mt-2 border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 shrink-0 text-[var(--warning)]" size={16} />
            <div>
              <p className="font-medium">This project already has data.</p>
              <p className="mt-1 text-[var(--muted)]">
                Demo records will be added to the current project. Use a fresh project when you do not want sample data mixed with real imports.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadDemo}
              disabled={isLoading}
              className="min-h-9 border border-[var(--warning)] bg-white px-3 font-medium"
            >
              Load anyway
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              className="min-h-9 border border-[var(--line)] bg-white px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Loads fictional sample data (Falcon Telemetry Gateway). Use a fresh project so it is not mixed with real imports.
        </p>
      )}
      {message ? <div className="mt-2 text-sm text-[var(--muted)]">{message}</div> : null}
    </div>
  );
}
