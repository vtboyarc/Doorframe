"use client";

import { useId, useState } from "react";
import { plural } from "@/lib/import-messages";
import { textLinkClass } from "@/lib/ui";

const INITIAL_COUNT = 8;
/** Upper bound for "Show all" so a file with thousands of skipped rows stays usable. */
const MAX_SHOWN = 500;

/** Import warnings: a count, the first few messages, and a toggle for the rest. */
export function ImportMessageList({ messages, title = "Import messages" }: { messages: string[]; title?: string }) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();

  if (messages.length === 0) {
    return null;
  }

  const visible = messages.slice(0, showAll ? MAX_SHOWN : INITIAL_COUNT);
  const hidden = messages.length - visible.length;

  return (
    <div className="min-w-0 text-sm">
      <div className="font-medium">
        {title}: {plural(messages.length, "message")}
      </div>
      <ul id={listId} className="mt-1 list-disc space-y-1 pl-5">
        {visible.map((message, index) => (
          <li key={index} className="break-words [overflow-wrap:anywhere]">
            {message}
          </li>
        ))}
      </ul>
      {messages.length > INITIAL_COUNT ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            className={textLinkClass}
            aria-expanded={showAll}
            aria-controls={listId}
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? "Show fewer" : `Show all ${messages.length.toLocaleString("en-US")}`}
          </button>
          {showAll && hidden > 0 ? (
            <span className="text-[var(--muted)]">
              The first {MAX_SHOWN.toLocaleString("en-US")} are shown.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
