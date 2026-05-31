import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { ProjectCreateForm } from "@/components/ProjectCreateForm";
import { listProjects } from "@/lib/db";

export default function HomePage() {
  const projects = listProjects();

  return (
    <PageShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h1 className="text-3xl font-semibold">Open-source requirements traceability and review tooling for regulated engineering teams.</h1>
          <p className="mt-3 max-w-3xl text-[var(--muted)]">
            Doorframe turns local requirements exports, Jira CSVs, and JUnit XML results into a local traceability graph, then flags gaps like missing verification, weak requirement language, stale links, and closed work with no test evidence.
          </p>
          <div className="mt-6 border border-[var(--warning)] bg-[#fff8e8] p-4 text-sm">
            Do not upload classified, controlled, proprietary, or sensitive data unless your environment is approved for that use.
          </div>

          <h2 className="mt-8 text-xl font-semibold">Projects</h2>
          <div className="mt-3 grid gap-3">
            {projects.length > 0 ? (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="border border-[var(--line)] bg-white p-4 hover:border-[var(--accent)]"
                >
                  <div className="font-semibold">{project.name}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">Updated {new Date(project.updatedAt).toLocaleString()}</div>
                </Link>
              ))
            ) : (
              <div className="border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
                No local projects yet.
              </div>
            )}
          </div>
        </section>
        <aside>
          <ProjectCreateForm />
        </aside>
      </div>
    </PageShell>
  );
}
