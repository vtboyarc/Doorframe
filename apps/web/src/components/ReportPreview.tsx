"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { panelClass, secondaryButtonClass } from "@/lib/ui";

/** Print the embedded report preview (same origin), which applies the report's print styles. */
export function PrintReportButton({ frameId }: { frameId: string }) {
  return (
    <button
      type="button"
      onClick={() => (document.getElementById(frameId) as HTMLIFrameElement | null)?.contentWindow?.print()}
      className={secondaryButtonClass}
    >
      <Printer size={16} aria-hidden="true" />
      Print / Save as PDF
    </button>
  );
}

export function ReportPreview({ frameId, src }: { frameId: string; src: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  // The frame can finish loading before hydration attaches onLoad; check once on mount.
  useEffect(() => {
    const frame = frameRef.current;
    const document = frame?.contentDocument;
    if (document && document.readyState === "complete" && document.body?.childElementCount) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className={`relative ${panelClass}`}>
      {!loaded ? (
        <p className="absolute inset-0 grid place-items-center text-sm text-[var(--muted)]" aria-hidden="true">
          Generating preview…
        </p>
      ) : null}
      <iframe
        ref={frameRef}
        id={frameId}
        title="Traceability report preview"
        src={src}
        onLoad={() => setLoaded(true)}
        className={`relative block h-[calc(100vh-240px)] min-h-[520px] w-full transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
