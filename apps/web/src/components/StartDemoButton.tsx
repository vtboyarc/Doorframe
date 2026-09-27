"use client";

import { FileSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

/**
 * Create a new project filled with the fictional Falcon Telemetry Gateway data
 * and open its report. The server creates and fills the project in one request.
 */
export function StartDemoButton({
  projectName,
  label = "Open demo report",
  variant = "primary"
}: {
  projectName: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDemo() {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: projectName, demo: true })
      });
      const payload = (await response.json().catch(() => ({}))) as { project?: { id: string }; error?: string };

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "The demo could not be prepared.");
      }

      router.push(`/projects/${payload.project.id}/reports`);
    } catch (demoError) {
      setIsStarting(false);
      setError(
        demoError instanceof TypeError
          ? "Could not reach the local Doorframe server. Check that it is still running, then try again."
          : demoError instanceof Error
            ? demoError.message
            : "The demo could not be prepared."
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startDemo}
        disabled={isStarting}
        aria-busy={isStarting}
        className={`w-full ${variant === "primary" ? primaryButtonClass : secondaryButtonClass}`}
      >
        <FileSearch size={16} aria-hidden="true" />
        {isStarting ? "Preparing demo…" : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
