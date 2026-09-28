"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { activeChipClass, chipClass, chipCountClass, inactiveChipClass } from "@/lib/ui";

export interface RequirementViewOption {
  value?: string;
  label: string;
  count: number;
}

/**
 * View chips for the Requirements page. The table keeps its text filter and sort in the URL, so
 * the chips read them from there and carry them over to the chosen view.
 */
export function RequirementViewNav({
  basePath,
  options,
  activeView
}: {
  basePath: string;
  options: RequirementViewOption[];
  activeView?: string;
}) {
  const searchParams = useSearchParams();

  function hrefFor(value: string | undefined): string {
    const params = new URLSearchParams();
    if (value) params.set("view", value);
    for (const key of ["q", "sort"]) {
      const current = searchParams.get(key);
      if (current) params.set(key, current);
    }
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  }

  return (
    <nav aria-label="Requirement views" className="mb-3 flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === activeView;
        return (
          <Link
            key={option.label}
            href={hrefFor(option.value)}
            aria-current={active ? "true" : undefined}
            className={`${chipClass} ${active ? activeChipClass : inactiveChipClass}`}
          >
            {option.label}
            <span className={chipCountClass}>{option.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
