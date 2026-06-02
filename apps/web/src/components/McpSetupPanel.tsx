"use client";

import { Clipboard, ClipboardCheck, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import type { McpHealthCheckResult, McpHealthStatus } from "@/lib/mcp-health";
import {
  dockerMcpLimitationText,
  generateMcpConfig,
  mcpClientOptions,
  starterQuestions,
  type McpClientId,
  type McpDataMode,
  type McpSetupSettings
} from "@/lib/mcp-setup";

const statusClass: Record<McpHealthStatus, string> = {
  pass: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
  warn: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
  fail: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-3 text-sm font-medium hover:border-[var(--accent)]"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <ClipboardCheck aria-hidden="true" size={16} /> : <Clipboard aria-hidden="true" size={16} />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function McpSetupPanel({
  projectName,
  projectId,
  projectPath,
  initialSettings,
  healthCheck
}: {
  projectName: string;
  projectId: string;
  projectPath: string;
  initialSettings: McpSetupSettings;
  healthCheck: McpHealthCheckResult;
}) {
  const [clientId, setClientId] = useState<McpClientId>(initialSettings.clientId);
  const [mode, setMode] = useState<McpDataMode>(initialSettings.mode);
  const [maxResults, setMaxResults] = useState(initialSettings.maxResults);
  const [hideRawText, setHideRawText] = useState(initialSettings.hideRawText);
  const [auditLogEnabled, setAuditLogEnabled] = useState(initialSettings.auditLogEnabled);
  const [auditLogPath, setAuditLogPath] = useState(initialSettings.auditLogPath ?? "");

  const settings = useMemo<McpSetupSettings>(
    () => ({
      clientId,
      projectPath,
      mode,
      maxResults,
      hideRawText,
      auditLogEnabled,
      auditLogPath
    }),
    [auditLogEnabled, auditLogPath, clientId, hideRawText, maxResults, mode, projectPath]
  );
  const generated = useMemo(() => generateMcpConfig(settings), [settings]);
  const selectedClient = mcpClientOptions.find((client) => client.id === clientId) ?? mcpClientOptions[0];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 border border-[var(--line)] bg-white p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-2xl font-semibold">MCP Setup</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            Configure an approved AI client to query this local Doorframe project through read-only MCP tools.
          </p>
        </div>
        <div className="text-sm text-[var(--muted)]">
          <div className="font-medium text-[var(--foreground)]">{projectName}</div>
          <div>{projectId}</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
        <div className="border border-[var(--line)] bg-white p-5">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium" htmlFor="mcp-client">
                AI client
              </label>
              <select
                id="mcp-client"
                className="mt-2 min-h-10 w-full border border-[var(--line)] bg-white px-3"
                value={clientId}
                onChange={(event) => setClientId(event.target.value as McpClientId)}
              >
                {mcpClientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-[var(--muted)]">{selectedClient.note}</p>
            </div>

            <div>
              <div className="text-sm font-medium">Data mode</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["summary", "standard", "detailed"] as const).map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className={`min-h-10 border px-4 text-sm font-medium ${
                      mode === candidate
                        ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] bg-white hover:border-[var(--accent)]"
                    }`}
                    onClick={() => setMode(candidate)}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Max results
                <input
                  className="mt-2 min-h-10 w-full border border-[var(--line)] px-3"
                  min={1}
                  max={500}
                  type="number"
                  value={maxResults}
                  onChange={(event) => setMaxResults(Number(event.target.value))}
                />
              </label>
              <label className="flex items-center gap-3 border border-[var(--line)] px-3 py-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={hideRawText}
                  onChange={(event) => setHideRawText(event.target.checked)}
                />
                Hide raw requirement text
              </label>
            </div>

            <div className="grid gap-3 border border-[var(--line)] bg-[var(--background)] p-4">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={auditLogEnabled}
                  onChange={(event) => setAuditLogEnabled(event.target.checked)}
                />
                Enable sanitized MCP audit log
              </label>
              <input
                className="min-h-10 border border-[var(--line)] bg-white px-3 text-sm"
                type="text"
                value={auditLogPath}
                placeholder="/absolute/path/to/doorframe-mcp-audit.jsonl"
                disabled={!auditLogEnabled}
                onChange={(event) => setAuditLogPath(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="border border-[var(--line)] bg-white p-5">
          <h2 className="text-lg font-semibold">Project</h2>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="font-medium">Database path</dt>
              <dd className="mt-1 break-all text-[var(--muted)]">{projectPath}</dd>
            </div>
            <div>
              <dt className="font-medium">MCP server status</dt>
              <dd className={healthCheck.ready ? "mt-1 text-[var(--success)]" : "mt-1 text-[var(--danger)]"}>
                {healthCheck.summary}
              </dd>
            </div>
          </dl>
          <p className="mt-4 border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm text-[var(--warning)]">
            Only connect Doorframe MCP to project data if your organization has approved the AI client and model for that data.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border border-[var(--line)] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Generated config</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{selectedClient.configLabel}</p>
            </div>
            <CopyButton text={generated.configText} label="Copy config" />
          </div>
          <pre className="mt-4 max-h-[440px] overflow-auto border border-[var(--line)] bg-[var(--background)] p-4 text-sm leading-6">
            {generated.configText}
          </pre>
          <p className="mt-3 text-sm text-[var(--muted)]">{generated.note}</p>
        </div>

        <div className="border border-[var(--line)] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">MCP command</h2>
            <CopyButton text={generated.commandText} label="Copy command" />
          </div>
          <pre className="mt-4 overflow-auto border border-[var(--line)] bg-[var(--background)] p-4 text-sm leading-6">
            {generated.commandText}
          </pre>
          <p className="mt-3 text-sm text-[var(--muted)]">{dockerMcpLimitationText(projectPath)}</p>
        </div>
      </section>

      <section className="border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{healthCheck.title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{healthCheck.summary}</p>
          </div>
          <form method="GET">
            <input type="hidden" name="client" value={clientId} />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="maxResults" value={String(maxResults)} />
            <input type="hidden" name="hideRawText" value={hideRawText ? "true" : "false"} />
            <input type="hidden" name="auditLogEnabled" value={auditLogEnabled ? "true" : "false"} />
            <input type="hidden" name="auditLogPath" value={auditLogPath} />
            <button
              type="submit"
              className="inline-flex min-h-10 items-center gap-2 border border-[var(--accent-strong)] bg-[var(--accent)] px-4 text-sm font-medium text-white"
            >
              <RefreshCw aria-hidden="true" size={16} />
              Run MCP health check
            </button>
          </form>
        </div>

        <div className="mt-4 grid gap-3">
          {healthCheck.checks.map((item) => (
            <div key={item.id} className="grid gap-2 border border-[var(--line)] p-3 text-sm md:grid-cols-[160px_1fr]">
              <div>
                <span className={`inline-flex border px-2 py-1 text-xs font-semibold uppercase ${statusClass[item.status]}`}>
                  {item.status}
                </span>
              </div>
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="mt-1 text-[var(--muted)]">{item.detail}</div>
                {item.fix ? <div className="mt-1 text-[var(--foreground)]">Fix: {item.fix}</div> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border border-[var(--line)] bg-[var(--background)] p-3 text-sm">
          <span className="font-medium">Try this:</span>
          <span>{healthCheck.suggestedQuestion}</span>
          <CopyButton text={healthCheck.suggestedQuestion} label="Copy question" />
        </div>
      </section>

      <section className="border border-[var(--line)] bg-white p-5">
        <h2 className="text-lg font-semibold">Starter questions</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {starterQuestions.map((group) => (
            <div key={group.group} className="border border-[var(--line)] p-4">
              <h3 className="font-semibold">{group.group}</h3>
              <div className="mt-3 grid gap-2">
                {group.questions.map((question) => (
                  <div key={question} className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-2 text-sm">
                    <span>{question}</span>
                    <CopyButton text={question} label="Copy" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-[var(--line)] bg-white p-5">
        <h2 className="text-lg font-semibold">Security reminder</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your
          data. Your organization is responsible for approving tools and workflows before use.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Doorframe MCP is optional. Doorframe works without AI. Data returned by MCP may become part of the connected AI
          client's context.
        </p>
      </section>
    </div>
  );
}
