"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type FilterFn,
  type SortingState
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RequirementListRow } from "@/lib/view-models";
import { fieldClass, panelClass, secondaryButtonClass, tableScrollClass, textLinkClass } from "@/lib/ui";

const column = createColumnHelper<RequirementListRow>();
const PAGE_SIZE = 200;

// Searches the precomputed per-row text (IDs, title, text, attributes, linked work and tests).
const searchRow: FilterFn<RequirementListRow> = (row, _columnId, value) =>
  row.original.searchText.includes(String(value).trim().toLowerCase());

function parseSort(value: string | undefined): SortingState {
  if (!value) {
    return [];
  }

  return [{ id: value.replace(/^-/, ""), desc: value.startsWith("-") }];
}

function serializeSort(sorting: SortingState): string | undefined {
  const [first] = sorting;
  return first ? `${first.desc ? "-" : ""}${first.id}` : undefined;
}

function Missing() {
  return (
    <span className="text-[var(--muted)]" title="Not set">
      —
    </span>
  );
}

export function RequirementsTable({
  projectId,
  rows,
  view,
  initialQuery = "",
  initialSort
}: {
  projectId: string;
  rows: RequirementListRow[];
  view?: string;
  initialQuery?: string;
  initialSort?: string;
}) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState(initialQuery);
  const [sorting, setSorting] = useState<SortingState>(() => parseSort(initialSort));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Keep the filter and sort in the URL so "Back to requirements" returns to the same list.
  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (view) params.set("view", view);
    if (globalFilter.trim()) params.set("q", globalFilter.trim());
    const sort = serializeSort(sorting);
    if (sort) params.set("sort", sort);
    const query = params.toString();
    return `/projects/${projectId}/requirements${query ? `?${query}` : ""}`;
  }, [projectId, view, globalFilter, sorting]);

  useEffect(() => {
    window.history.replaceState(window.history.state, "", listUrl);
  }, [listUrl]);

  const detailHref = (externalId: string, hash = "") =>
    `/projects/${projectId}/requirements/${encodeURIComponent(externalId)}?back=${encodeURIComponent(listUrl)}${hash}`;

  const columns = useMemo(
    () => [
      column.accessor("externalId", {
        header: "Requirement",
        sortingFn: "alphanumeric",
        filterFn: searchRow,
        cell: (info) => (
          <Link
            href={detailHref(info.getValue())}
            className="whitespace-nowrap font-medium text-[var(--accent-strong)] hover:underline"
          >
            {info.getValue()}
          </Link>
        )
      }),
      column.accessor("title", {
        header: "Title",
        sortingFn: "text",
        cell: (info) => <span className="text-[var(--foreground)]">{info.getValue()}</span>
      }),
      column.accessor("status", {
        header: "Status",
        sortingFn: "text",
        sortUndefined: "last",
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex whitespace-nowrap border border-[var(--line-strong)] px-2 py-0.5 text-xs font-medium uppercase text-[var(--foreground)]">
              {info.getValue()}
            </span>
          ) : (
            <Missing />
          )
      }),
      column.accessor("verificationMethod", {
        header: "Verification",
        sortingFn: "text",
        sortUndefined: "last",
        cell: (info) => info.getValue() || <Missing />
      }),
      column.accessor("linkedWorkCount", {
        header: "Work",
        cell: (info) => (
          <span className={info.getValue() === 0 ? "font-medium text-[var(--warning)]" : undefined}>{info.getValue()}</span>
        )
      }),
      column.accessor("linkedTestCount", {
        header: "Tests",
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="whitespace-nowrap">
              <span className={info.getValue() === 0 ? "font-medium text-[var(--warning)]" : undefined}>{info.getValue()}</span>
              {row.failingTestCount > 0 ? (
                <span className="ml-1 text-[var(--danger)]">({row.failingTestCount} failing)</span>
              ) : null}
              {row.skippedTestCount > 0 ? (
                <span className="ml-1 text-[var(--muted)]">({row.skippedTestCount} skipped)</span>
              ) : null}
            </span>
          );
        }
      }),
      column.accessor("findingCount", {
        header: "Findings",
        cell: (info) =>
          info.getValue() > 0 ? (
            <Link href={detailHref(info.row.original.externalId, "#findings")} className={`font-medium ${textLinkClass}`}>
              {info.getValue()}
            </Link>
          ) : (
            <span className="text-[var(--muted)]">0</span>
          )
      })
    ],
    // detailHref is derived from projectId and listUrl.
    [projectId, listUrl]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter, sorting },
    globalFilterFn: searchRow,
    // One column is enough: the filter function reads the row's combined search text.
    getColumnCanGlobalFilter: (candidate) => candidate.id === "externalId",
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const filteredRows = table.getRowModel().rows;
  const shownRows = filteredRows.slice(0, visibleCount);

  return (
    <div className={panelClass}>
      <div className="flex flex-col gap-2 border-b border-[var(--line)] p-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={globalFilter}
          onChange={(event) => {
            setGlobalFilter(event.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          aria-label="Filter requirements"
          placeholder="Filter by ID, title, text, status, work item, or test"
          className={`${fieldClass} sm:max-w-md`}
        />
        <div className="text-sm text-[var(--muted)]" aria-live="polite">
          Showing {Math.min(shownRows.length, filteredRows.length)} of {rows.length} requirement
          {rows.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className={tableScrollClass}>
        <table className="w-full min-w-[880px] border-collapse text-sm print:min-w-0">
          <caption className="sr-only">Requirements</caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                  return (
                    <th
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                      className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--panel)] p-0 text-left text-xs uppercase text-[var(--muted)]"
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex w-full items-center gap-1 whitespace-nowrap p-3 text-left font-semibold uppercase hover:text-[var(--foreground)] focus-visible:outline-offset-[-2px]"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon size={12} aria-hidden="true" className={sorted ? "text-[var(--accent-strong)]" : "opacity-50"} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {shownRows.map((row) => (
              <tr
                key={row.id}
                onClick={(event) => {
                  // The ID link is the keyboard target; let a click anywhere else on the row open it too.
                  if (!(event.target as HTMLElement).closest("a, button")) {
                    router.push(detailHref(row.original.externalId));
                  }
                }}
                className="cursor-pointer hover:bg-[var(--panel-strong)]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-b border-[var(--line)] p-3 align-top text-[var(--muted)]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-sm text-[var(--muted)]">
                  {globalFilter.trim() ? (
                    <>
                      No requirements match &ldquo;{globalFilter.trim()}&rdquo;.{" "}
                      <button type="button" onClick={() => setGlobalFilter("")} className={textLinkClass}>
                        Clear filter
                      </button>
                    </>
                  ) : (
                    "No requirements in this view."
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {filteredRows.length > shownRows.length ? (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] p-3 text-sm text-[var(--muted)]">
          <span>
            {filteredRows.length - shownRows.length} more requirement{filteredRows.length - shownRows.length === 1 ? "" : "s"}
          </span>
          <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className={secondaryButtonClass}>
            Show {Math.min(PAGE_SIZE, filteredRows.length - shownRows.length)} more
          </button>
        </div>
      ) : null}
    </div>
  );
}
