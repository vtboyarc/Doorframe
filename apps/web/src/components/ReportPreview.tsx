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

const PREVIEW_MIN_HEIGHT = 360;
/** Space kept under the preview: the page's bottom padding plus the panel border. */
const PREVIEW_BOTTOM_GAP = 28;

export function ReportPreview({ frameId, src }: { frameId: string; src: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);

  // Fill the rest of the window below the header, tabs, and download bar (their height varies
  // with the window width), so the page itself does not scroll as well as the preview.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const fit = () => {
      const top = frame.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(PREVIEW_MIN_HEIGHT, Math.floor(window.innerHeight - top - PREVIEW_BOTTOM_GAP)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

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
        style={height ? { height } : undefined}
        className={`relative block h-[calc(100vh-240px)] min-h-[360px] w-full transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
