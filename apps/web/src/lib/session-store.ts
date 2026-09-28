// This browser tab's sessionStorage, for small per-tab UI state such as list positions and
// unsaved form edits. Storage can be missing or throw (private windows, blocked site data), so
// callers guard every call and pages must work the same without it.

/** The parts of the Web Storage API the per-tab helpers use. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** This tab's sessionStorage, or null on the server or when the browser blocks it. */
export function sessionStore(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
