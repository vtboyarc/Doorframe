"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  ["Dashboard", ""],
  ["Imports", "imports"],
  ["Requirements", "requirements"],
  ["Matrix", "matrix"],
  ["Findings", "findings"],
  ["Trace graph", "trace-graph"],
  ["Baselines", "baselines"],
  ["Reports", "reports"],
  ["MCP setup", "mcp"],
  ["Settings", "settings"],
  ["Audit", "audit"]
] as const;

/** Tab text plus a pulsing underline while the tab's page is loading. */
function TabLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      {label}
      <span
        aria-hidden="true"
        className={`absolute inset-x-2 -bottom-0.5 h-0.5 bg-[var(--accent-strong)] ${
          pending ? "motion-safe:animate-pulse" : "hidden"
        }`}
      />
    </>
  );
}

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const projectPath = `/projects/${projectId}`;

  // The tabs wrap onto a second row in narrow windows rather than scrolling, so every tab stays visible.
  return (
    <nav aria-label="Project navigation" className="mx-auto max-w-7xl">
      <div className="flex flex-wrap gap-x-1 px-4 sm:px-6">
        {navItems.map(([label, segment]) => {
          const href = `${projectPath}${segment ? `/${segment}` : ""}`;
          const active = segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === projectPath;

          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium lg:px-2.5 xl:px-3 transition-colors focus-visible:outline-offset-[-2px] ${
                active
                  ? "border-[var(--accent-strong)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--foreground)]"
              }`}
            >
              <TabLabel label={label} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
