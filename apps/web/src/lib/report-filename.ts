/**
 * Download filename for a report: project-name slug, report kind, and the local calendar date of
 * the machine running Doorframe (not UTC), e.g. "falcon-demo-traceability-2026-09-27.html".
 */
export function reportFilename(projectName: string, kind: string, extension: string, now = new Date()): string {
  const slug = projectName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "doorframe";
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  return `${slug}-${kind}-${date}.${extension}`;
}
