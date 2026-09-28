"use client";

import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { secondaryButtonClass } from "@/lib/ui";

/** Fill an empty project with the fictional Falcon Telemetry Gateway data. */
export function LoadDemoButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDemo() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/demo`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Demo data could not be loaded.");
      }

      router.refresh();
    } catch (loadError) {
      setError(
        loadError instanceof TypeError
          ? "Could not reach the local Doorframe server. Check that it is still running, then try again."
          : loadError instanceof Error
            ? loadError.message
            : "Demo data could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={loadDemo} disabled={isLoading} aria-busy={isLoading} className={secondaryButtonClass}>
        <Database size={16} aria-hidden="true" />
        {isLoading ? "Loading demo data…" : "Load fictional demo data"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
