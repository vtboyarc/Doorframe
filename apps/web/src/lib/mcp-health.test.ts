import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULESET, snapshotFromProjectData, type Baseline } from "@doorframe/core";
import { parseJiraCsv, parseJUnitXml, parseRequirementsCsv } from "@doorframe/parsers";
import { buildProjectDataFromImportedRecords, defaultJiraCsvMapping, defaultRequirementsCsvMapping } from "@doorframe/storage";
import { checkAuditLogPath, mcpToolCheckSettingsFromSearchParams, runMcpHealthCheck, runMcpToolChecks } from "./mcp-health";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const falconDir = path.join(repoRoot, "examples", "falcon-telemetry-gateway");

function readFalconFile(filename: string): string {
  return fs.readFileSync(path.join(falconDir, filename), "utf8");
}

function buildFalconProjectData() {
  const requirements = parseRequirementsCsv(readFalconFile("sample-requirements-baseline-b.csv"), defaultRequirementsCsvMapping);
  const workItems = parseJiraCsv(
    readFalconFile("sample-jira.csv"),
    defaultJiraCsvMapping,
    DEFAULT_RULESET.requirementIdPatterns
  );
  const testCases = parseJUnitXml(readFalconFile("sample-junit.xml"), DEFAULT_RULESET.requirementIdPatterns);
  const data = buildProjectDataFromImportedRecords({
    projectName: "Falcon Telemetry Gateway",
    requirements: requirements.records,
    workItems: workItems.records,
    testCases: testCases.records
  });

  return data;
}

function buildFalconBaselines(projectId: string): Baseline[] {
  const currentData = buildFalconProjectData();
  const baselineARequirements = parseRequirementsCsv(
    readFalconFile("sample-requirements-baseline-a.csv"),
    defaultRequirementsCsvMapping
  );
  const baselineAData = buildProjectDataFromImportedRecords({
    projectName: "Falcon Telemetry Gateway",
    requirements: baselineARequirements.records,
    workItems: [],
    testCases: []
  });

  return [
    {
      id: "baseline-a",
      projectId,
      label: "Baseline A",
      createdAt: "2026-01-01T00:00:00.000Z",
      snapshot: snapshotFromProjectData(baselineAData)
    },
    {
      id: "baseline-b",
      projectId,
      label: "Baseline B",
      createdAt: "2026-01-02T00:00:00.000Z",
      snapshot: snapshotFromProjectData(currentData)
    }
  ];
}

describe("MCP health check", () => {
  it("passes against the Falcon demo project data", () => {
    const data = buildFalconProjectData();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-health-"));
    const dbPath = path.join(tempDir, "doorframe.sqlite");
    const entrypointPath = path.join(tempDir, "doorframe-mcp.mjs");
    fs.writeFileSync(dbPath, "readable test database placeholder");
    fs.writeFileSync(entrypointPath, "#!/usr/bin/env node\n");

    const baselines = buildFalconBaselines(data.project.id);
    const result = runMcpHealthCheck({
      projectPath: dbPath,
      projectData: data,
      baselines,
      mcpEntrypointCandidates: [entrypointPath]
    });

    expect(result.ready).toBe(true);

    const tools = runMcpToolChecks({ projectData: data, baselines, mode: "summary", maxResults: 25, hideRawText: true });
    expect(tools.ready).toBe(true);
    expect(tools.settings).toEqual({ mode: "summary", maxResults: 25, hideRawText: true });
    expect(tools.checks.map((item) => [item.id, item.status])).toEqual([
      ["get-project-summary", "pass"],
      ["get-review-brief", "pass"],
      ["get-stale-trace-candidates", "pass"],
      ["summary-hides-raw-text", "pass"]
    ]);
  });

  it("keeps MCP tool calls out of the page-render checks", () => {
    const data = buildFalconProjectData();
    const result = runMcpHealthCheck({
      projectPath: "/tmp/doorframe.sqlite",
      projectData: data,
      baselines: buildFalconBaselines(data.project.id),
      mcpEntrypointCandidates: []
    });
    const ids = result.checks.map((item) => item.id);

    for (const toolCheckId of ["get-project-summary", "get-review-brief", "get-stale-trace-candidates", "summary-hides-raw-text"]) {
      expect(ids).not.toContain(toolCheckId);
    }
  });

  it("reports the stored finding count instead of re-running the analyzers", () => {
    const data = buildFalconProjectData();
    const input = { projectPath: "/tmp/doorframe.sqlite", baselines: [], mcpEntrypointCandidates: [] };
    const withFindings = runMcpHealthCheck({
      ...input,
      projectData: { ...data, findings: data.findings.slice(0, 3) }
    });
    const withoutFindings = runMcpHealthCheck({ ...input, projectData: { ...data, findings: [] } });

    expect(withFindings.checks.find((item) => item.id === "analysis-results")).toMatchObject({
      status: "pass",
      detail: "3 findings from the latest analysis."
    });
    // A ruleset that turns every rule off leaves no stored findings; the check must not
    // report a default-ruleset count that the MCP tools would never return.
    expect(withoutFindings.checks.find((item) => item.id === "analysis-results")).toMatchObject({
      status: "pass",
      detail: expect.stringContaining("No findings with the current ruleset")
    });
  });

  it("reads tool-check data options from the query string with page defaults", () => {
    expect(mcpToolCheckSettingsFromSearchParams(new URLSearchParams("mode=summary&maxResults=7&hideRawText=true"))).toEqual({
      mode: "summary",
      maxResults: 7,
      hideRawText: true
    });
    expect(mcpToolCheckSettingsFromSearchParams(new URLSearchParams("mode=everything&maxResults=900"))).toEqual({
      mode: "standard",
      maxResults: 100,
      hideRawText: false
    });
  });

  it("warns when the audit log path is relative", () => {
    const data = buildFalconProjectData();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-health-"));
    const dbPath = path.join(tempDir, "doorframe.sqlite");
    fs.writeFileSync(dbPath, "readable test database placeholder");

    const result = runMcpHealthCheck({
      projectPath: dbPath,
      projectData: data,
      baselines: buildFalconBaselines(data.project.id),
      auditLogEnabled: true,
      auditLogPath: "./doorframe-mcp-audit.jsonl",
      mcpEntrypointCandidates: [dbPath]
    });

    expect(result.checks.find((item) => item.id === "audit-log-writable")).toMatchObject({
      status: "warn",
      fix: "Use an absolute local path for the audit log."
    });
  });

  it("clarifies that baseline warnings do not block general MCP tools", () => {
    const data = buildFalconProjectData();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-health-"));
    const dbPath = path.join(tempDir, "doorframe.sqlite");
    fs.writeFileSync(dbPath, "readable test database placeholder");

    const result = runMcpHealthCheck({
      projectPath: dbPath,
      projectData: data,
      baselines: [],
      mcpEntrypointCandidates: [dbPath]
    });

    expect(result.checks.find((item) => item.id === "baseline-data")).toMatchObject({
      status: "warn",
      detail: expect.stringContaining("Project summary")
    });
    expect(result.ready).toBe(true);
  });

  it("accepts the packaged CLI entrypoint from DOORFRAME_CLI_ENTRYPOINT", () => {
    const data = buildFalconProjectData();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-health-"));
    const dbPath = path.join(tempDir, "doorframe.sqlite");
    const cliEntrypoint = path.join(tempDir, "index.js");
    fs.writeFileSync(dbPath, "readable test database placeholder");
    fs.writeFileSync(cliEntrypoint, "#!/usr/bin/env node\n");

    const previous = process.env.DOORFRAME_CLI_ENTRYPOINT;
    process.env.DOORFRAME_CLI_ENTRYPOINT = cliEntrypoint;
    try {
      const result = runMcpHealthCheck({
        projectPath: dbPath,
        projectData: data,
        baselines: buildFalconBaselines(data.project.id)
      });

      expect(result.checks.find((item) => item.id === "mcp-entrypoint")).toMatchObject({
        status: "pass",
        detail: cliEntrypoint
      });
    } finally {
      if (previous === undefined) {
        delete process.env.DOORFRAME_CLI_ENTRYPOINT;
      } else {
        process.env.DOORFRAME_CLI_ENTRYPOINT = previous;
      }
    }
  });

  it("finds source checkout entrypoints when Next runs from apps/web", () => {
    const data = buildFalconProjectData();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-health-"));
    const dbPath = path.join(tempDir, "doorframe.sqlite");
    fs.writeFileSync(dbPath, "readable test database placeholder");

    const previousCwd = process.cwd();
    try {
      process.chdir(path.join(repoRoot, "apps", "web"));
      const result = runMcpHealthCheck({
        projectPath: dbPath,
        projectData: data,
        baselines: buildFalconBaselines(data.project.id)
      });

      expect(result.checks.find((item) => item.id === "mcp-entrypoint")?.status).toBe("pass");
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("fails clearly when no project exists", () => {
    const result = runMcpHealthCheck({
      projectPath: "",
      projectData: null,
      baselines: [],
      mcpEntrypointCandidates: []
    });

    expect(result.ready).toBe(false);
    expect(result.checks.find((item) => item.id === "project-found")).toMatchObject({
      status: "fail",
      fix: "Open or create a Doorframe project before configuring MCP."
    });
  });

  it("does not report a data-minimization failure for a project without requirements", () => {
    const result = runMcpToolChecks({
      projectData: { ...buildFalconProjectData(), requirements: [], traceLinks: [], findings: [] },
      baselines: []
    });

    expect(result.checks.find((item) => item.id === "summary-hides-raw-text")?.status).toBe("warn");
    expect(result.checks.find((item) => item.id === "get-stale-trace-candidates")).toBeUndefined();
  });

  it("does not claim a Windows audit log path is writable when checked from a Linux server", () => {
    const result = runMcpHealthCheck({
      projectPath: "/tmp/doorframe.sqlite",
      projectData: buildFalconProjectData(),
      baselines: [],
      platform: "windows",
      serverPlatform: "posix",
      auditLogEnabled: true,
      auditLogPath: "C:\\Users\\Alice Smith\\logs\\audit.jsonl",
      mcpEntrypointCandidates: []
    });

    expect(result.checks.find((item) => item.id === "audit-log-writable")).toMatchObject({
      status: "warn",
      detail: expect.stringContaining("Cannot check")
    });
  });

  it("warns when the database path cannot be opened by the AI client", () => {
    const docker = runMcpHealthCheck({ projectPath: "/data/doorframe.sqlite", projectData: buildFalconProjectData(), baselines: [] });
    expect(docker.checks.find((item) => item.id === "container-path")?.status).toBe("warn");

    const mismatch = runMcpHealthCheck({
      projectPath: "/home/alice/.doorframe/doorframe.sqlite",
      projectData: buildFalconProjectData(),
      baselines: [],
      platform: "windows"
    });
    expect(mismatch.checks.find((item) => item.id === "path-platform")?.status).toBe("warn");
  });
});

describe("MCP audit log path check", () => {
  function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-audit-"));
  }

  it("fails for a folder, because the MCP server cannot append to it", () => {
    const dir = tempDir();
    const result = checkAuditLogPath(dir);

    expect(result).toMatchObject({ status: "fail", detail: `Audit log path is a folder: ${dir}.` });
    expect(result.fix).toContain(path.join(dir, "doorframe-mcp-audit.jsonl"));
  });

  it("passes for an existing writable file", () => {
    const file = path.join(tempDir(), "audit.jsonl");
    fs.writeFileSync(file, "");

    expect(checkAuditLogPath(file)).toMatchObject({ status: "pass", detail: file });
  });

  it("passes for a new file in an existing folder", () => {
    const file = path.join(tempDir(), "audit.jsonl");

    expect(checkAuditLogPath(file)).toMatchObject({ status: "pass", detail: expect.stringContaining("file will be created") });
  });

  it("passes for a file in folders that do not exist yet, as the server creates them", () => {
    const file = path.join(tempDir(), "new logs dir", "nested", "mcp audit.jsonl");
    const result = checkAuditLogPath(file);

    expect(result).toMatchObject({ status: "pass", detail: expect.stringContaining("folder will be created") });
    expect(result.detail.startsWith(file)).toBe(true);
  });

  it("fails when a file sits where a folder would need to be created", () => {
    const blocker = path.join(tempDir(), "not-a-folder");
    fs.writeFileSync(blocker, "");

    expect(checkAuditLogPath(path.join(blocker, "logs", "audit.jsonl"))).toMatchObject({
      status: "fail",
      detail: expect.stringContaining(`${blocker} is a file`)
    });
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("fails when the nearest folder is read-only", () => {
    const dir = tempDir();
    fs.chmodSync(dir, 0o555);
    try {
      expect(checkAuditLogPath(path.join(dir, "logs", "audit.jsonl"))).toMatchObject({
        status: "fail",
        detail: `Audit log folder is not writable: ${dir}.`
      });
    } finally {
      fs.chmodSync(dir, 0o755);
    }
  });

  it("uses the same folder rules from the page checks", () => {
    const dir = tempDir();
    const result = runMcpHealthCheck({
      projectPath: "/tmp/doorframe.sqlite",
      projectData: buildFalconProjectData(),
      baselines: [],
      platform: "posix",
      serverPlatform: "posix",
      auditLogEnabled: true,
      auditLogPath: dir,
      mcpEntrypointCandidates: []
    });

    expect(result.checks.find((item) => item.id === "audit-log-writable")?.status).toBe("fail");
    expect(result.ready).toBe(false);
  });

  it("fails for a path that cannot go into the generated command", () => {
    const result = runMcpHealthCheck({
      projectPath: "C:\\Users\\alice\\doorframe.sqlite",
      projectData: buildFalconProjectData(),
      baselines: [],
      platform: "windows",
      serverPlatform: "posix",
      auditLogEnabled: true,
      auditLogPath: 'C:\\logs\\a" & calc & "b.jsonl',
      mcpEntrypointCandidates: []
    });

    expect(result.checks.find((item) => item.id === "audit-log-writable")).toMatchObject({
      status: "fail",
      detail: expect.stringContaining('" &')
    });
  });
});
