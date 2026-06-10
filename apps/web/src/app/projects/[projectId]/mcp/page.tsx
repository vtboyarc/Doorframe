import { notFound } from "next/navigation";
import { McpSetupPanel } from "@/components/McpSetupPanel";
import { PageShell } from "@/components/PageShell";
import { getDoorframeDatabasePath, getProjectData, listBaselines } from "@/lib/db";
import { runMcpHealthCheck } from "@/lib/mcp-health";
import {
  mcpClientOptions,
  type McpClientId,
  type McpDataMode,
  type McpHostPlatform,
  type McpSetupSettings
} from "@/lib/mcp-setup";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseClientId(value: string | undefined): McpClientId {
  return mcpClientOptions.some((client) => client.id === value) ? (value as McpClientId) : "claude-desktop";
}

function parseMode(value: string | undefined): McpDataMode {
  return value === "summary" || value === "standard" || value === "detailed" ? value : "standard";
}

function parseMaxResults(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.floor(parsed), 500)) : 25;
}

function parsePlatform(value: string | undefined): McpHostPlatform | undefined {
  return value === "windows" || value === "posix" ? value : undefined;
}

export default async function McpSetupPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const data = getProjectData(projectId);

  if (!data) {
    notFound();
  }

  const projectPath = getDoorframeDatabasePath();
  const baselines = listBaselines(projectId);
  const platformParam = parsePlatform(firstParam(resolvedSearchParams, "platform"));
  const initialSettings: McpSetupSettings = {
    clientId: parseClientId(firstParam(resolvedSearchParams, "client")),
    projectPath,
    projectId,
    mode: parseMode(firstParam(resolvedSearchParams, "mode")),
    maxResults: parseMaxResults(firstParam(resolvedSearchParams, "maxResults")),
    hideRawText: firstParam(resolvedSearchParams, "hideRawText") === "true",
    auditLogEnabled: firstParam(resolvedSearchParams, "auditLogEnabled") === "true",
    auditLogPath: firstParam(resolvedSearchParams, "auditLogPath"),
    platform: platformParam ?? (process.platform === "win32" ? "windows" : "posix")
  };
  const healthCheck = runMcpHealthCheck({
    projectPath,
    projectData: data,
    baselines,
    mode: initialSettings.mode,
    maxResults: initialSettings.maxResults,
    hideRawText: initialSettings.hideRawText,
    auditLogEnabled: initialSettings.auditLogEnabled,
    auditLogPath: initialSettings.auditLogPath
  });

  return (
    <PageShell project={data.project}>
      <McpSetupPanel
        projectName={data.project.name}
        projectId={data.project.id}
        projectPath={projectPath}
        initialSettings={initialSettings}
        platformPinned={platformParam !== undefined}
        healthCheck={healthCheck}
      />
    </PageShell>
  );
}
