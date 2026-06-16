export type McpDataMode = "summary" | "standard" | "detailed";

export type McpHostPlatform = "windows" | "posix";

export type McpClientId =
  | "generic"
  | "cursor"
  | "claude-desktop"
  | "vscode"
  | "claude-code"
  | "chatgpt"
  | "internal";

export interface McpClientOption {
  id: McpClientId;
  label: string;
  description: string;
  configLabel: string;
  note: string;
}

export interface McpSetupSettings {
  clientId: McpClientId;
  projectPath: string;
  projectId: string;
  mode: McpDataMode;
  maxResults: number;
  hideRawText: boolean;
  auditLogEnabled: boolean;
  auditLogPath?: string;
  platform?: McpHostPlatform;
  packageVersion?: string;
}

export interface GeneratedMcpConfig {
  clientId: McpClientId;
  command: string;
  args: string[];
  commandText: string;
  configText: string;
  note: string;
  packageSpec: string;
}

export const mcpClientOptions: McpClientOption[] = [
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    description: "Anthropic's desktop app for macOS and Windows.",
    configLabel: "claude_desktop_config.json",
    note: "Use Claude Desktop local MCP server settings, then restart Claude Desktop."
  },
  {
    id: "claude-code",
    label: "Claude Code",
    description: "Anthropic's coding agent for the terminal and IDEs.",
    configLabel: "claude mcp add",
    note: "Use Claude Code's MCP CLI to add a local stdio server."
  },
  {
    id: "cursor",
    label: "Cursor",
    description: "The AI code editor, via .cursor/mcp.json.",
    configLabel: ".cursor/mcp.json",
    note: "Use a project or user Cursor MCP configuration with a local stdio server."
  },
  {
    id: "vscode",
    label: "VS Code",
    description: "GitHub Copilot agent mode, via .vscode/mcp.json.",
    configLabel: ".vscode/mcp.json",
    note: "Use a workspace or user VS Code MCP configuration."
  },
  {
    id: "chatgpt",
    label: "ChatGPT / OpenAI",
    description: "Needs a remote MCP server — see guidance.",
    configLabel: "Remote MCP note",
    note: "ChatGPT custom connectors use remote MCP. Doorframe's first MCP path is local stdio."
  },
  {
    id: "internal",
    label: "Internal AI client",
    description: "Your organization's approved MCP-compatible client.",
    configLabel: "Internal client JSON",
    note: "Use this as a starting point for an approved internal MCP-compatible client."
  },
  {
    id: "generic",
    label: "Other MCP client",
    description: "Any client that can launch local stdio MCP servers.",
    configLabel: "mcpServers JSON",
    note: "Use this for clients that accept a standard local stdio MCP server entry."
  }
];

export interface McpDataModeOption {
  id: McpDataMode;
  label: string;
  detail: string;
}

export const mcpDataModeOptions: McpDataModeOption[] = [
  {
    id: "summary",
    label: "Summary",
    detail: "Counts, IDs, and statuses only. Raw requirement text is never returned."
  },
  {
    id: "standard",
    label: "Standard",
    detail: "Short excerpts of requirement text. Recommended for most teams."
  },
  {
    id: "detailed",
    label: "Detailed",
    detail: "Full requirement text allowed in detail tools."
  }
];

export type McpGuideKind = "config-file" | "command" | "manual" | "unsupported";

export interface McpClientGuide {
  kind: McpGuideKind;
  configFile?: { label: string; path: string };
  steps: string[];
  docsUrl?: string;
  docsLabel?: string;
}

export function getMcpClientGuide(clientId: McpClientId, platform: McpHostPlatform = "posix"): McpClientGuide {
  const windows = platform === "windows";

  switch (clientId) {
    case "claude-desktop":
      return {
        kind: "config-file",
        configFile: {
          label: windows ? "Config file location (Windows)" : "Config file location (macOS)",
          path: windows
            ? "%APPDATA%\\Claude\\claude_desktop_config.json"
            : "~/Library/Application Support/Claude/claude_desktop_config.json"
        },
        steps: [
          "In Claude Desktop, open Settings, choose Developer, and click Edit Config. This opens claude_desktop_config.json and creates it if it does not exist yet.",
          'Paste the generated config. If the file already has an "mcpServers" section, add only the "doorframe" entry inside it.',
          windows
            ? "Save the file, then fully quit Claude Desktop from the system tray and reopen it. Closing the window is not enough."
            : "Save the file, then fully quit Claude Desktop (Cmd+Q) and reopen it. Closing the window is not enough.",
          'In a new chat, open the search-and-tools menu and confirm "doorframe" is listed.',
          "Paste a starter question from below to test the connection.",
          'When Claude asks whether to use a Doorframe tool, choose "Allow once" during setup testing. Use persistent permission only after your organization approves that workflow.'
        ],
        docsUrl: "https://modelcontextprotocol.io/quickstart/user",
        docsLabel: "MCP quickstart for Claude Desktop"
      };
    case "claude-code":
      return {
        kind: "command",
        steps: [
          "Open a terminal in the project where you want Doorframe available.",
          "Run the generated command. It registers Doorframe as a local stdio MCP server for that project.",
          'Run "claude mcp list" (or "/mcp" inside a Claude Code session) and confirm doorframe shows as connected.',
          "Ask a starter question from below to test the connection."
        ],
        docsUrl: "https://code.claude.com/docs/en/mcp",
        docsLabel: "Claude Code MCP docs"
      };
    case "cursor":
      return {
        kind: "config-file",
        configFile: {
          label: "Config file location",
          path: ".cursor/mcp.json"
        },
        steps: [
          windows
            ? "Create or open .cursor\\mcp.json in your project root. Use %USERPROFILE%\\.cursor\\mcp.json instead to share the server across all projects."
            : "Create or open .cursor/mcp.json in your project root. Use ~/.cursor/mcp.json instead to share the server across all projects.",
          'Paste the generated config. If the file already has an "mcpServers" section, add only the "doorframe" entry inside it.',
          "Save the file. In Cursor Settings under MCP, confirm doorframe appears with a green status indicator.",
          "Ask a starter question in Cursor chat (Agent mode) to test the connection."
        ],
        docsUrl: "https://docs.cursor.com/context/model-context-protocol",
        docsLabel: "Cursor MCP docs"
      };
    case "vscode":
      return {
        kind: "config-file",
        configFile: {
          label: "Config file location (workspace)",
          path: ".vscode/mcp.json"
        },
        steps: [
          'Create or open .vscode/mcp.json in your workspace. For a user-wide setup, run "MCP: Open User Configuration" from the Command Palette instead.',
          'Paste the generated config. VS Code uses a top-level "servers" key, which the generated config already includes.',
          'Save the file, then use the Start action shown above the server entry (or run "MCP: List Servers" and start doorframe).',
          "Open Copilot Chat in Agent mode, open the tools picker, and confirm the Doorframe tools are enabled.",
          "Ask a starter question to test the connection. Note that organization policy can restrict MCP in VS Code."
        ],
        docsUrl: "https://code.visualstudio.com/docs/copilot/reference/mcp-configuration",
        docsLabel: "VS Code MCP configuration reference"
      };
    case "chatgpt":
      return {
        kind: "unsupported",
        steps: [
          "Use a client that supports local stdio MCP servers, such as Claude Desktop, Claude Code, Cursor, VS Code, or an approved internal client.",
          "Or export a Doorframe report from the Reports tab and share it through your normal approved workflow.",
          "Or, if your organization operates an approved remote MCP gateway, it can wrap the local Doorframe MCP command. Coordinate with your platform team."
        ],
        docsUrl: "https://platform.openai.com/docs/guides/tools-remote-mcp",
        docsLabel: "OpenAI remote MCP docs"
      };
    case "internal":
      return {
        kind: "manual",
        steps: [
          'Register the generated JSON with your internal MCP-compatible client as a local stdio server. Some clients call this "custom tools" or "local servers".',
          "Make sure the machine that launches the client has Node.js 20 or newer available, since the generated entry runs Doorframe through npx.",
          "Make sure the database path in the config is readable from that machine.",
          "Restart or reload the client, then ask a starter question to test the connection."
        ]
      };
    default:
      return {
        kind: "manual",
        steps: [
          'Open your AI client\'s MCP server settings. They are often labeled "MCP servers", "custom tools", or "integrations".',
          "Add the generated JSON as a local stdio server, or enter the command and arguments individually if the client uses a form.",
          "Restart or reload the client so it picks up the new server.",
          'Confirm a "doorframe" toolset appears, then ask a starter question to test the connection.'
        ],
        docsUrl: "https://modelcontextprotocol.io/quickstart/user",
        docsLabel: "MCP user quickstart"
      };
  }
}

export const starterQuestions = [
  {
    group: "General",
    questions: [
      "Use Doorframe to summarize the top traceability gaps.",
      "Use Doorframe to show the highest-risk findings.",
      "Use Doorframe to explain the current project summary."
    ]
  },
  {
    group: "Test readiness review",
    questions: [
      "Use Doorframe to prep me for test readiness review.",
      "Which requirements have no passing verification evidence?",
      "Which failed tests are linked to requirements?"
    ]
  },
  {
    group: "Baseline review",
    questions: [
      "What changed between the latest baselines?",
      "Which changed requirements may have stale trace links?",
      "Which changed requirements have no updated test evidence?"
    ]
  },
  {
    group: "Requirement quality",
    questions: [
      "Which requirements use weak or vague wording?",
      "Which requirements may contain multiple shall statements?",
      "Which requirements look like duplicate candidates?"
    ]
  },
  {
    group: "PI planning",
    questions: [
      "Which requirements have no linked work items?",
      "Which changed requirements need team discussion before PI planning?",
      "What traceability gaps could affect planning?"
    ]
  },
  {
    group: "Audit/internal review",
    questions: [
      "Which requirements are missing verification evidence?",
      "Which closed work items lack passing tests?",
      "What review questions should we ask based on Doorframe findings?"
    ]
  }
] as const;

export function normalizeMcpSettings(settings: McpSetupSettings): McpSetupSettings {
  return {
    ...settings,
    projectId: settings.projectId.trim(),
    maxResults: Math.max(1, Math.min(Math.floor(settings.maxResults || 25), 500)),
    auditLogPath: settings.auditLogEnabled ? settings.auditLogPath?.trim() : undefined,
    packageVersion: settings.packageVersion?.trim() || undefined
  };
}

export function resolveMcpPackageSpec(settings: Pick<McpSetupSettings, "packageVersion">): string {
  const version = settings.packageVersion?.trim();
  return version ? `doorframe@${version}` : "doorframe";
}

export function buildMcpCommand(settings: McpSetupSettings): { command: string; args: string[] } {
  const normalized = normalizeMcpSettings(settings);
  const packageSpec = resolveMcpPackageSpec(normalized);
  const args = [
    "-y",
    packageSpec,
    "mcp",
    "--project",
    normalized.projectPath,
    "--project-id",
    normalized.projectId,
    "--mode",
    normalized.mode,
    "--max-results",
    String(normalized.maxResults)
  ];

  if (normalized.hideRawText) {
    args.push("--hide-raw-text");
  }

  if (normalized.auditLogPath) {
    args.push("--audit-log", normalized.auditLogPath);
  }

  if (normalized.platform === "windows") {
    // Windows MCP clients spawn the command without a shell, so npx's .cmd
    // shim is not resolved directly; route through cmd /c.
    return {
      command: "cmd",
      args: ["/c", "npx", ...args]
    };
  }

  return {
    command: "npx",
    args
  };
}

function quotePosixShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

function quoteWindowsShellArg(value: string): string {
  if (/^[A-Za-z0-9_.\\/:=@-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}

function commandToText(command: string, args: string[], platform: McpHostPlatform): string {
  const quote = platform === "windows" ? quoteWindowsShellArg : quotePosixShellArg;
  return [command, ...args].map(quote).join(" ");
}

function serverConfig(command: string, args: string[], includeType: boolean) {
  return {
    doorframe: {
      ...(includeType ? { type: "stdio" } : {}),
      command,
      args
    }
  };
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function generateMcpConfig(settings: McpSetupSettings): GeneratedMcpConfig {
  const normalized = normalizeMcpSettings(settings);
  const { command, args } = buildMcpCommand(normalized);
  const commandText = commandToText(command, args, normalized.platform ?? "posix");
  const packageSpec = resolveMcpPackageSpec(normalized);
  const packageNote = normalized.packageVersion ? ` This config pins ${packageSpec}.` : "";

  if (normalized.clientId === "chatgpt") {
    return {
      clientId: normalized.clientId,
      command,
      args,
      commandText,
      configText: [
        "Doorframe MCP currently uses local stdio.",
        "",
        "ChatGPT custom connectors and OpenAI API remote MCP flows expect a remote MCP server reachable by the service.",
        "Do not paste this local stdio command into ChatGPT as a remote connector URL.",
        "",
        "Use Doorframe reports directly, use a local stdio MCP-capable client, or wait for a future approved internal remote MCP deployment."
      ].join("\n"),
      note: "ChatGPT remote MCP is not the same as a desktop client launching a local stdio process.",
      packageSpec
    };
  }

  if (normalized.clientId === "vscode") {
    return {
      clientId: normalized.clientId,
      command,
      args,
      commandText,
      configText: json({
        servers: serverConfig(command, args, true)
      }),
      note: `Add this to a workspace or user VS Code mcp.json file.${packageNote}`,
      packageSpec
    };
  }

  if (normalized.clientId === "claude-code") {
    return {
      clientId: normalized.clientId,
      command,
      args,
      commandText,
      configText: `claude mcp add --transport stdio doorframe -- ${commandText}`,
      note: `Run this in the project where Claude Code should use Doorframe MCP.${packageNote}`,
      packageSpec
    };
  }

  if (normalized.clientId === "cursor") {
    return {
      clientId: normalized.clientId,
      command,
      args,
      commandText,
      configText: json({
        mcpServers: serverConfig(command, args, true)
      }),
      note: `Add this to Cursor's project or user MCP configuration.${packageNote}`,
      packageSpec
    };
  }

  const includeType = normalized.clientId === "internal";

  return {
    clientId: normalized.clientId,
    command,
    args,
    commandText,
    configText: json({
      mcpServers: serverConfig(command, args, includeType)
    }),
    note:
      normalized.clientId === "claude-desktop"
        ? `Add this to Claude Desktop's local MCP configuration and restart the client.${packageNote}`
        : `Use this as a standard local stdio MCP server configuration.${packageNote}`,
    packageSpec
  };
}

export function dockerMcpLimitationText(projectPath: string): string {
  const normalizedPath = projectPath.replaceAll("\\", "/");

  if (normalizedPath.startsWith("/data/")) {
    return "Doorframe appears to be using the Docker data path. A desktop AI client cannot usually launch a stdio MCP server from inside that container. Use a host-visible Doorframe database path and local MCP command, or wait for a future approved remote/internal MCP deployment.";
  }

  return "If Doorframe is running in Docker, confirm the generated project path is visible to the AI client on the host. Container-only paths such as /data/doorframe.sqlite will not work for a desktop stdio client unless the client can launch an equivalent local process.";
}
