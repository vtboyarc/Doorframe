"use client";

import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { panelClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageShell>
      <section role="alert" className={`${panelClass} mx-auto max-w-xl p-6`}>
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Doorframe could not load this page. Check the terminal running Doorframe for details, then try again.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className={primaryButtonClass}>
            Try again
          </button>
          <Link href="/" className={secondaryButtonClass}>
            Back to projects
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
