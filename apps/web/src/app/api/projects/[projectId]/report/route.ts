import { NextResponse } from "next/server";
import { getProjectData, recordAuditEvent } from "@/lib/db";
import { auditActor } from "@/lib/audit-actor";
import { reportFilename } from "@/lib/report-filename";
import { doorframeVersion } from "@/lib/version";
import type { ProjectData } from "@doorframe/core";
import {
  generateHtmlTraceabilityReport,
  generateJsonReport,
  generateMarkdownTraceabilityReport,
  generateTraceabilityMatrixCsv
} from "@doorframe/reporting";

export const runtime = "nodejs";

const FORMATS: Record<string, { label: string; contentType: string; ext: string; render: (data: ProjectData) => string }> = {
  html: {
    label: "HTML",
    contentType: "text/html; charset=utf-8",
    ext: "html",
    render: (data) => generateHtmlTraceabilityReport(data, { version: doorframeVersion() })
  },
  md: {
    label: "Markdown",
    contentType: "text/markdown; charset=utf-8",
    ext: "md",
    render: (data) => generateMarkdownTraceabilityReport(data)
  },
  json: {
    label: "JSON",
    contentType: "application/json; charset=utf-8",
    ext: "json",
    render: (data) => generateJsonReport(data)
  },
  csv: {
    label: "CSV matrix",
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
  if (!Object.hasOwn(FORMATS, formatKey)) {
    return NextResponse.json({ error: "Unknown report format. Use html, md, json, or csv." }, { status: 400 });
  }
  const format = FORMATS[formatKey];
  const download = url.searchParams.get("download") === "1";
  // The in-app preview re-renders on every visit to the Reports page; only
  // opening or downloading a report is recorded in the audit log.
  const preview = url.searchParams.get("preview") === "1";

  const body = format.render(data);
  if (!preview) {
    recordAuditEvent({
      projectId,
      action: "report.generated",
      actor: auditActor(),
      summary: `${download ? "Downloaded" : "Opened"} ${format.label} report.`
    });
  }

  const headers: Record<string, string> = { "Content-Type": format.contentType, "Cache-Control": "no-store" };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${reportFilename(data.project.name, "traceability", format.ext)}"`;
  }

  return new NextResponse(body, { headers });
};
