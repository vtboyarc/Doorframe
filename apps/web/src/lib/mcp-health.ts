import fs from "node:fs";
import path from "node:path";
import type { Baseline, ProjectData } from "@doorframe/core";
import {
  getProjectSummaryData,
  getReviewBriefData,
  getStaleTraceCandidatesData,
  searchRequirementsData
} from "../../../mcp-server/src/tools";
import { plural } from "./import-messages";
import {
  clampMaxResults,
  parseMcpDataMode,
  pathStyle,
  unsafeAuditLogPathCharacters,
  type McpDataMode,
  type McpHostPlatform
} from "./mcp-setup";

export type McpHealthStatus = "pass" | "warn" | "fail";

export interface McpHealthCheckItem {
  id: string;
  label: string;
  status: McpHealthStatus;
  detail: string;
  fix?: string;
}

/**
 * Inputs for the checks that run on every page render. They only read files and counts, so
 * they stay fast on large projects. The MCP tool checks run separately in runMcpToolChecks.
 */
export interface RunMcpHealthCheckInput {
  projectPath: string;
  projectData: ProjectData | null;
  baselines: Baseline[];
  auditLogEnabled?: boolean;
  auditLogPath?: string;
  /** Operating system of the machine where the AI client launches the MCP server. */
  platform?: McpHostPlatform;
  /** Operating system of the Doorframe server running these checks. Defaults to this process's platform. */
  serverPlatform?: McpHostPlatform;
  mcpEntrypointCandidates?: string[];
}

export interface McpHealthCheckResult {
  title: string;
  ready: boolean;
  summary: string;
  checks: McpHealthCheckItem[];
  suggestedQuestion: string;
}

/** Data options the MCP tool checks ran with, so the page can tell when they are out of date. */
export interface McpToolCheckSettings {
  mode: McpDataMode;
  maxResults: number;
  hideRawText: boolean;
}

export interface RunMcpToolChecksInput extends Partial<McpToolCheckSettings> {
  projectData: ProjectData;
  baselines: Baseline[];
}

export interface McpToolCheckResult {
  ready: boolean;
  settings: McpToolCheckSettings;
  checks: McpHealthCheckItem[];
}

function check(
  id: string,
  label: string,
  status: McpHealthStatus,
  detail: string,
  fix?: string
): McpHealthCheckItem {
  return { id, label, status, detail, fix };
}

function defaultEntrypointCandidates(): string[] {
  const cwd = process.cwd();
  const roots = Array.from(new Set([cwd, path.resolve(cwd, "..", "..")]));
  const candidates = roots.flatMap((root) => [
    path.join(root, "apps", "mcp-server", "src", "index.ts"),
    path.join(root, "apps", "mcp-server", "bin", "doorframe-mcp.mjs"),
    path.join(root, "apps", "cli", "dist", "index.js")
  ]);

  // Set by `doorframe serve` so packaged installs (npx/global) pass this
  // check even though no source checkout exists relative to the cwd.
  const packagedEntrypoint = process.env.DOORFRAME_CLI_ENTRYPOINT;
  if (packagedEntrypoint) {
    candidates.unshift(packagedEntrypoint);
  }

  return candidates;
}

function readableFile(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function writable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function statOrUndefined(filePath: string): fs.Stats | undefined {
  try {
    return fs.statSync(filePath);
  } catch {
    return undefined;
  }
}

/** The closest folder or file above filePath that exists, or undefined when none does. */
function nearestExistingAncestor(filePath: string): { path: string; stats: fs.Stats } | undefined {
  let current = path.dirname(filePath);
  for (;;) {
    const stats = statOrUndefined(current);
    if (stats) {
      return { path: current, stats };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

const AUDIT_CHECK_ID = "audit-log-writable";
const AUDIT_CHECK_LABEL = "Audit log path writable";

/**
 * Mirrors what the MCP server does with --audit-log: it creates missing folders, then appends
 * to the file. So a folder path fails, an existing file must be writable, and for a new file
 * the nearest existing folder above it must be writable.
 */
export function checkAuditLogPath(auditPath: string): McpHealthCheckItem {
  const resolved = path.resolve(auditPath);
  const stats = statOrUndefined(resolved);

  if (stats?.isDirectory()) {
    return check(
      AUDIT_CHECK_ID,
      AUDIT_CHECK_LABEL,
      "fail",
      `Audit log path is a folder: ${resolved}.`,
      `Enter a file path, such as ${path.join(resolved, "doorframe-mcp-audit.jsonl")}.`
    );
  }

  if (stats) {
    return writable(resolved)
      ? check(AUDIT_CHECK_ID, AUDIT_CHECK_LABEL, "pass", resolved)
      : check(
          AUDIT_CHECK_ID,
          AUDIT_CHECK_LABEL,
          "fail",
          `Audit log file is not writable: ${resolved}.`,
          "Choose a file the MCP server process can write, or change the file's permissions."
        );
  }

  const ancestor = nearestExistingAncestor(resolved);
  if (!ancestor || !ancestor.stats.isDirectory()) {
    return check(
      AUDIT_CHECK_ID,
      AUDIT_CHECK_LABEL,
      "fail",
      ancestor
        ? `Cannot create the audit log folder because ${ancestor.path} is a file, not a folder.`
        : `No existing folder was found above ${resolved}.`,
      "Choose a path inside a folder that exists and is writable."
    );
  }

  if (!writable(ancestor.path)) {
    return check(
      AUDIT_CHECK_ID,
      AUDIT_CHECK_LABEL,
      "fail",
      `Audit log folder is not writable: ${ancestor.path}.`,
      "Choose a writable local folder and avoid logging full project text."
    );
  }

  const createsFolder = ancestor.path !== path.dirname(resolved);
  return check(
    AUDIT_CHECK_ID,
    AUDIT_CHECK_LABEL,
    "pass",
    `${resolved} (${createsFolder ? "folder" : "file"} will be created on the first MCP tool call)`
  );
}

function auditLogCheck(input: RunMcpHealthCheckInput): McpHealthCheckItem {
  if (!input.auditLogEnabled) {
    return check(AUDIT_CHECK_ID, AUDIT_CHECK_LABEL, "pass", "Audit logging is off by default.");
  }

  const auditPath = input.auditLogPath?.trim();
  if (!auditPath) {
    return check(
      AUDIT_CHECK_ID,
      AUDIT_CHECK_LABEL,
      "fail",
      "Audit logging is enabled but no audit log path is configured.",
      "Choose a local JSONL path visible to the MCP server process."
    );
  }

  const unsafeCharacters = unsafeAuditLogPathCharacters(auditPath, input.platform);
  if (unsafeCharacters.length > 0) {
    return check(
      AUDIT_CHECK_ID,
      AUDIT_CHECK_LABEL,
      "fail",
      `Audit log path contains characters that cannot go into the generated command: ${unsafeCharacters.join(" ")}. The config leaves out audit logging until the path is changed.`,
      "Choose a path without these characters."
    );
  }

  if (pathStyle(auditPath) === "unknown") {
    return check(
      AUDIT_CHECK_ID,
      AUDIT_CHECK_LABEL,
      "warn",
      `Audit log path is relative: ${auditPath}. The MCP server may run from a different working directory than this web app.`,
      "Use an absolute local path for the audit log."
    );
  }

  if (pathStyle(auditPath) !== (input.serverPlatform ?? (process.platform === "win32" ? "windows" : "posix"))) {
    return check(
      AUDIT_CHECK_ID,
      AUDIT_CHECK_LABEL,
      "warn",
      `Cannot check ${auditPath} from the Doorframe server, which runs on a different operating system.`,
      "Make sure the folder exists and is writable on the computer that runs the AI client."
    );
  }

  return checkAuditLogPath(auditPath);
}

/** Fast checks for the MCP setup page. They never run analyzers or MCP tools. */
export function runMcpHealthCheck(input: RunMcpHealthCheckInput): McpHealthCheckResult {
  const checks: McpHealthCheckItem[] = [];

  if (!input.projectData) {
    checks.push(
      check(
        "project-found",
        "Project found",
        "fail",
        "No Doorframe project is open.",
        "Open or create a Doorframe project before configuring MCP."
      )
    );
  } else {
    checks.push(check("project-found", "Project found", "pass", `Project found: ${input.projectData.project.name}`));
  }

  if (!input.projectPath.trim()) {
    checks.push(
      check(
        "database-readable",
        "Database readable",
        "fail",
        "Doorframe could not determine a project database path.",
        "Start Doorframe with a configured data directory and open a project."
      )
    );
  } else if (readableFile(input.projectPath)) {
    checks.push(check("database-readable", "Database readable", "pass", input.projectPath));
  } else {
    checks.push(
      check(
        "database-readable",
        "Database readable",
        "fail",
        `Database is not readable at ${input.projectPath}.`,
        "Use the absolute path to the Doorframe SQLite database visible to the AI client."
      )
    );
  }

  const databaseStyle = pathStyle(input.projectPath);
  if (input.projectPath.replaceAll("\\", "/").startsWith("/data/")) {
    checks.push(
      check(
        "container-path",
        "Database path usable by the AI client",
        "warn",
        `${input.projectPath} is a path inside the Doorframe Docker container. A desktop AI client cannot open it or start the MCP server there.`,
        "Run Doorframe with npx on the machine where the AI client runs, or mount the data folder on the host and use the host path."
      )
    );
  } else if (input.platform && databaseStyle !== "unknown" && databaseStyle !== input.platform) {
    checks.push(
      check(
        "path-platform",
        "Database path usable by the AI client",
        "warn",
        `The database path is a ${databaseStyle === "windows" ? "Windows" : "macOS/Linux"} path, but the AI client is set to ${
          input.platform === "windows" ? "Windows" : "macOS/Linux"
        }.`,
        "Run the AI client on the same machine and operating system as Doorframe, or install Doorframe where the client runs."
      )
    );
  }

  if (input.projectData && input.projectData.requirements.length > 0) {
    checks.push(
      check("requirements-found", "Requirements imported", "pass", `${input.projectData.requirements.length} requirement(s) found.`)
    );
  } else {
    checks.push(
      check(
        "requirements-found",
        "Requirements imported",
        "fail",
        "This project has no requirements.",
        "Import requirements before using Doorframe MCP for project review questions."
      )
    );
  }

  if (input.projectData) {
    // Analysis re-runs whenever project data or the ruleset changes, so the stored findings are
    // what the MCP findings tools return. Re-running the analyzers here would be slow on large projects.
    const findingCount = input.projectData.findings.length;
    checks.push(
      check(
        "analysis-results",
        "Analysis results",
        "pass",
        findingCount > 0
          ? `${plural(findingCount, "finding")} from the latest analysis.`
          : "No findings with the current ruleset. Finding questions will return empty lists."
      )
    );
  }

  const baselineCount = input.baselines.length;
  if (baselineCount >= 2) {
    checks.push(check("baseline-data", "Baselines for change questions", "pass", `${baselineCount} baseline(s) available.`));
  } else {
    checks.push(
      check(
        "baseline-data",
        "Baselines for change questions",
        "warn",
        "Baseline-specific MCP tools will be limited until at least two baselines exist. Project summary, findings, and traceability-gap tools can still work.",
        "Create two baselines before asking baseline-diff or stale-trace questions, or ignore this warning for projects that do not use baseline review yet."
      )
    );
  }

  const entrypoint = (input.mcpEntrypointCandidates ?? defaultEntrypointCandidates()).find(readableFile);
  if (entrypoint) {
    checks.push(check("mcp-entrypoint", "Doorframe installed on this server", "pass", entrypoint));
  } else {
    checks.push(
      check(
        "mcp-entrypoint",
        "Doorframe installed on this server",
        "warn",
        "The web app could not find a local Doorframe install. The generated config starts Doorframe with npx on the AI client's machine, which needs npm registry access (or an internal mirror) the first time.",
        "Install Doorframe where the AI client runs, or make sure that machine can reach your npm registry."
      )
    );
  }

  checks.push(auditLogCheck(input));

  const ready = checks.every((item) => item.status !== "fail");

  return {
    title: "Doorframe MCP health check",
    ready,
    summary: ready
      ? "Setup checks passed on the Doorframe server. Run the tool checks below to confirm the MCP tools answer."
      : "Fix the failed checks before connecting an AI client.",
    checks,
    suggestedQuestion: "Use Doorframe to prep me for test readiness review."
  };
}

/** Reads the tool-check data options from a query string, applying the same defaults as the setup page. */
export function mcpToolCheckSettingsFromSearchParams(searchParams: URLSearchParams): McpToolCheckSettings {
  return {
    mode: parseMcpDataMode(searchParams.get("mode") ?? undefined),
    maxResults: clampMaxResults(searchParams.get("maxResults")),
    hideRawText: searchParams.get("hideRawText") === "true"
  };
}

function toolCheck(
  id: string,
  label: string,
  run: () => McpHealthCheckItem,
  failureFix: string
): McpHealthCheckItem {
  try {
    return run();
  } catch (error) {
    return check(id, label, "fail", error instanceof Error ? error.message : `${label} failed.`, failureFix);
  }
}

interface McpToolCheckProjectDb {
  loadProjectData: () => ProjectData;
  listBaselines: () => Baseline[];
}

function summaryModeCheck(projectDb: McpToolCheckProjectDb, settings: McpToolCheckSettings): McpHealthCheckItem {
  const id = "summary-hides-raw-text";
  const label = "Summary mode hides requirement text";
  const search = searchRequirementsData(projectDb, { limit: 5 }, { ...settings, mode: "summary" });

  if (search.requirements.length === 0) {
    return check(id, label, "warn", "Not checked yet: there are no requirements to return. Re-run after importing requirements.");
  }

  const rawTextHidden = search.requirements.every(
    (requirement) => requirement.textExcerpt === undefined && requirement.rawTextHidden
  );
  return rawTextHidden
    ? check(id, label, "pass", "Summary mode returned IDs, titles, counts, and hidden raw text markers.")
    : check(
        id,
        label,
        "fail",
        "Summary mode returned raw requirement text unexpectedly.",
        "Keep --mode summary or --hide-raw-text enabled and review MCP data-minimization settings."
      );
}

/**
 * Calls four read-only MCP tool adapters against the project, with the chosen data options.
 * These can take several seconds on large projects, so the page runs them only on request.
 */
export function runMcpToolChecks(input: RunMcpToolChecksInput): McpToolCheckResult {
  const settings: McpToolCheckSettings = {
    mode: input.mode ?? "standard",
    maxResults: clampMaxResults(input.maxResults),
    hideRawText: input.hideRawText ?? false
  };
  const projectDb: McpToolCheckProjectDb = {
    loadProjectData: () => input.projectData,
    listBaselines: () => input.baselines
  };
  const checks: McpHealthCheckItem[] = [
    toolCheck(
      "get-project-summary",
      "Project summary tool responds",
      () => {
        const summary = getProjectSummaryData(projectDb);
        return check(
          "get-project-summary",
          "Project summary tool responds",
          "pass",
          `${plural(summary.counts.requirements, "requirement")}, ${plural(summary.counts.findings, "finding")}.`
        );
      },
      "Confirm the project database has the Doorframe schema and can be opened read-only."
    ),
    toolCheck(
      "get-review-brief",
      "Review brief tool responds",
      () => {
        const brief = getReviewBriefData(projectDb, { reviewType: "test_readiness_review", limit: 5 }, settings);
        return check("get-review-brief", "Review brief tool responds", "pass", `Review brief returned ${brief.resultCount} scoped fact(s).`);
      },
      "Confirm the project has requirements before using review briefs."
    )
  ];

  if (input.baselines.length >= 2) {
    checks.push(
      toolCheck(
        "get-stale-trace-candidates",
        "Stale trace tool responds",
        () => {
          const stale = getStaleTraceCandidatesData(projectDb, { limit: 5 }, settings);
          return check(
            "get-stale-trace-candidates",
            "Stale trace tool responds",
            "pass",
            `${stale.candidates.length} stale trace candidate(s) returned.`
          );
        },
        "Create current baselines and run the tool checks again."
      )
    );
  }

  checks.push(
    toolCheck(
      "summary-hides-raw-text",
      "Summary mode hides requirement text",
      () => summaryModeCheck(projectDb, settings),
      "Confirm requirements can be listed by the MCP data adapters."
    )
  );

  return { ready: checks.every((item) => item.status !== "fail"), settings, checks };
}
