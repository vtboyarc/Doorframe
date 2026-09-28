"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { listPositionKey, readListPosition, writeListPosition, type ListPosition } from "./list-position";
import { sessionStore } from "./session-store";

/** The current history entry's Navigation API key, where the browser has the API. */
function historyEntryKey(): string | null {
  const navigation = (window as { navigation?: { currentEntry?: { key?: string } | null } }).navigation;
  return navigation?.currentEntry?.key ?? null;
}

function currentKey(): string {
  return listPositionKey(window.location, historyEntryKey());
}

/**
 * Save a scroll box's position for the current history entry and put it back when the page is
 * shown again with browser Back or Forward. Next restores the window's scroll position, but not
 * the scroll position of an element inside the page.
 *
 * @param options.count Rows currently shown, for lists that grow with "Show more".
 * @param options.restoreCount Called with the saved row count before the scroll position is set.
 */
export function useRestoredScroll(
  ref: RefObject<HTMLElement | null>,
  options: { count?: number; restoreCount?: (count: number) => void } = {}
): void {
  const { count, restoreCount } = options;
  const pending = useRef<ListPosition | null>(null);
  const countRef = useRef(count);

  // Restore before the first paint so the list does not jump.
  useLayoutEffect(() => {
    const box = ref.current;
    const saved = box ? readListPosition(sessionStore(), currentKey()) : null;
    if (!box || !saved) {
      return;
    }
    if (saved.count !== undefined && restoreCount && count !== undefined && saved.count > count) {
      // Show the saved number of rows first; the effect below scrolls once they are rendered.
      pending.current = saved;
      restoreCount(saved.count);
      return;
    }
    box.scrollTop = saved.top;
    // Only on mount: later renders keep the position the user scrolled to.
  }, []);

  useLayoutEffect(() => {
    countRef.current = count;
    const box = ref.current;
    const waiting = pending.current;
    if (!box) {
      return;
    }
    if (waiting) {
      if (count === undefined || waiting.count === undefined || count >= waiting.count) {
        box.scrollTop = waiting.top;
        pending.current = null;
      }
      return;
    }
    // Remember "Show more" even when the user does not scroll afterwards.
    writeListPosition(sessionStore(), currentKey(), { top: box.scrollTop, count });
  }, [ref, count]);

  useEffect(() => {
    const box = ref.current;
    if (!box) {
      return;
    }
    let frame = 0;
    const save = () => {
      frame = 0;
      if (!pending.current) {
        writeListPosition(sessionStore(), currentKey(), { top: box.scrollTop, count: countRef.current });
      }
    };
    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(save);
      }
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      box.removeEventListener("scroll", onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [ref]);
}
