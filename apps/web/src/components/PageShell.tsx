import Link from "next/link";
import type { ReactNode } from "react";
import type { Project } from "@doorframe/core";
import { ProjectNav } from "./ProjectNav";

export function PageShell({
  project,
  children
}: {
  project?: Project;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-[var(--accent-strong)] focus:bg-[var(--panel)] focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <header className="border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Doorframe home">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-[var(--accent-strong)] bg-[var(--panel-strong)] text-sm font-bold text-[var(--accent-strong)]">
              DF
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-tight">Doorframe</div>
              <div className="hidden text-xs text-[var(--muted)] sm:block">
                Requirements exports are messy. Doorframe makes them reviewable.
              </div>
            </div>
          </Link>
          {project ? (
            <Link
              href={`/projects/${project.id}`}
              title={project.name}
              className="min-w-0 max-w-[55%] truncate text-right text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {project.name}
            </Link>
          ) : (
            <div className="hidden text-right text-sm text-[var(--muted)] sm:block">Local-first traceability</div>
          )}
        </div>
        {project ? <ProjectNav projectId={project.id} /> : null}
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 outline-none sm:px-6">
        {children}
      </main>
    </div>
  );
}
