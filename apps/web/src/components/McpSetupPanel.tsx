"use client";

import { Clipboard, ClipboardCheck, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { McpHealthCheckResult, McpHealthStatus } from "@/lib/mcp-health";
import {
  dockerMcpLimitationText,
  generateMcpConfig,
  getMcpClientGuide,
  mcpClientOptions,
  mcpDataModeOptions,
  starterQuestions,
  type McpClientId,
  type McpDataMode,
  type McpHostPlatform,
  type McpSetupSettings
} from "@/lib/mcp-setup";

const statusClass: Record<McpHealthStatus, string> = {
  pass: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
  warn: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
  fail: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
};

function CopyButton({ text, label, compact }: { text: string; label: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 border border-[var(--line)] bg-white text-sm font-medium hover:border-[var(--accent)] ${
        compact ? "min-h-8 px-2" : "min-h-10 px-3"
      }`}
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

function StepHeading({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center bg-[var(--accent)] text-sm font-bold text-white"
      >
        {step}
      </span>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-[var(--muted)]">{hint}</p> : null}
      </div>
    </div>
  );
}

function detectBrowserPlatform(): McpHostPlatform {
  return /windows/i.test(navigator.userAgent) ? "windows" : "posix";
}

export function McpSetupPanel({
  projectName,
  projectId,
  projectPath,
  initialSettings,
  platformPinned,
  healthCheck
}: {
  projectName: string;
  projectId: string;
  projectPath: string;
  initialSettings: McpSetupSettings;
  platformPinned: boolean;
  healthCheck: McpHealthCheckResult;
}) {
  const [clientId, setClientId] = useState<McpClientId>(initialSettings.clientId);
  const [mode, setMode] = useState<McpDataMode>(initialSettings.mode);
  const [maxResults, setMaxResults] = useState(initialSettings.maxResults);
  const [hideRawText, setHideRawText] = useState(initialSettings.hideRawText);
  const [auditLogEnabled, setAuditLogEnabled] = useState(initialSettings.auditLogEnabled);
  const [auditLogPath, setAuditLogPath] = useState(initialSettings.auditLogPath ?? "");
  const [platform, setPlatform] = useState<McpHostPlatform>(initialSettings.platform ?? "posix");

  // The browser usually runs on the machine that will launch the MCP server,
  // unlike the web server (which may be in Docker/WSL). Prefer the browser's
  // OS unless the user already chose one explicitly.
  useEffect(() => {
    if (!platformPinned) {
      setPlatform(detectBrowserPlatform());
    }
  }, [platformPinned]);
  const settings = useMemo<McpSetupSettings>(
    () => ({
      clientId,
      projectPath,
      projectId,
      mode,
      maxResults,
      hideRawText,
      auditLogEnabled,
      auditLogPath,
      platform
    }),
    [auditLogEnabled, auditLogPath, clientId, hideRawText, maxResults, mode, platform, projectId, projectPath]
  );
  const generated = useMemo(() => generateMcpConfig(settings), [settings]);
  const selectedClient = mcpClientOptions.find((client) => client.id === clientId) ?? mcpClientOptions[0];
  const guide = useMemo(() => getMcpClientGuide(selectedClient.id, platform), [selectedClient.id, platform]);
  const isDockerPath = projectPath.replaceAll("\\", "/").startsWith("/data/");
  const dataOptionsSummary = `${mode} mode · max ${maxResults} results${hideRawText ? " · raw text hidden" : ""}${
    auditLogEnabled ? " · audit log on" : ""
  }`;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 border border-[var(--line)] bg-white p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-2xl font-semibold">MCP Setup</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            Connect an approved AI assistant to this project so you can ask it about requirements, traceability gaps,
            findings, and baseline changes. Access is read-only, runs entirely on this machine, and takes about two
            minutes to set up.
          </p>
        </div>
        <div className="text-sm lg:text-right">
          <div className="font-medium">{projectName}</div>
          <div className="text-[var(--muted)]">{projectId}</div>
          <span
            className={`mt-2 inline-flex border px-2 py-1 text-xs font-semibold uppercase ${
              healthCheck.ready ? statusClass.pass : statusClass.fail
            }`}
          >
            {healthCheck.ready ? "Project data ready" : "Needs attention"}
          </span>
        </div>
      </section>

      <section className="border border-[var(--line)] bg-white p-5">
        <StepHeading step={1} title="Choose your AI client" hint="Pick the tool you want to connect to Doorframe." />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="AI client">
          {mcpClientOptions.map((client) => {
            const selected = client.id === selectedClient.id;
            return (
              <button
                key={client.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`border p-3 text-left ${
                  selected
                    ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-white hover:border-[var(--accent)]"
                }`}
                onClick={() => setClientId(client.id)}
              >
                <div className="text-sm font-semibold">{client.label}</div>
                <div className={`mt-1 text-xs ${selected ? "text-white/85" : "text-[var(--muted)]"}`}>
                  {client.description}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
          <span className="text-sm font-medium">Client operating system</span>
          <div className="flex gap-2">
            {(
              [
                { id: "windows", label: "Windows" },
                { id: "posix", label: "macOS / Linux" }
              ] as const
            ).map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={`min-h-10 border px-4 text-sm font-medium ${
                  platform === candidate.id
                    ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-white hover:border-[var(--accent)]"
                }`}
                onClick={() => setPlatform(candidate.id)}
              >
                {candidate.label}
              </button>
            ))}
          </div>
          <span className="text-sm text-[var(--muted)]">
            {platformPinned ? "Where the AI client runs." : "Detected from this browser. Change it if the AI client runs elsewhere."}
            {platform === "windows" ? " Windows configs launch npx through cmd /c." : ""}
          </span>
        </div>
      </section>

      <section className="border border-[var(--line)] bg-white p-5">
        <StepHeading
          step={2}
          title={`Add Doorframe to ${selectedClient.label}`}
          hint={
            guide.kind === "unsupported"
              ? "ChatGPT and the OpenAI API cannot launch local MCP servers yet — here are your options."
              : guide.kind === "command"
                ? "Copy the command and follow the steps."
                : "Copy the config and follow the steps."
          }
        />

        {guide.kind === "unsupported" ? (
          <div className="mt-4 grid gap-4">
            <div className="border border-[var(--info)] bg-[var(--info-soft)] p-4 text-sm text-[var(--info)]">
              ChatGPT custom connectors and OpenAI API MCP flows expect a <strong>remote</strong> MCP server reachable
              over the network. Doorframe&apos;s MCP server is <strong>local stdio</strong> in this release: it runs as a
              process on your machine and never opens a network port. There is no URL to paste into ChatGPT.
            </div>
            <div>
              <div className="text-sm font-medium">What you can do instead</div>
              <ol className="mt-2 grid gap-2 text-sm">
                {guide.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="font-semibold text-[var(--muted)]">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--muted)]">Switch to a supported client:</span>
              {(["claude-desktop", "claude-code", "cursor", "vscode"] as const).map((id) => {
                const client = mcpClientOptions.find((candidate) => candidate.id === id);
                return client ? (
                  <button
                    key={id}
                    type="button"
                    className="min-h-8 border border-[var(--line)] bg-white px-3 text-sm font-medium hover:border-[var(--accent)]"
                    onClick={() => setClientId(id)}
                  >
                    {client.label}
                  </button>
                ) : null;
              })}
            </div>
            {guide.docsUrl ? (
              <a
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
                href={guide.docsUrl}
                target="_blank"
                rel="noreferrer"
              >
                {guide.docsLabel ?? "Client MCP docs"}
                <ExternalLink aria-hidden="true" size={14} />
              </a>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              {guide.configFile ? (
                <div className="border border-[var(--line)] bg-[var(--background)] p-3">
                  <div className="text-xs font-semibold uppercase text-[var(--muted)]">{guide.configFile.label}</div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <code className="break-all text-sm">{guide.configFile.path}</code>
                    <CopyButton compact text={guide.configFile.path} label="Copy path" />
                  </div>
                </div>
              ) : null}
              <ol className={`grid gap-3 text-sm ${guide.configFile ? "mt-4" : ""}`}>
                {guide.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-6 w-6 shrink-0 place-items-center border border-[var(--line)] bg-[var(--background)] text-xs font-semibold"
                    >
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {guide.docsUrl ? (
                <a
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
                  href={guide.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {guide.docsLabel ?? "Client MCP docs"}
                  <ExternalLink aria-hidden="true" size={14} />
                </a>
              ) : null}
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{guide.kind === "command" ? "Command to run" : "Config to paste"}</div>
                  <div className="text-sm text-[var(--muted)]">{selectedClient.configLabel}</div>
                </div>
                <CopyButton text={generated.configText} label={guide.kind === "command" ? "Copy command" : "Copy config"} />
              </div>
              <pre className="mt-3 max-h-[440px] overflow-auto border border-[var(--line)] bg-[var(--background)] p-4 text-sm leading-6">
                {generated.configText}
              </pre>
              <p className="mt-2 text-sm text-[var(--muted)]">{generated.note}</p>
              {isDockerPath ? (
                <p className="mt-2 border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm text-[var(--warning)]">
                  {dockerMcpLimitationText(projectPath)}
                </p>
              ) : null}
              {guide.kind !== "command" ? (
                <details className="mt-3 border border-[var(--line)]">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-[var(--background)]">
                    Prefer a raw server command? (advanced)
                  </summary>
                  <div className="border-t border-[var(--line)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-[var(--muted)]">
                        The exact process your AI client launches. Useful for form-based client settings.
                      </span>
                      <CopyButton compact text={generated.commandText} label="Copy" />
                    </div>
                    <pre className="mt-2 overflow-auto border border-[var(--line)] bg-[var(--background)] p-3 text-sm leading-6">
                      {generated.commandText}
                    </pre>
                    {!isDockerPath ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">{dockerMcpLimitationText(projectPath)}</p>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        )}

        <details className="mt-5 border border-[var(--line)]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-[var(--background)]">
            Data &amp; privacy options
            <span className="ml-2 font-normal text-[var(--muted)]">{dataOptionsSummary}</span>
          </summary>
          <div className="grid gap-4 border-t border-[var(--line)] p-4">
            <div>
              <div className="text-sm font-medium">Data mode</div>
              <p className="mt-1 text-sm text-[var(--muted)]">How much requirement text the AI client can read.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Data mode">
                {mcpDataModeOptions.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    role="radio"
                    aria-checked={mode === candidate.id}
                    className={`border p-3 text-left ${
                      mode === candidate.id
                        ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] bg-white hover:border-[var(--accent)]"
                    }`}
                    onClick={() => setMode(candidate.id)}
                  >
                    <div className="text-sm font-semibold">{candidate.label}</div>
                    <div className={`mt-1 text-xs ${mode === candidate.id ? "text-white/85" : "text-[var(--muted)]"}`}>
                      {candidate.detail}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Max results per query
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
                Hide raw requirement text in every mode
              </label>
            </div>

            <div className="grid gap-3 border border-[var(--line)] bg-[var(--background)] p-4">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={auditLogEnabled}
                  onChange={(event) => setAuditLogEnabled(event.target.checked)}
                />
                Write a sanitized audit log of MCP queries
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
            <p className="text-sm text-[var(--muted)]">
              Changing these options changes the generated config — re-copy it into your AI client afterwards.
            </p>
          </div>
        </details>
      </section>

      <section className="border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <StepHeading step={3} title="Verify the connection" hint={healthCheck.summary} />
          <form method="GET">
            <input type="hidden" name="client" value={clientId} />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="platform" value={platform} />
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
          <span className="font-medium">Then ask your AI client:</span>
          <span>{healthCheck.suggestedQuestion}</span>
          <CopyButton compact text={healthCheck.suggestedQuestion} label="Copy question" />
        </div>

        <dl className="mt-4 grid gap-1 text-sm text-[var(--muted)]">
          <div className="flex flex-wrap gap-2">
            <dt className="font-medium text-[var(--foreground)]">Project database:</dt>
            <dd className="break-all">{projectPath}</dd>
          </div>
        </dl>
      </section>

      <section className="border border-[var(--line)] bg-white p-5">
        <h2 className="text-lg font-semibold">Starter questions</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Copy one into your connected AI client to see what Doorframe MCP can answer.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {starterQuestions.map((group) => (
            <div key={group.group} className="border border-[var(--line)] p-4">
              <h3 className="font-semibold">{group.group}</h3>
              <div className="mt-3 grid gap-2">
                {group.questions.map((question) => (
                  <div
                    key={question}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-2 text-sm"
                  >
                    <span>{question}</span>
                    <CopyButton compact text={question} label="Copy" />
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
          Doorframe MCP is optional and read-only. Doorframe works without AI. Data returned by MCP may become part of
          the connected AI client&apos;s context.
        </p>
      </section>
    </div>
  );
}
