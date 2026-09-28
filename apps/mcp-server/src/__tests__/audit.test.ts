import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { openReadOnlyProjectDatabase } from "@doorframe/storage";
import { sanitizeParameters, writeAuditLogEntry } from "../audit";
import { createDoorframeMcpServer } from "../server";
import { createDemoProjectDb } from "./fixtures";

describe("Doorframe MCP audit logging", () => {
  it("writes sanitized JSONL metadata without raw query text", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-audit-"));
    const auditLogPath = path.join(dir, "audit.jsonl");

    writeAuditLogEntry(
      {
        mode: "standard",
        maxResults: 25,
        hideRawText: false,
        auditLogPath
      },
      {
        timestamp: "2026-01-01T00:00:00.000Z",
        project: {
          id: "project_1",
          name: "Demo Doorframe Project"
        },
        toolName: "search_requirements",
        parameters: sanitizeParameters({
          query: "raw requirement phrase",
          limit: 10,
          requirementId: "REQ-001"
        }),
        resultCount: 2,
        mode: "standard",
        success: true,
        durationMs: 4
      }
    );

    const lines = fs.readFileSync(auditLogPath, "utf8").trim().split("\n");
    const entry = JSON.parse(lines[0]) as {
      parameters: Record<string, unknown>;
      resultCount: number;
      success: boolean;
    };

    expect(entry.resultCount).toBe(2);
    expect(entry.success).toBe(true);
    expect(entry.parameters.requirementId).toBe("REQ-001");
    expect(entry.parameters.query).toEqual({ provided: true, length: "raw requirement phrase".length });
    expect(lines[0]).not.toContain("raw requirement phrase");
  });

  it("records only the project id and name for a registered tool call", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doorframe-mcp-audit-"));
    const auditLogPath = path.join(dir, "audit.jsonl");
    const server = createDoorframeMcpServer(openReadOnlyProjectDatabase(createDemoProjectDb()), { auditLogPath });
    const client = new Client({ name: "doorframe-test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      await client.callTool({ name: "get_project_summary", arguments: {} });
    } finally {
      await client.close();
    }

    const entry = JSON.parse(fs.readFileSync(auditLogPath, "utf8").trim().split("\n")[0]) as {
      project: Record<string, unknown>;
      toolName: string;
    };
    expect(entry.toolName).toBe("get_project_summary");
    expect(Object.keys(entry.project).sort()).toEqual(["id", "name"]);
  });
});
