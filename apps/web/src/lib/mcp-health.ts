import fs from "node:fs";
import path from "node:path";
import { generateFindings } from "@doorframe/analyzers";
import { DEFAULT_RULESET, type Baseline, type ProjectData } from "@doorframe/core";
import {
  getProjectSummaryData,
  getReviewBriefData,
  getStaleTraceCandidatesData,
  searchRequirementsData
} from "../../../mcp-server/src/tools";
import { plural } from "./import-messages";
import { pathStyle, type McpDataMode, type McpHostPlatform } from "./mcp-setup";

export type McpHealthStatus = "pass" | "warn" | "fail";

export interface McpHealthCheckItem {
  id: string;
  label: string;
  status: McpHealthStatus;
  detail: string;
  fix?: string;
}

export interface RunMcpHealthCheckInput {
  projectPath: string;
  projectData: ProjectData | null;
  baselines: Baseline[];
  mode?: McpDataMode;
  maxResults?: number;
  hideRawText?: boolean;
  auditLogEnabled?: boolean;
  auditLogPath?: string;
  /** Operating system of the machine where the AI client launches the MCP server. */
  platform?: McpHostPlatform;
  mcpEntrypointCandidates?: string[];
}

export interface McpHealthCheckResult {
  title: string;
  ready: boolean;
  summary: string;
  checks: McpHealthCheckItem[];
  suggestedQuestion: string;
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

function writableParent(filePath: string): boolean {
  try {
    fs.accessSync(path.dirname(filePath), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function runMcpHealthCheck(input: RunMcpHealthCheckInput): McpHealthCheckResult {
  const checks: McpHealthCheckItem[] = [];
  const projectDb = input.projectData
    ? {
        loadProjectData: () => input.projectData as ProjectData,
        listBaselines: () => input.baselines
      }
    : null;
  const options = {
    mode: input.mode ?? "standard",
    maxResults: input.maxResults ?? 25,
    hideRawText: input.hideRawText ?? false
  };

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
    try {
      const generatedFindings = generateFindings(
        {
          requirements: input.projectData.requirements,
          workItems: input.projectData.workItems,
          testCases: input.projectData.testCases,
          traceLinks: input.projectData.traceLinks
        },
        DEFAULT_RULESET
      );
      const findingCount = input.projectData.findings.length;
      checks.push(
        check(
          "findings-or-analyzers",
          "Analysis available",
          "pass",
          findingCount > 0
            ? `Findings found: ${findingCount}.`
            : `Analyzers can run and currently produce ${plural(generatedFindings.length, "finding")}.`
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analyzer check failed.";
      checks.push(
        check(
          "findings-or-analyzers",
          "Analysis available",
          "fail",
          message,
          "Review project data and ruleset settings, then re-run analysis."
        )
      );
    }
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

  if (projectDb) {
    try {
      const summary = getProjectSummaryData(projectDb);
      checks.push(
        check(
          "get-project-summary",
          "Project summary tool responds",
          "pass",
          `${plural(summary.counts.requirements, "requirement")}, ${plural(summary.counts.findings, "finding")}.`
        )
      );
    } catch (error) {
      checks.push(
        check(
          "get-project-summary",
          "Project summary tool responds",
          "fail",
          error instanceof Error ? error.message : "get_project_summary failed.",
          "Confirm the project database has the Doorframe schema and can be opened read-only."
        )
      );
    }

    try {
      const brief = getReviewBriefData(projectDb, { reviewType: "test_readiness_review", limit: 5 }, options);
      checks.push(
        check(
          "get-review-brief",
          "Review brief tool responds",
          "pass",
          `Review brief returned ${brief.resultCount} scoped fact(s).`
        )
      );
    } catch (error) {
      checks.push(
        check(
          "get-review-brief",
          "Review brief tool responds",
          "fail",
          error instanceof Error ? error.message : "get_review_brief failed.",
          "Re-run analysis and confirm the project has requirements before using review briefs."
        )
      );
    }

    if (baselineCount >= 2) {
      try {
        const stale = getStaleTraceCandidatesData(projectDb, { limit: 5 }, options);
        checks.push(
          check(
            "get-stale-trace-candidates",
            "Stale trace tool responds",
            "pass",
            `${stale.candidates.length} stale trace candidate(s) returned.`
          )
        );
      } catch (error) {
        checks.push(
          check(
            "get-stale-trace-candidates",
            "Stale trace tool responds",
            "fail",
            error instanceof Error ? error.message : "get_stale_trace_candidates failed.",
            "Create current baselines and retry the MCP health check."
          )
        );
      }
    }

    try {
      const search = searchRequirementsData(projectDb, { limit: 5 }, { ...options, mode: "summary" });
      const rawTextHidden = search.requirements.every(
        (requirement) => requirement.textExcerpt === undefined && requirement.rawTextHidden
      );
      if (search.requirements.length === 0) {
        checks.push(
          check(
            "summary-hides-raw-text",
            "Summary mode hides requirement text",
            "warn",
            "Not checked yet: there are no requirements to return. Re-run after importing requirements."
          )
        );
      } else if (rawTextHidden) {
        checks.push(
          check(
            "summary-hides-raw-text",
            "Summary mode hides requirement text",
            "pass",
            "Summary mode returned IDs, titles, counts, and hidden raw text markers."
          )
        );
      } else {
        checks.push(
          check(
            "summary-hides-raw-text",
            "Summary mode hides requirement text",
            "fail",
            "Summary mode returned raw requirement text unexpectedly.",
            "Keep --mode summary or --hide-raw-text enabled and review MCP data-minimization settings."
          )
        );
      }
    } catch (error) {
      checks.push(
        check(
          "summary-hides-raw-text",
          "Summary mode hides requirement text",
          "fail",
          error instanceof Error ? error.message : "Summary mode check failed.",
          "Confirm requirements can be listed by the MCP data adapters."
        )
      );
    }
  }

  if (input.auditLogEnabled) {
    const auditPath = input.auditLogPath?.trim();
    if (!auditPath) {
      checks.push(
        check(
          "audit-log-writable",
          "Audit log path writable",
          "fail",
          "Audit logging is enabled but no audit log path is configured.",
          "Choose a local JSONL path visible to the MCP server process."
        )
      );
    } else if (pathStyle(auditPath) === "unknown") {
      checks.push(
        check(
          "audit-log-writable",
          "Audit log path writable",
          "warn",
          `Audit log path is relative: ${auditPath}. The MCP server may run from a different working directory than this web app.`,
          "Use an absolute local path for the audit log."
        )
      );
    } else if (writableParent(auditPath)) {
      checks.push(check("audit-log-writable", "Audit log path writable", "pass", path.dirname(auditPath)));
    } else {
      checks.push(
        check(
          "audit-log-writable",
          "Audit log path writable",
          "fail",
          `Audit log directory is not writable: ${path.dirname(auditPath)}.`,
          "Choose a writable local directory and avoid logging full project text."
        )
      );
    }
  } else {
    checks.push(check("audit-log-writable", "Audit log path writable", "pass", "Audit logging is off by default."));
  }

  const ready = checks.every((item) => item.status !== "fail");

  return {
    title: "Doorframe MCP health check",
    ready,
    summary: ready
      ? "Project data is ready for MCP questions. These checks run on the Doorframe server."
      : "Fix the failed checks before connecting an AI client.",
    checks,
    suggestedQuestion: "Use Doorframe to prep me for test readiness review."
  };
}
