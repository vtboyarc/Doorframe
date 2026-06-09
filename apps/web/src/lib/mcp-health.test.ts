import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULESET, snapshotFromProjectData, type Baseline } from "@doorframe/core";
import { parseJiraCsv, parseJUnitXml, parseRequirementsCsv } from "@doorframe/parsers";
import { buildProjectDataFromImportedRecords, defaultJiraCsvMapping, defaultRequirementsCsvMapping } from "@doorframe/storage";
import { runMcpHealthCheck } from "./mcp-health";

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

    const result = runMcpHealthCheck({
      projectPath: dbPath,
      projectData: data,
      baselines: buildFalconBaselines(data.project.id),
      mode: "summary",
      maxResults: 25,
      hideRawText: true,
      mcpEntrypointCandidates: [entrypointPath]
    });

    expect(result.ready).toBe(true);
    expect(result.checks.find((item) => item.id === "get-project-summary")?.status).toBe("pass");
    expect(result.checks.find((item) => item.id === "get-review-brief")?.status).toBe("pass");
    expect(result.checks.find((item) => item.id === "get-stale-trace-candidates")?.status).toBe("pass");
    expect(result.checks.find((item) => item.id === "summary-hides-raw-text")?.status).toBe("pass");
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
});
