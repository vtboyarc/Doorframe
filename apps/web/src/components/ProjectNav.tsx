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
    <nav aria-label="Project navigation" className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 pb-4">
      {navItems.map(([label, segment]) => {
        const href = `${projectPath}${segment ? `/${segment}` : ""}`;
        const active = segment ? pathname.startsWith(href) : pathname === projectPath;

        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border px-3 py-2 text-sm ${
              active
                ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white"
                : "border-[var(--line)] bg-[var(--background)] text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
