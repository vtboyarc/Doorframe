// Which two snapshots the Baselines page compares, and how that choice is kept in the URL
// (?a=<earlier>&b=<later>) so Back and "Back to baselines" return to the same comparison.

/** The "To" value that stands for the project's current state rather than a saved baseline. */
export const CURRENT_STATE = "current";

export interface BaselineSelection {
  /** The earlier snapshot: a baseline ID, or "" when there are no baselines. */
  a: string;
  /** The later snapshot: a baseline ID or {@link CURRENT_STATE}. */
  b: string;
}

/**
 * Compare the previous baseline with the latest one when there are two or more; otherwise
 * compare the only baseline with the current state. `baselines` is newest first.
 */
export function defaultSelection(baselines: Array<{ id: string }>): BaselineSelection {
  if (baselines.length >= 2) {
    return { a: baselines[1].id, b: baselines[0].id };
  }

  return { a: baselines[0]?.id ?? "", b: CURRENT_STATE };
}

/** The selection named in the URL; a missing or unknown ID falls back to the default for that side. */
export function selectionFromParams(baselines: Array<{ id: string }>, params: URLSearchParams): BaselineSelection {
  const fallback = defaultSelection(baselines);
  const known = new Set(baselines.map((baseline) => baseline.id));
  const a = params.get("a");
  const b = params.get("b");

  return {
    a: a && known.has(a) ? a : fallback.a,
    b: b && (b === CURRENT_STATE || known.has(b)) ? b : fallback.b
  };
}

/** The Baselines page address for a selection; without one, the plain page. */
export function baselinesUrl(projectId: string, selection?: BaselineSelection): string {
  const path = `/projects/${projectId}/baselines`;
  if (!selection?.a) {
    return path;
  }

  return `${path}?${new URLSearchParams({ a: selection.a, b: selection.b }).toString()}`;
}
