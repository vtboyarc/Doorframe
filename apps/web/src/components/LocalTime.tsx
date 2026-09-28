"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Render a timestamp in the viewer's own time zone. The server renders the
 * UTC value first so the page never shows a server-local time without a zone.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const date = new Date(iso);
  const valid = !Number.isNaN(date.getTime());
  const text = !valid
    ? iso
    : isClient
      ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;

  return (
    <time dateTime={iso} title={valid ? date.toISOString() : undefined} className={className}>
      {text}
    </time>
  );
}
