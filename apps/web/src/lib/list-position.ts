// Where a list's scroll box was, saved per browser tab so browser Back can return to it.
// Every storage call is guarded: storage can be missing or throw (private windows, blocked
// site data), and the page must work the same without it.

import type { StorageLike } from "./session-store";

export interface ListPosition {
  /** The scroll box's scrollTop in pixels. */
  top: number;
  /** How many rows were shown, for lists that show more rows on request. */
  count?: number;
}

const PREFIX = "doorframe:list-position:";

/**
 * The storage key for the current history entry. The Navigation API gives each entry a key
 * that survives Back and Forward, so a fresh visit to the same address starts at the top, as
 * page scroll does. Browsers without it fall back to the address.
 */
export function listPositionKey(location: { pathname: string; search: string }, entryKey?: string | null): string {
  return entryKey ? `${PREFIX}entry:${entryKey}` : `${PREFIX}url:${location.pathname}${location.search}`;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** A stored position, or null when the value is missing or not one this module wrote. */
export function parseListPosition(raw: string | null): ListPosition | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as { top?: unknown; count?: unknown } | null;
    if (!value || typeof value.top !== "number" || !Number.isFinite(value.top) || value.top < 0) {
      return null;
    }
    return isCount(value.count) ? { top: value.top, count: value.count } : { top: value.top };
  } catch {
    return null;
  }
}

export function readListPosition(storage: StorageLike | null, key: string): ListPosition | null {
  try {
    return parseListPosition(storage?.getItem(key) ?? null);
  } catch {
    return null;
  }
}

export function writeListPosition(storage: StorageLike | null, key: string, position: ListPosition): void {
  try {
    const top = Math.max(0, Math.round(position.top));
    storage?.setItem(key, JSON.stringify(isCount(position.count) ? { top, count: position.count } : { top }));
  } catch {
    // Storage is full or blocked; the list simply opens at the top next time.
  }
}
