import { NextResponse } from "next/server";
import { getProject, getProjectData, recordAuditEvent } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import type { ProjectData } from "@doorframe/core";
import {
  generateHtmlTraceabilityReport,
  generateJsonReport,
  generateMarkdownTraceabilityReport,
  generateTraceabilityMatrixCsv
} from "@doorframe/reporting";

export const runtime = "nodejs";

const FORMATS: Record<string, { contentType: string; ext: string; render: (data: ProjectData) => string }> = {
  html: {
    contentType: "text/html; charset=utf-8",
    ext: "html",
    render: (data) => generateHtmlTraceabilityReport(data)
  },
  md: {
    contentType: "text/markdown; charset=utf-8",
    ext: "md",
    render: (data) => generateMarkdownTraceabilityReport(data)
  },
  json: {
    contentType: "application/json; charset=utf-8",
    ext: "json",
    render: (data) => generateJsonReport(data)
  },
  csv: {
    contentType: "text/csv; charset=utf-8",
    ext: "csv",
    render: (data) => generateTraceabilityMatrixCsv(data)
  }
};

export const GET = async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await context.params;
  const data = getProjectData(projectId);
  if (!data) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const formatKey = url.searchParams.get("format") ?? "html";
  const format = FORMATS[formatKey] ?? FORMATS.html;
  const download = url.searchParams.get("download") === "1";

  const body = format.render(data);
  recordAuditEvent({
    projectId,
    action: "report.generated",
    actor: auditActor(),
    summary: `Generated ${formatKey} report.`
  });

  const headers: Record<string, string> = { "Content-Type": format.contentType };
  if (download) {
    const name = (getProject(projectId)?.name ?? "doorframe").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    headers["Content-Disposition"] = `attachment; filename="${name}-report.${format.ext}"`;
  }

  return new NextResponse(body, { headers });
};
