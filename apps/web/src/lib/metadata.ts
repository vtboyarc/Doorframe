import type { Metadata } from "next";
import { getProject } from "./db";

/** Tab title for a project page, e.g. "Findings · Falcon Telemetry Gateway Demo". */
export async function projectPageMetadata(
  params: Promise<{ projectId: string }>,
  section?: string
): Promise<Metadata> {
  const { projectId } = await params;
  const name = getProject(projectId)?.name ?? "Project not found";
  return { title: section ? `${section} · ${name}` : name };
}
