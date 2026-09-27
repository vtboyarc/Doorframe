"use client";

import { Clipboard, ClipboardCheck, ClipboardX, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { McpHealthCheckResult, McpHealthStatus } from "@/lib/mcp-health";
import {
  buildMcpDoctorCommandText,
  clampMaxResults,
  dockerMcpLimitationText,
  generateMcpConfig,
  getMcpClientGuide,
  MAX_RESULTS_LIMIT,
  mcpClientOptions,
  mcpDataModeOptions,
  pathStyle,
  starterQuestions,
  type McpClientId,
  type McpDataMode,
  type McpHostPlatform,
  type McpSetupSettings
} from "@/lib/mcp-setup";
import { fieldClass, panelClass, primaryButtonClass, secondaryButtonClass, textLinkClass } from "@/lib/ui";

const statusClass: Record<McpHealthStatus, string> = {
  pass: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
  warn: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
  fail: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
};

const platformLabels: Record<McpHostPlatform, string> = { windows: "Windows", posix: "macOS / Linux" };

/** Copy text, falling back to a hidden textarea where the Clipboard API is unavailable (plain HTTP) or denied. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function CopyButton({
  text,
  label,
  ariaLabel,
  compact
}: {
  text: string;
  label: string;
  ariaLabel?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const Icon = state === "copied" ? ClipboardCheck : state === "failed" ? ClipboardX : Clipboard;

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel ?? label}
        className={`${secondaryButtonClass} ${compact ? "min-h-8 px-2 text-xs" : ""}`}
        onClick={async () => {
          const copied = await copyText(text);
          setState(copied ? "copied" : "failed");
          window.setTimeout(() => setState("idle"), copied ? 1400 : 4000);
        }}
      >
        <Icon aria-hidden="true" size={compact ? 14 : 16} />
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed. Select the text and press Ctrl+C or Cmd+C." : ""}
      </span>
    </>
  );
}

function StepHeading({ step, title, hint }: { step: number; title: string; hint?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center border border-[var(--accent-strong)] text-sm font-bold text-[var(--accent-strong)]"
      >
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-[var(--muted)]">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Native radio buttons styled as cards, so arrow keys and screen readers behave as expected. */
function RadioCards<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  className
}: {
  name: string;
  legend: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string; description?: string }>;
  onChange: (value: T) => void;
  className: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className={className}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <label
              key={option.id}
              className={`block cursor-pointer border p-3 text-left transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent-strong)] ${
                selected
                  ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white"
                  : "border-[var(--line-strong)] bg-[var(--panel)] hover:border-[var(--accent-strong)]"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              <span className="block text-sm font-semibold">{option.label}</span>
              {option.description ? (
                <span className={`mt-1 block text-xs ${selected ? "text-white/85" : "text-[var(--muted)]"}`}>
                  {option.description}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function detectBrowserPlatform(): McpHostPlatform {
  return /windows/i.test(navigator.userAgent) ? "windows" : "posix";
}

export function McpSetupPanel({
  projectId,
  projectPath,
  hasRequirements,
  initialSettings,
  platformPinned,
  healthCheck
}: {
  projectId: string;
  projectPath: string;
  hasRequirements: boolean;
  initialSettings: McpSetupSettings;
  platformPinned: boolean;
  healthCheck: McpHealthCheckResult;
}) {
  const [clientId, setClientId] = useState<McpClientId>(initialSettings.clientId);
  const [mode, setMode] = useState<McpDataMode>(initialSettings.mode);
  const [maxResultsInput, setMaxResultsInput] = useState(String(initialSettings.maxResults));
  const [hideRawText, setHideRawText] = useState(initialSettings.hideRawText);
  const [auditLogEnabled, setAuditLogEnabled] = useState(initialSettings.auditLogEnabled);
  const [auditLogPath, setAuditLogPath] = useState(initialSettings.auditLogPath ?? "");
  const [platform, setPlatform] = useState<McpHostPlatform>(initialSettings.platform ?? "posix");
  // The OS the current checks were run for; auto-detection does not make them stale.
  const [checkedPlatform, setCheckedPlatform] = useState<McpHostPlatform>(initialSettings.platform ?? "posix");
  const maxResults = clampMaxResults(maxResultsInput);

  // The browser usually runs on the machine that will launch the MCP server,
  // unlike the web server (which may be in Docker/WSL). Prefer the browser's
  // OS unless the user already chose one explicitly.
  useEffect(() => {
    if (!platformPinned) {
      const detected = detectBrowserPlatform();
      setPlatform(detected);
      setCheckedPlatform(detected);
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
      platform,
      packageVersion: initialSettings.packageVersion
    }),
    [
      auditLogEnabled,
      auditLogPath,
      clientId,
      hideRawText,
      initialSettings.packageVersion,
      maxResults,
      mode,
      platform,
      projectId,
      projectPath
    ]
  );
  const generated = useMemo(() => generateMcpConfig(settings), [settings]);
  const doctorCommand = useMemo(() => buildMcpDoctorCommandText(settings), [settings]);
  const selectedClient = mcpClientOptions.find((client) => client.id === clientId) ?? mcpClientOptions[0];
  const guide = useMemo(() => getMcpClientGuide(selectedClient.id, platform), [selectedClient.id, platform]);
  const isDockerPath = projectPath.replaceAll("\\", "/").startsWith("/data/");
  const databaseStyle = pathStyle(projectPath);
  const platformMismatch = !isDockerPath && databaseStyle !== "unknown" && databaseStyle !== platform;
  const auditPathMissing = generated.warnings.includes("audit-log-path-missing");
  const dataOptionsSummary = [
    `${mcpDataModeOptions.find((option) => option.id === mode)?.label ?? mode} mode`,
    `max ${maxResults} results`,
    hideRawText ? "raw text hidden" : null,
    auditLogEnabled ? (auditPathMissing ? "audit log: path needed" : "audit log on") : null
  ]
    .filter(Boolean)
    .join(" · ");
  const checkIsStale =
    mode !== initialSettings.mode ||
    maxResults !== initialSettings.maxResults ||
    hideRawText !== initialSettings.hideRawText ||
    auditLogEnabled !== initialSettings.auditLogEnabled ||
    auditLogPath.trim() !== (initialSettings.auditLogPath ?? "").trim() ||
    platform !== checkedPlatform;
  const readiness = isDockerPath
    ? { label: "Setup limited in Docker", className: statusClass.warn }
    : healthCheck.ready
      ? { label: "Project data ready", className: statusClass.pass }
      : { label: "Needs attention", className: statusClass.fail };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">MCP setup</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            Connect an approved AI client to this project through Doorframe&apos;s local, read-only MCP server, then ask it
            about requirements, traceability gaps, findings, and baseline changes. Setup takes a few minutes.
          </p>
        </div>
        <span className={`inline-flex shrink-0 border px-2 py-1 text-xs font-semibold uppercase ${readiness.className}`}>
          {readiness.label}
        </span>
      </div>

      <aside className="flex gap-3 border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm" aria-label="Before you connect">
        <ShieldAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" />
        <div className="grid gap-2">
          <p>
            The Doorframe MCP server runs on this machine and only reads project data. Anything it returns may become part
            of your AI client&apos;s context and may be sent to that client&apos;s model provider.
          </p>
          <p>
            Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your
            data. Your organization is responsible for approving tools and workflows before use.
          </p>
        </div>
      </aside>

      {!hasRequirements ? (
        <section className="border border-[var(--accent-strong)] bg-[var(--info-soft)] p-4 text-sm">
          <p className="font-medium">This project has no requirements yet.</p>
          <p className="mt-1 text-[var(--muted)]">
            An AI client connected now would have nothing to answer with. Import requirements (or load the fictional demo
            data from the dashboard) first, then come back to connect a client.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/projects/${projectId}/imports`} className={primaryButtonClass}>
              Import data
            </Link>
            <Link href={`/projects/${projectId}`} className={secondaryButtonClass}>
              Go to dashboard
            </Link>
          </div>
        </section>
      ) : null}

      <section className={`${panelClass} p-5`}>
        <StepHeading step={1} title="Choose your AI client" hint="Pick the MCP-compatible tool your organization approved." />
        <div className="mt-4">
          <RadioCards
            name="mcp-client"
            legend="AI client"
            value={selectedClient.id}
            onChange={setClientId}
            options={mcpClientOptions.map((client) => ({ id: client.id, label: client.label, description: client.description }))}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
          <span className="text-sm font-medium">Operating system where the AI client runs</span>
          <RadioCards
            name="mcp-platform"
            legend="Operating system where the AI client runs"
            value={platform}
            onChange={setPlatform}
            options={(["windows", "posix"] as const).map((id) => ({ id, label: platformLabels[id] }))}
            className="flex gap-2 [&>label]:px-4 [&>label]:py-2"
          />
          <span className="text-sm text-[var(--muted)]">
            {platformPinned ? "" : "Detected from this browser. "}
            {platform === "windows" ? "Windows configs start npx through cmd /c." : ""}
          </span>
        </div>
      </section>

      {guide.kind !== "unsupported" ? (
        <section className={`${panelClass} p-5`}>
          <StepHeading
            step={2}
            title="Choose what the AI client can see"
            hint="These options are written into the generated config. Pick them before you copy it."
          />
          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <div className="text-sm font-medium">Data mode</div>
              <p className="mt-0.5 text-sm text-[var(--muted)]">How much requirement text the AI client can read.</p>
              <div className="mt-2">
                <RadioCards
                  name="mcp-mode"
                  legend="Data mode"
                  value={mode}
                  onChange={setMode}
                  options={mcpDataModeOptions.map((option) => ({ id: option.id, label: option.label, description: option.detail }))}
                  className="grid grid-cols-1 gap-2 md:grid-cols-3"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="mcp-max-results" className="text-sm font-medium">
                  Max results per question
                </label>
                <input
                  id="mcp-max-results"
                  className={`mt-1 ${fieldClass}`}
                  min={1}
                  max={MAX_RESULTS_LIMIT}
                  type="number"
                  inputMode="numeric"
                  value={maxResultsInput}
                  onChange={(event) => setMaxResultsInput(event.target.value)}
                  onBlur={() => setMaxResultsInput(String(maxResults))}
                  aria-describedby="mcp-max-results-help"
                />
                <p id="mcp-max-results-help" className="mt-1 text-xs text-[var(--muted)]">
                  Caps list answers. Between 1 and {MAX_RESULTS_LIMIT}; default 25.
                </p>
              </div>
              <label className="flex items-start gap-3 border border-[var(--line-strong)] p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  checked={hideRawText}
                  onChange={(event) => setHideRawText(event.target.checked)}
                />
                <span>
                  <span className="block font-medium">Hide raw requirement text in every mode</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    Even detail questions return IDs, titles, and findings without the requirement text.
                  </span>
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 border border-[var(--line)] bg-[var(--background)] p-4">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={auditLogEnabled}
                  onChange={(event) => setAuditLogEnabled(event.target.checked)}
                />
                Write a sanitized audit log of MCP questions
              </label>
              <p className="text-xs text-[var(--muted)]">
                Records tool names, parameters, result counts, and timing as JSON lines. Never records requirement text.
              </p>
              <label htmlFor="mcp-audit-path" className="sr-only">
                Audit log file path
              </label>
              <input
                id="mcp-audit-path"
                className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-50 ${auditPathMissing ? "border-[var(--danger)]" : ""}`}
                type="text"
                value={auditLogPath}
                placeholder={platform === "windows" ? "C:\\doorframe\\mcp-audit.jsonl" : "/absolute/path/to/doorframe-mcp-audit.jsonl"}
                disabled={!auditLogEnabled}
                aria-invalid={auditPathMissing ? true : undefined}
                aria-describedby={auditPathMissing ? "mcp-audit-path-error" : undefined}
                onChange={(event) => setAuditLogPath(event.target.value)}
              />
              {auditPathMissing ? (
                <p id="mcp-audit-path-error" className="text-sm text-[var(--danger)]">
                  Enter an absolute file path. Audit logging is not in the config until you do.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className={`${panelClass} p-5`}>
        <StepHeading
          step={guide.kind === "unsupported" ? 2 : 3}
          title={`Add Doorframe to ${selectedClient.label}`}
          hint={
            guide.kind === "unsupported"
              ? "ChatGPT and the OpenAI API cannot start local MCP servers. Here are your options."
              : guide.kind === "command"
                ? "Copy the command and follow the steps."
                : "Copy the config and follow the steps."
          }
        />

        {guide.kind === "unsupported" ? (
          <div className="mt-4 grid grid-cols-1 gap-4">
            <div className="border border-[var(--info)] bg-[var(--info-soft)] p-4 text-sm text-[var(--info)]">
              ChatGPT custom connectors and OpenAI API MCP flows expect a <strong>remote</strong>{" "}
              MCP server reachable over the network. Doorframe&apos;s MCP server is <strong>local stdio</strong>{" "}
              in this release: it runs as a process on your machine and never opens a network port. There is no URL to
              paste into ChatGPT.
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
                  <button key={id} type="button" className={`${secondaryButtonClass} min-h-8 px-3`} onClick={() => setClientId(id)}>
                    {client.label}
                  </button>
                ) : null;
              })}
            </div>
            {guide.docsUrl ? (
              <a className={`inline-flex items-center gap-1 text-sm ${textLinkClass}`} href={guide.docsUrl} target="_blank" rel="noreferrer">
                {guide.docsLabel ?? "Client MCP docs"}
                <ExternalLink aria-hidden="true" size={14} />
              </a>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="min-w-0">
              {guide.configFile ? (
                <div className="border border-[var(--line)] bg-[var(--background)] p-3">
                  <div className="text-xs font-semibold uppercase text-[var(--muted)]">{guide.configFile.label}</div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <code className="break-all text-sm">{guide.configFile.path}</code>
                    <CopyButton compact text={guide.configFile.path} label="Copy path" ariaLabel="Copy config file path" />
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
                  className={`mt-4 inline-flex items-center gap-1 text-sm ${textLinkClass}`}
                  href={guide.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {guide.docsLabel ?? "Client MCP docs"}
                  <ExternalLink aria-hidden="true" size={14} />
                </a>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{guide.kind === "command" ? "Command to run" : "Config to paste"}</div>
                  <div className="text-sm text-[var(--muted)]">{selectedClient.configLabel}</div>
                </div>
                <CopyButton text={generated.configText} label={guide.kind === "command" ? "Copy command" : "Copy config"} />
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">Data options: {dataOptionsSummary}</p>
              {auditPathMissing ? (
                <p className="mt-2 border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
                  Audit logging is checked but has no file path, so this config does not write an audit log.
                </p>
              ) : null}
              {platformMismatch ? (
                <p className="mt-2 border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm">
                  This database path comes from the {databaseStyle === "windows" ? "Windows" : "macOS/Linux"} machine running
                  Doorframe, but the AI client is set to {platformLabels[platform]}. The client cannot open that path. Run
                  the AI client on the same machine as Doorframe, or run Doorframe where the client runs.
                </p>
              ) : null}
              <pre className="mt-3 overflow-auto whitespace-pre-wrap border border-[var(--line)] bg-[var(--background)] p-4 text-sm leading-6 [overflow-wrap:anywhere]">
                {generated.configText}
              </pre>
              <p className="mt-2 text-sm text-[var(--muted)]">{generated.note}</p>
              {isDockerPath ? (
                <p className="mt-2 border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm">
                  {dockerMcpLimitationText(projectPath)}
                </p>
              ) : null}
              {guide.kind !== "command" ? (
                <details className="mt-3 border border-[var(--line)]">
                  <summary className="px-3 py-2 text-sm font-medium hover:bg-[var(--background)]">
                    Prefer a raw server command? (advanced)
                  </summary>
                  <div className="border-t border-[var(--line)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-[var(--muted)]">
                        The exact process your AI client starts. Useful for form-based client settings.
                      </span>
                      <CopyButton compact text={generated.commandText} label="Copy" ariaLabel="Copy raw server command" />
                    </div>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap border border-[var(--line)] bg-[var(--background)] p-3 text-sm leading-6 [overflow-wrap:anywhere]">
                      {generated.commandText}
                    </pre>
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section id="verify" className={`${panelClass} scroll-mt-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <StepHeading step={guide.kind === "unsupported" ? 3 : 4} title="Check the setup" hint={healthCheck.summary} />
          <form method="GET" action="#verify">
            <input type="hidden" name="client" value={clientId} />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="maxResults" value={String(maxResults)} />
            <input type="hidden" name="hideRawText" value={hideRawText ? "true" : "false"} />
            <input type="hidden" name="auditLogEnabled" value={auditLogEnabled ? "true" : "false"} />
            <input type="hidden" name="auditLogPath" value={auditLogPath} />
            <button type="submit" className={primaryButtonClass}>
              <RefreshCw aria-hidden="true" size={16} />
              {checkIsStale ? "Re-run checks" : "Run checks again"}
            </button>
          </form>
        </div>

        {checkIsStale ? (
          <p className="mt-3 text-sm text-[var(--warning)]">Options changed since these checks ran. Re-run to update them.</p>
        ) : null}

        <ul className="mt-4 grid gap-2">
          {healthCheck.checks.map((item) => (
            <li key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border border-[var(--line)] p-3 text-sm">
              <span
                className={`inline-flex h-fit w-14 justify-center border px-2 py-0.5 text-xs font-semibold uppercase ${statusClass[item.status]}`}
              >
                {item.status}
              </span>
              <div className="min-w-0">
                <div className="font-medium">{item.label}</div>
                <div className="mt-0.5 text-[var(--muted)] [overflow-wrap:anywhere]">{item.detail}</div>
                {item.fix ? <div className="mt-1 [overflow-wrap:anywhere]">Fix: {item.fix}</div> : null}
              </div>
            </li>
          ))}
        </ul>

        {guide.kind !== "unsupported" ? (
          <div className="mt-4 border border-[var(--line)] bg-[var(--background)] p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">Test from the AI client&apos;s machine</div>
                <p className="mt-0.5 text-[var(--muted)]">
                  The checks above run inside the Doorframe web app. To confirm the server starts where your AI client runs,
                  paste this into a terminal there. It starts Doorframe MCP, lists its tools, and calls two of them.
                </p>
              </div>
              <CopyButton compact text={doctorCommand} label="Copy command" ariaLabel="Copy MCP doctor command" />
            </div>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap border border-[var(--line)] p-3 text-xs leading-5 [overflow-wrap:anywhere]">
              {doctorCommand}
            </pre>
          </div>
        ) : null}

        {hasRequirements ? (
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-[var(--line)] bg-[var(--background)] p-3 text-sm">
            <span>
              <span className="font-medium">Then ask your AI client:</span> {healthCheck.suggestedQuestion}
            </span>
            <CopyButton
              compact
              text={healthCheck.suggestedQuestion}
              label="Copy"
              ariaLabel={`Copy question: ${healthCheck.suggestedQuestion}`}
            />
          </div>
        ) : null}

        <p className="mt-3 text-sm text-[var(--muted)]">
          MCP package: <code className="break-all">{generated.packageSpec}</code>
        </p>
      </section>

      <section className={`${panelClass} p-5`}>
        <h2 className="text-lg font-semibold">Starter questions</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Copy one into your connected AI client to see what Doorframe MCP can answer.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {starterQuestions.map((group) => (
            <div key={group.group} className="border border-[var(--line)] p-4">
              <h3 className="font-semibold">{group.group}</h3>
              <ul className="mt-3 grid gap-2">
                {group.questions.map((question) => (
                  <li
                    key={question}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--line)] pt-2 text-sm"
                  >
                    <span>{question}</span>
                    <CopyButton compact text={question} label="Copy" ariaLabel={`Copy question: ${question}`} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Doorframe MCP is optional and read-only. Doorframe works without AI: the same facts are available on the Findings,
          Baselines, and Reports pages.
        </p>
      </section>
    </div>
  );
}
