"use client";

import { useRef, type ReactNode } from "react";
import { useRestoredScroll } from "@/lib/use-restored-scroll";

/** A scroll box that returns to its scroll position when the page is shown again with browser Back. */
export function RestoredScrollBox({ className, children }: { className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useRestoredScroll(box);

  return (
    <div ref={box} className={className}>
      {children}
    </div>
  );
}
