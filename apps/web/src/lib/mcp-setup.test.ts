import { describe, expect, it } from "vitest";
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
  unsafeAuditLogPathCharacters,
  type McpSetupSettings
} from "./mcp-setup";
import { MAX_RESULTS_LIMIT as SERVER_MAX_RESULTS_LIMIT } from "../../../mcp-server/src/options";

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
    expect(generated.packageSpec).toBe("doorframe");
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

  it("pins the resolved npm package version when Doorframe serves the setup page", () => {
    const generated = generateMcpConfig({ ...baseSettings, packageVersion: "0.1.9" });
    const parsed = JSON.parse(generated.configText) as {
      mcpServers: { doorframe: { args: string[] } };
    };

    expect(generated.packageSpec).toBe("doorframe@0.1.9");
    expect(parsed.mcpServers.doorframe.args[1]).toBe("doorframe@0.1.9");
    expect(generated.commandText).toContain("doorframe@0.1.9");
    expect(generated.note).toContain("pins doorframe@0.1.9");
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

  it("pins the package version inside Windows cmd args", () => {
    const generated = generateMcpConfig({
      ...baseSettings,
      packageVersion: "0.1.9",
      platform: "windows"
    });
    const parsed = JSON.parse(generated.configText) as {
      mcpServers: { doorframe: { command: string; args: string[] } };
    };

    expect(parsed.mcpServers.doorframe.command).toBe("cmd");
    expect(parsed.mcpServers.doorframe.args.slice(0, 4)).toEqual(["/c", "npx", "-y", "doorframe@0.1.9"]);
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

describe("MCP client setup guides", () => {
  it("provides a guide with steps for every client option", () => {
    for (const client of mcpClientOptions) {
      const guide = getMcpClientGuide(client.id, "posix");
      expect(guide.steps.length).toBeGreaterThan(0);
    }
  });

  it("points Claude Desktop users at the right config file per OS", () => {
    expect(getMcpClientGuide("claude-desktop", "posix").configFile?.path).toBe(
      "~/Library/Application Support/Claude/claude_desktop_config.json"
    );
    expect(getMcpClientGuide("claude-desktop", "windows").configFile?.path).toBe(
      "%APPDATA%\\Claude\\claude_desktop_config.json"
    );
  });

  it("documents Claude Desktop's first-use tool permission prompt", () => {
    const guide = getMcpClientGuide("claude-desktop", "posix");

    expect(guide.steps.join(" ")).toContain("Allow once");
  });

  it("marks ChatGPT as unsupported with alternatives instead of a config file", () => {
    const guide = getMcpClientGuide("chatgpt", "posix");

    expect(guide.kind).toBe("unsupported");
    expect(guide.configFile).toBeUndefined();
    expect(guide.steps.join(" ")).toContain("stdio");
  });

  it("gives Claude Code a command-based guide without a config file", () => {
    const guide = getMcpClientGuide("claude-code", "posix");

    expect(guide.kind).toBe("command");
    expect(guide.configFile).toBeUndefined();
    expect(guide.steps.join(" ")).toContain("claude mcp list");
  });

  it("names workspace config files for Cursor and VS Code", () => {
    expect(getMcpClientGuide("cursor", "posix").configFile?.path).toBe(".cursor/mcp.json");
    expect(getMcpClientGuide("vscode", "posix").configFile?.path).toBe(".vscode/mcp.json");
  });
});

describe("MCP setup helpers", () => {
  it("clamps max results the same way everywhere", () => {
    expect(clampMaxResults("")).toBe(25);
    expect(clampMaxResults("0")).toBe(25);
    expect(clampMaxResults(Number.NaN)).toBe(25);
    expect(clampMaxResults("12.7")).toBe(12);
    expect(clampMaxResults(9000)).toBe(100);
    expect(clampMaxResults("101")).toBe(100);
    expect(generateMcpConfig({ ...baseSettings, maxResults: 0 }).args).toContain("25");
  });

  it("recognizes Windows and POSIX database paths", () => {
    expect(pathStyle("C:\\Users\\alice\\doorframe.sqlite")).toBe("windows");
    expect(pathStyle("\\\\server\\share\\doorframe.sqlite")).toBe("windows");
    expect(pathStyle("/home/alice/.doorframe/doorframe.sqlite")).toBe("posix");
    expect(pathStyle("doorframe.sqlite")).toBe("unknown");
  });

  it("builds a doctor command with the same project and data options", () => {
    const text = buildMcpDoctorCommandText({ ...baseSettings, mode: "summary", hideRawText: true, packageVersion: "1.2.3" });

    expect(text).toBe(
      "npx -y doorframe@1.2.3 mcp doctor --project /Users/alice/.doorframe/doorframe.sqlite --project-id project_alpha --mode summary --max-results 25 --hide-raw-text"
    );
  });

  it("warns when audit logging is on but no path was entered", () => {
    const generated = generateMcpConfig({ ...baseSettings, auditLogEnabled: true, auditLogPath: "  " });

    expect(generated.warnings).toEqual(["audit-log-path-missing"]);
    expect(generated.args).not.toContain("--audit-log");
    expect(generateMcpConfig({ ...baseSettings, auditLogEnabled: true, auditLogPath: "/tmp/audit.jsonl" }).warnings).toEqual([]);
  });

  it("offers the same max results range the MCP server applies", () => {
    expect(MAX_RESULTS_LIMIT).toBe(SERVER_MAX_RESULTS_LIMIT);
  });

  it("describes summary mode as including titles and finding summaries", () => {
    const summary = mcpDataModeOptions.find((option) => option.id === "summary");

    expect(summary?.detail).toContain("titles");
    expect(summary?.detail).toContain("finding summaries");
    expect(summary?.detail).not.toContain("only");
  });

  it("uses a Windows-style Cursor config path for Windows clients", () => {
    expect(getMcpClientGuide("cursor", "windows").configFile?.path).toBe(".cursor\\mcp.json");
  });
});

describe("MCP audit log path validation", () => {
  const injectedWindowsPath = 'C:\\logs\\a" & calc & "b.jsonl';

  it("keeps a Windows path with a double quote out of the command and JSON configs", () => {
    for (const clientId of ["claude-code", "claude-desktop", "cursor", "vscode", "internal", "generic"] as const) {
      const generated = generateMcpConfig({
        ...baseSettings,
        clientId,
        platform: "windows",
        auditLogEnabled: true,
        auditLogPath: injectedWindowsPath
      });

      expect(generated.warnings).toEqual(["audit-log-path-invalid"]);
      expect(generated.args).not.toContain("--audit-log");
      expect(generated.configText).not.toContain("--audit-log");
      expect(generated.configText).not.toContain("calc");
      expect(generated.commandText).not.toContain("calc");
    }
  });

  it("rejects line breaks and double quotes on every OS", () => {
    for (const platform of ["posix", "windows"] as const) {
      const lineBreak = generateMcpConfig({
        ...baseSettings,
        platform,
        auditLogEnabled: true,
        auditLogPath: "/tmp/audit\n.jsonl"
      });
      expect(lineBreak.warnings).toEqual(["audit-log-path-invalid"]);
      expect(lineBreak.args).not.toContain("--audit-log");

      expect(unsafeAuditLogPathCharacters('/tmp/a"b.jsonl', platform)).toEqual(['"']);
      expect(unsafeAuditLogPathCharacters("/tmp/a\r\nb.jsonl", platform)).toEqual(["line break"]);
      expect(unsafeAuditLogPathCharacters("/tmp/a\tb.jsonl", platform)).toEqual(["control character"]);
    }
  });

  it("rejects cmd.exe and PowerShell special characters only for Windows clients", () => {
    expect(unsafeAuditLogPathCharacters("C:\\logs\\a&b|c^d%e!f$g`h.jsonl", "windows")).toEqual([
      "&",
      "|",
      "^",
      "%",
      "!",
      "$",
      "`"
    ]);
    expect(unsafeAuditLogPathCharacters("C:\\logs\\<a>?*.jsonl", "windows")).toEqual(["<", ">", "?", "*"]);
    expect(unsafeAuditLogPathCharacters("/tmp/a&b $HOME `x`.jsonl", "posix")).toEqual([]);
  });

  it("accepts ordinary paths with spaces and quotes them for the chosen OS", () => {
    expect(unsafeAuditLogPathCharacters("C:\\Users\\Alice Smith\\logs (old)\\audit.jsonl", "windows")).toEqual([]);

    const windows = generateMcpConfig({
      ...baseSettings,
      clientId: "claude-code",
      platform: "windows",
      auditLogEnabled: true,
      auditLogPath: "C:\\Users\\Alice Smith\\audit.jsonl"
    });
    expect(windows.warnings).toEqual([]);
    expect(windows.configText).toContain('--audit-log "C:\\Users\\Alice Smith\\audit.jsonl"');

    const posix = generateMcpConfig({
      ...baseSettings,
      clientId: "claude-code",
      auditLogEnabled: true,
      auditLogPath: "/tmp/it's $HOME.jsonl"
    });
    expect(posix.warnings).toEqual([]);
    expect(posix.configText).toContain("--audit-log '/tmp/it'\\''s $HOME.jsonl'");
  });

  it("does not flag an unsafe path while audit logging is off", () => {
    const generated = generateMcpConfig({ ...baseSettings, platform: "windows", auditLogPath: injectedWindowsPath });

    expect(generated.warnings).toEqual([]);
    expect(generated.args).not.toContain("--audit-log");
  });
});
