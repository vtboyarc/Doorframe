"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { pathAndSearch } from "./url-state";

function currentAddress(): string {
  return pathAndSearch(window.location.href);
}

/**
 * Keep a page's view state in the address bar without a navigation, so reloads, shared links,
 * and "Back to ..." links return to the same view. Also adopts address changes that did not
 * come from the page itself, such as a click on the page's own nav tab or browser Back and
 * Forward between two entries of the same page.
 *
 * @param url The path and query string for the current state, or null while the state is not
 *   ready (the address bar is then left alone).
 * @param adopt Receives the query string after an outside change; set the state from it.
 */
export function useUrlState(url: string | null, adopt: (params: URLSearchParams) => void): void {
  const searchParams = useSearchParams();
  // The address the state last matched, either written here or adopted from outside.
  const known = useRef<string | null>(null);
  const adoptRef = useRef(adopt);

  useEffect(() => {
    adoptRef.current = adopt;
  });

  // Next updates the search params after every address change, including the ones written below
  // (sometimes a few keystrokes late). Only an address this hook did not write is adopted.
  useEffect(() => {
    const current = currentAddress();
    if (known.current !== null && current !== known.current) {
      adoptRef.current(new URLSearchParams(window.location.search));
    }
    known.current = current;
  }, [searchParams]);

  useEffect(() => {
    if (url === null) {
      return;
    }
    const target = pathAndSearch(url, window.location.href);
    if (target === currentAddress()) {
      known.current = target;
      return;
    }
    // Write on the next task, never during the first effects after a page load: Next's router
    // patches history.replaceState in an effect that runs after this one. Replacing the entry
    // before that drops Next's history state, and browser Back to the entry then changes the
    // address without showing the page.
    const timer = window.setTimeout(() => {
      window.history.replaceState(null, "", `${target}${window.location.hash}`);
      known.current = currentAddress();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [url]);
}
