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
import type { McpDataMode } from "./mcp-setup";

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
  const candidates = [
    path.join(cwd, "apps", "mcp-server", "src", "index.ts"),
    path.join(cwd, "apps", "mcp-server", "bin", "doorframe-mcp.mjs"),
    path.join(cwd, "apps", "cli", "dist", "index.js")
  ];

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
        "project found",
        "fail",
        "No Doorframe project is open.",
        "Open or create a Doorframe project before configuring MCP."
      )
    );
  } else {
    checks.push(check("project-found", "project found", "pass", `Project found: ${input.projectData.project.name}`));
  }

  if (!input.projectPath.trim()) {
    checks.push(
      check(
        "database-readable",
        "project database readable",
        "fail",
        "Doorframe could not determine a project database path.",
        "Start Doorframe with a configured data directory and open a project."
      )
    );
  } else if (readableFile(input.projectPath)) {
    checks.push(check("database-readable", "project database readable", "pass", input.projectPath));
  } else {
    checks.push(
      check(
        "database-readable",
        "project database readable",
        "fail",
        `Database is not readable at ${input.projectPath}.`,
        "Use the absolute path to the Doorframe SQLite database visible to the AI client."
      )
    );
  }

  if (input.projectData && input.projectData.requirements.length > 0) {
    checks.push(
      check("requirements-found", "requirements found", "pass", `${input.projectData.requirements.length} requirement(s) found.`)
    );
  } else {
    checks.push(
      check(
        "requirements-found",
        "requirements found",
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
          "findings or analyzers available",
          "pass",
          findingCount > 0
            ? `Findings found: ${findingCount}.`
            : `Analyzers can run and currently produce ${generatedFindings.length} finding(s).`
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analyzer check failed.";
      checks.push(
        check(
          "findings-or-analyzers",
          "findings or analyzers available",
          "fail",
          message,
          "Review project data and ruleset settings, then re-run analysis."
        )
      );
    }
  }

  const baselineCount = input.baselines.length;
  if (baselineCount >= 2) {
    checks.push(check("baseline-data", "baseline data available", "pass", `${baselineCount} baseline(s) available.`));
  } else {
    checks.push(
      check(
        "baseline-data",
        "baseline data available",
        "warn",
        "Baseline MCP tools will be limited until at least two baselines exist.",
        "Create two baselines before asking baseline-diff or stale-trace questions."
      )
    );
  }

  const entrypoint = (input.mcpEntrypointCandidates ?? defaultEntrypointCandidates()).find(readableFile);
  if (entrypoint) {
    checks.push(check("mcp-entrypoint", "MCP server entrypoint visible", "pass", entrypoint));
  } else {
    checks.push(
      check(
        "mcp-entrypoint",
        "MCP server entrypoint visible",
        "warn",
        "No local source checkout MCP entrypoint was found from the web app process.",
        "Use the generated npm command in a local AI client, or install Doorframe where the AI client can launch it."
      )
    );
  }

  if (projectDb) {
    try {
      const summary = getProjectSummaryData(projectDb);
      checks.push(
        check(
          "get-project-summary",
          "get_project_summary works",
          "pass",
          `${summary.counts.requirements} requirement(s), ${summary.counts.findings} finding(s).`
        )
      );
    } catch (error) {
      checks.push(
        check(
          "get-project-summary",
          "get_project_summary works",
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
          "get_review_brief works",
          "pass",
          `Review brief returned ${brief.resultCount} scoped fact(s).`
        )
      );
    } catch (error) {
      checks.push(
        check(
          "get-review-brief",
          "get_review_brief works",
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
            "get_stale_trace_candidates works",
            "pass",
            `${stale.candidates.length} stale trace candidate(s) returned.`
          )
        );
      } catch (error) {
        checks.push(
          check(
            "get-stale-trace-candidates",
            "get_stale_trace_candidates works",
            "fail",
            error instanceof Error ? error.message : "get_stale_trace_candidates failed.",
            "Create current baselines and retry the MCP health check."
          )
        );
      }
    }

    try {
      const search = searchRequirementsData(projectDb, { limit: 5 }, { ...options, mode: "summary" });
      const rawTextHidden =
        search.requirements.length > 0 &&
        search.requirements.every((requirement) => requirement.textExcerpt === undefined && requirement.rawTextHidden);
      checks.push(
        check(
          "summary-hides-raw-text",
          "summary mode hides raw requirement text",
          rawTextHidden ? "pass" : "fail",
          rawTextHidden
            ? "Summary mode returned IDs, titles, counts, and hidden raw text markers."
            : "Summary mode returned raw requirement text unexpectedly.",
          rawTextHidden ? undefined : "Keep --mode summary or --hide-raw-text enabled and review MCP data-minimization settings."
        )
      );
    } catch (error) {
      checks.push(
        check(
          "summary-hides-raw-text",
          "summary mode hides raw requirement text",
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
          "audit log path writable",
          "fail",
          "Audit logging is enabled but no audit log path is configured.",
          "Choose a local JSONL path visible to the MCP server process."
        )
      );
    } else if (!path.isAbsolute(auditPath)) {
      checks.push(
        check(
          "audit-log-writable",
          "audit log path writable",
          "warn",
          `Audit log path is relative: ${auditPath}. The MCP server may run from a different working directory than this web app.`,
          "Use an absolute local path for the audit log."
        )
      );
    } else if (writableParent(auditPath)) {
      checks.push(check("audit-log-writable", "audit log path writable", "pass", path.dirname(auditPath)));
    } else {
      checks.push(
        check(
          "audit-log-writable",
          "audit log path writable",
          "fail",
          `Audit log directory is not writable: ${path.dirname(auditPath)}.`,
          "Choose a writable local directory and avoid logging full project text."
        )
      );
    }
  } else {
    checks.push(check("audit-log-writable", "audit log path writable", "pass", "Audit logging is off by default."));
  }

  const ready = checks.every((item) => item.status !== "fail");

  return {
    title: "Doorframe MCP health check",
    ready,
    summary: ready ? "Doorframe MCP looks ready." : "Doorframe MCP needs attention before use.",
    checks,
    suggestedQuestion: "Use Doorframe to prep me for test readiness review."
  };
}
