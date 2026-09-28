// Addresses for pages that keep their view state (filter, sort, focus, selection) in the query
// string. The client hook that writes them is in use-url-state.ts.

import type { SortingState } from "@tanstack/react-table";

/**
 * The path and query string of `url`, parsed the way the address bar shows it, so two
 * spellings of the same address compare equal. The hash is left out.
 */
export function pathAndSearch(url: string, base = "http://localhost"): string {
  const parsed = new URL(url, base);
  return `${parsed.pathname}${parsed.search}`;
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

/** Table sort from a ?sort= value: a column ID, with a leading "-" for descending. */
export function parseSort(value: string | null | undefined): SortingState {
  if (!value) {
    return [];
  }

  return [{ id: value.replace(/^-/, ""), desc: value.startsWith("-") }];
}

export function serializeSort(sorting: SortingState): string | undefined {
  const [first] = sorting;
  return first ? `${first.desc ? "-" : ""}${first.id}` : undefined;
}

/** The Requirements page address for a view, text filter, and sort. Blank values are left out. */
export function requirementListUrl(
  projectId: string,
  state: { view?: string; query: string; sorting: SortingState }
): string {
  const params = new URLSearchParams();
  if (state.view) params.set("view", state.view);
  const query = state.query.trim();
  if (query) params.set("q", query);
  const sort = serializeSort(state.sorting);
  if (sort) params.set("sort", sort);
  return withQuery(`/projects/${projectId}/requirements`, params);
}

/** The trace graph address for a focused requirement and a view; the default view is left out. */
export function traceGraphUrl(
  pathname: string,
  state: { focus?: string; view: string; defaultView: string }
): string {
  const params = new URLSearchParams();
  if (state.focus) params.set("focus", state.focus);
  if (state.view !== state.defaultView) params.set("view", state.view);
  return withQuery(pathname, params);
}
