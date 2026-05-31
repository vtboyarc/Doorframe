import Link from "next/link";
import type { ReactNode } from "react";
import type { Project } from "@doorframe/core";

const navItems = [
  ["Dashboard", ""],
  ["Imports", "imports"],
  ["Requirements", "requirements"],
  ["Findings", "findings"],
  ["Trace Graph", "trace-graph"],
  ["Reports", "reports"]
] as const;

export function PageShell({
  project,
  children
}: {
  project?: Project;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center border border-[var(--foreground)] bg-[var(--foreground)] text-sm font-bold text-white">
              DF
            </div>
            <div>
              <div className="text-lg font-semibold">Doorframe</div>
              <div className="text-xs text-[var(--muted)]">Requirements exports are messy. Doorframe makes them reviewable.</div>
            </div>
          </Link>
          <div className="text-right text-sm text-[var(--muted)]">
            {project ? project.name : "Local-first traceability"}
          </div>
        </div>
        {project ? (
          <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 pb-4">
            {navItems.map(([label, href]) => (
              <Link
                key={label}
                href={`/projects/${project.id}${href ? `/${href}` : ""}`}
                className="whitespace-nowrap border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm hover:border-[var(--accent)]"
              >
                {label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
