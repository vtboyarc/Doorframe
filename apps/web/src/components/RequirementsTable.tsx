"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState
} from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { RequirementTableRow } from "@/lib/view-models";

const column = createColumnHelper<RequirementTableRow>();

export function RequirementsTable({
  projectId,
  rows
}: {
  projectId: string;
  rows: RequirementTableRow[];
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo(
    () => [
      column.accessor("externalId", {
        header: "ID",
        cell: (info) => (
          <Link href={`/projects/${projectId}/requirements/${encodeURIComponent(info.row.original.externalId)}`} className="font-medium text-[var(--accent-strong)]">
            {info.getValue()}
          </Link>
        )
      }),
      column.accessor("title", { header: "Title" }),
      column.accessor("status", { header: "Status" }),
      column.accessor("verificationMethod", { header: "Verification method" }),
      column.accessor("linkedWorkCount", { header: "Work" }),
      column.accessor("linkedTestCount", {
        header: "Tests",
        cell: (info) => (
          <span>
            {info.getValue()}
            {info.row.original.failingTestCount > 0 ? (
              <span className="ml-1 text-[var(--danger)]">({info.row.original.failingTestCount} failing)</span>
            ) : null}
          </span>
        )
      }),
      column.accessor("findingCount", {
        header: "Findings",
        cell: (info) =>
          info.getValue() > 0 ? (
            <Link
              href={`/projects/${projectId}/requirements/${encodeURIComponent(info.row.original.externalId)}#findings`}
              className="font-medium text-[var(--accent-strong)] hover:underline"
            >
              {info.getValue()}
            </Link>
          ) : (
            0
          )
      })
    ],
    [projectId]
  );
  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] p-3">
        <input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Filter requirements"
          className="min-h-10 w-full border border-[var(--line)] px-3"
        />
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-[var(--line)] bg-[var(--background)] p-3 text-left"
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="font-semibold"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? " ↑" : ""}
                      {header.column.getIsSorted() === "desc" ? " ↓" : ""}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-[#eef7f2]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-b border-[var(--line)] p-3 align-top">
                    {cell.column.id === "title" ? (
                      <Link
                        href={`/projects/${projectId}/requirements/${encodeURIComponent(row.original.externalId)}`}
                        className="hover:text-[var(--accent-strong)] hover:underline"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Link>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
