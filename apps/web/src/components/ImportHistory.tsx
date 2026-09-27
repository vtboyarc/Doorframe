import type { ImportBatch } from "@doorframe/core";
import { ImportMessageList } from "@/components/ImportMessageList";
import { LocalTime } from "@/components/LocalTime";
import { entityCount, plural } from "@/lib/import-messages";
import { entityTypeForSource } from "@/lib/import-types";
import { sourceTypeLabel } from "@/lib/labels";
import { panelClass } from "@/lib/ui";

const HISTORY_LIMIT = 50;

function recordCountText(batch: ImportBatch): string {
  const entityType = entityTypeForSource(batch.sourceType);
  return entityType ? entityCount(entityType, batch.recordCount) : plural(batch.recordCount, "record");
}

/** Every import into this project, newest first, with its warnings. */
export function ImportHistory({ batches }: { batches: ImportBatch[] }) {
  const shown = batches.slice(0, HISTORY_LIMIT);

  return (
    <section className={`${panelClass} min-w-0 p-4`} aria-labelledby="import-history-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="import-history-heading" className="text-lg font-semibold">
          Import history
        </h2>
        {batches.length > HISTORY_LIMIT ? (
          <span className="text-sm text-[var(--muted)]">
            The {HISTORY_LIMIT} most recent of {batches.length.toLocaleString("en-US")} imports
          </span>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          No imports yet. Each imported file is listed here with its record count and any warnings.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {shown.map((batch) => (
            <li key={batch.id} className="min-w-0 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{batch.filename}</span>
                <LocalTime iso={batch.importedAt} className="shrink-0 text-[var(--muted)]" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--muted)]">
                <span>{sourceTypeLabel(batch.sourceType)}</span>
                <span aria-hidden="true">·</span>
                <span className={batch.recordCount === 0 ? "text-[var(--warning)]" : undefined}>{recordCountText(batch)}</span>
                {batch.errors.length > 0 ? (
                  <span className="border border-[var(--warning)] bg-[var(--warning-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--warning)]">
                    {plural(batch.errors.length, "warning")}
                  </span>
                ) : null}
              </div>
              {batch.errors.length > 0 ? (
                <details className="mt-2">
                  <summary className="text-sm text-[var(--accent-strong)]">
                    Show {batch.errors.length === 1 ? "warning" : "warnings"}
                  </summary>
                  <div className="mt-2">
                    <ImportMessageList messages={batch.errors} title="Warnings" />
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
