"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isFrameDocumentReady, isPrintShortcut } from "@/lib/report-print";
import { panelClass, secondaryButtonClass } from "@/lib/ui";

function previewReady(frame: HTMLIFrameElement): boolean {
  try {
    return isFrameDocumentReady({
      href: frame.contentWindow?.location.href,
      readyState: frame.contentDocument?.readyState
    });
  } catch {
    return false;
  }
}

/** Callbacks waiting for a preview that is still generating; one print covers them all. */
const waitingPrints = new WeakMap<HTMLIFrameElement, Array<() => void>>();

/**
 * Print the preview's own document (same origin), which applies the report's print styles.
 * While the preview is still generating, wait for it to load. Returns true when printing
 * started right away.
 */
function printPreview(frame: HTMLIFrameElement, onPrinted: () => void = () => {}): boolean {
  if (previewReady(frame)) {
    frame.contentWindow?.print();
    onPrinted();
    return true;
  }
  const waiting = waitingPrints.get(frame);
  if (waiting) {
    waiting.push(onPrinted);
    return false;
  }
  waitingPrints.set(frame, [onPrinted]);
  frame.addEventListener(
    "load",
    () => {
      const callbacks = waitingPrints.get(frame) ?? [];
      waitingPrints.delete(frame);
      frame.contentWindow?.print();
      callbacks.forEach((callback) => callback());
    },
    { once: true }
  );
  return false;
}

export function PrintReportButton({ frameId }: { frameId: string }) {
  const [waiting, setWaiting] = useState(false);

  function print() {
    const frame = document.getElementById(frameId);
    if (frame instanceof HTMLIFrameElement && !printPreview(frame, () => setWaiting(false))) {
      setWaiting(true);
    }
  }

  return (
    <button type="button" onClick={print} disabled={waiting} aria-busy={waiting} className={secondaryButtonClass}>
      <Printer size={16} aria-hidden="true" />
      {waiting ? "Preparing report…" : "Print / Save as PDF"}
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

  // Ctrl+P (Cmd+P) prints the report itself, as the Print button does, rather than this page
  // with the report cut off at the preview's height. The shortcut is also caught inside the
  // preview, where the keyboard focus is after a click in the report.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPrintShortcut(event)) {
        event.preventDefault();
        printPreview(frame);
      }
    };
    let frameWindow: Window | null = null;
    const listenInFrame = () => {
      frameWindow?.removeEventListener("keydown", onKeyDown);
      frameWindow = frame.contentWindow;
      frameWindow?.addEventListener("keydown", onKeyDown);
    };
    window.addEventListener("keydown", onKeyDown);
    frame.addEventListener("load", listenInFrame);
    if (previewReady(frame)) {
      listenInFrame();
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      frame.removeEventListener("load", listenInFrame);
      frameWindow?.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <>
      <div className={`relative ${panelClass} print:hidden`}>
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
      {/* Printing from the browser menu prints this page, which cannot paginate the preview. */}
      <p className="hidden text-sm print:block">
        This printout leaves out the report preview. To print the traceability report, open the Reports page and use Print /
        Save as PDF or Ctrl+P (Cmd+P on a Mac), or open the report in a new tab and print it from there.
      </p>
    </>
  );
}
