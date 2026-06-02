import { describe, expect, it } from "vitest";
import { dockerMcpLimitationText, generateMcpConfig, type McpSetupSettings } from "./mcp-setup";

const baseSettings: McpSetupSettings = {
  clientId: "generic",
  projectPath: "/Users/alice/.doorframe/doorframe.sqlite",
  mode: "standard",
  maxResults: 25,
  hideRawText: false,
  auditLogEnabled: false
};

describe("MCP setup config generation", () => {
  it("generates a generic local stdio MCP config", () => {
    const generated = generateMcpConfig(baseSettings);
    const parsed = JSON.parse(generated.configText) as {
      mcpServers: { doorframe: { command: string; args: string[] } };
    };

    expect(parsed.mcpServers.doorframe.command).toBe("npx");
    expect(parsed.mcpServers.doorframe.args).toEqual([
      "-y",
      "doorframe",
      "mcp",
      "--project",
      "/Users/alice/.doorframe/doorframe.sqlite",
      "--mode",
      "standard",
      "--max-results",
      "25"
    ]);
  });

  it("generates Cursor config with stdio type", () => {
    const generated = generateMcpConfig({ ...baseSettings, clientId: "cursor" });
    const parsed = JSON.parse(generated.configText) as {
      mcpServers: { doorframe: { type: string; command: string } };
    };

    expect(parsed.mcpServers.doorframe.type).toBe("stdio");
    expect(parsed.mcpServers.doorframe.command).toBe("npx");
  });

  it("generates Claude Desktop config without inventing remote support", () => {
    const generated = generateMcpConfig({ ...baseSettings, clientId: "claude-desktop" });
    const parsed = JSON.parse(generated.configText) as {
      mcpServers: { doorframe: { command: string; args: string[]; type?: string } };
    };

    expect(parsed.mcpServers.doorframe.command).toBe("npx");
    expect(parsed.mcpServers.doorframe.type).toBeUndefined();
  });

  it("generates VS Code mcp.json config", () => {
    const generated = generateMcpConfig({ ...baseSettings, clientId: "vscode" });
    const parsed = JSON.parse(generated.configText) as {
      servers: { doorframe: { type: string; command: string; args: string[] } };
    };

    expect(parsed.servers.doorframe.type).toBe("stdio");
    expect(parsed.servers.doorframe.args).toContain("--project");
  });

  it("includes summary mode, hide raw text, and audit log flags", () => {
    const generated = generateMcpConfig({
      ...baseSettings,
      mode: "summary",
      hideRawText: true,
      auditLogEnabled: true,
      auditLogPath: "/Users/alice/doorframe-mcp-audit.jsonl"
    });

    expect(generated.args).toEqual(
      expect.arrayContaining(["--mode", "summary", "--hide-raw-text", "--audit-log", "/Users/alice/doorframe-mcp-audit.jsonl"])
    );
  });

  it("uses careful ChatGPT wording instead of fake local stdio config", () => {
    const generated = generateMcpConfig({ ...baseSettings, clientId: "chatgpt" });

    expect(generated.configText).toContain("local stdio");
    expect(generated.configText).toContain("remote MCP");
    expect(generated.configText).not.toContain("mcpServers");
  });

  it("warns when Docker container paths are not host-visible", () => {
    expect(dockerMcpLimitationText("/data/doorframe.sqlite")).toContain("Docker data path");
  });
});
