"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const navItems = [
  ["Dashboard", ""],
  ["Imports", "imports"],
  ["Requirements", "requirements"],
  ["Matrix", "matrix"],
  ["Findings", "findings"],
  ["Trace Graph", "trace-graph"],
  ["Baselines", "baselines"],
  ["Reports", "reports"],
  ["MCP Setup", "mcp"],
  ["Settings", "settings"],
  ["Audit", "audit"]
] as const;

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const projectPath = `/projects/${projectId}`;
  const activeRef = useRef<HTMLAnchorElement>(null);

  // On narrow screens the tab row scrolls horizontally; keep the current tab
  // visible. Scroll only the tab row so the page's own scroll position is kept.
  useEffect(() => {
    const tab = activeRef.current;
    const row = tab?.parentElement;
    if (!tab || !row) {
      return;
    }

    const rowBox = row.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    if (tabBox.left < rowBox.left || tabBox.right > rowBox.right) {
      row.scrollLeft += tabBox.left - rowBox.left - 16;
    }
  }, [pathname]);

  return (
    <nav aria-label="Project navigation" className="mx-auto max-w-7xl">
      <div className="flex gap-1 overflow-x-auto px-4 [scrollbar-color:var(--line-strong)_transparent] [scrollbar-width:thin] sm:px-6">
        {navItems.map(([label, segment]) => {
          const href = `${projectPath}${segment ? `/${segment}` : ""}`;
          const active = segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === projectPath;

          return (
            <Link
              key={label}
              href={href}
              ref={active ? activeRef : undefined}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium lg:px-2.5 xl:px-3 transition-colors focus-visible:outline-offset-[-2px] ${
                active
                  ? "border-[var(--accent-strong)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
