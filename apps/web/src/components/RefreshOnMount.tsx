"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetch server data when the page is shown again via client navigation
 * (e.g. the Back button), where Next would otherwise reuse a cached render.
 */
export function RefreshOnMount() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  return null;
}
