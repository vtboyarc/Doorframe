import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { panelClass, primaryButtonClass } from "@/lib/ui";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <PageShell>
      <section className={`${panelClass} mx-auto max-w-xl p-6`}>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This project or page does not exist in the local data directory. It may have been deleted, or Doorframe may be
          running with a different data directory.
        </p>
        <Link href="/" className={`mt-5 ${primaryButtonClass}`}>
          Back to projects
        </Link>
      </section>
    </PageShell>
  );
}
