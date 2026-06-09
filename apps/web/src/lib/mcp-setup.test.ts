import { describe, expect, it } from "vitest";
import { dockerMcpLimitationText, generateMcpConfig, type McpSetupSettings } from "./mcp-setup";

const baseSettings: McpSetupSettings = {
  clientId: "generic",
  projectPath: "/Users/alice/.doorframe/doorframe.sqlite",
  projectId: "project_alpha",
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
      "--project-id",
      "project_alpha",
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

  it("wraps npx in cmd /c for Windows clients", () => {
    const generated = generateMcpConfig({
      ...baseSettings,
      projectPath: "C:\\Users\\alice\\.doorframe\\doorframe.sqlite",
      platform: "windows"
    });
    const parsed = JSON.parse(generated.configText) as {
      mcpServers: { doorframe: { command: string; args: string[] } };
    };

    expect(parsed.mcpServers.doorframe.command).toBe("cmd");
    expect(parsed.mcpServers.doorframe.args.slice(0, 4)).toEqual(["/c", "npx", "-y", "doorframe"]);
    expect(parsed.mcpServers.doorframe.args).toContain("C:\\Users\\alice\\.doorframe\\doorframe.sqlite");
  });

  it("wraps npx in cmd /c for Windows in client-specific configs", () => {
    const generated = generateMcpConfig({ ...baseSettings, clientId: "vscode", platform: "windows" });
    const parsed = JSON.parse(generated.configText) as {
      servers: { doorframe: { command: string; args: string[] } };
    };

    expect(parsed.servers.doorframe.command).toBe("cmd");
    expect(parsed.servers.doorframe.args[0]).toBe("/c");
  });

  it("quotes Windows command text without POSIX single quotes", () => {
    const generated = generateMcpConfig({
      ...baseSettings,
      projectPath: "C:\\Users\\Alice Smith\\.doorframe\\doorframe.sqlite",
      platform: "windows"
    });

    expect(generated.commandText.startsWith("cmd /c npx -y doorframe mcp")).toBe(true);
    expect(generated.commandText).toContain('"C:\\Users\\Alice Smith\\.doorframe\\doorframe.sqlite"');
    expect(generated.commandText).not.toContain("'");
  });

  it("keeps POSIX quoting and plain npx by default", () => {
    const generated = generateMcpConfig({
      ...baseSettings,
      projectPath: "/Users/Alice Smith/.doorframe/doorframe.sqlite"
    });

    expect(generated.command).toBe("npx");
    expect(generated.commandText).toContain("'/Users/Alice Smith/.doorframe/doorframe.sqlite'");
  });
});
