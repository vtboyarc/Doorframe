"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <nav aria-label="Project navigation" className="mx-auto flex max-w-7xl gap-1 px-6">
      {navItems.map(([label, segment]) => {
        const href = `${projectPath}${segment ? `/${segment}` : ""}`;
        const active = segment ? pathname.startsWith(href) : pathname === projectPath;

        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              active
                ? "border-[var(--accent-strong)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--foreground)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
