export type McpDataMode = "summary" | "standard" | "detailed";

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
}

export interface GeneratedMcpConfig {
  clientId: McpClientId;
  command: string;
  args: string[];
  commandText: string;
  configText: string;
  note: string;
}

export const mcpClientOptions: McpClientOption[] = [
  {
    id: "generic",
    label: "Generic MCP client",
    configLabel: "mcpServers JSON",
    note: "Use this for clients that accept a standard local stdio MCP server entry."
  },
  {
    id: "cursor",
    label: "Cursor",
    configLabel: ".cursor/mcp.json",
    note: "Use a project or user Cursor MCP configuration with a local stdio server."
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    configLabel: "claude_desktop_config.json",
    note: "Use Claude Desktop local MCP server settings, then restart Claude Desktop."
  },
  {
    id: "vscode",
    label: "VS Code",
    configLabel: ".vscode/mcp.json",
    note: "Use a workspace or user VS Code MCP configuration."
  },
  {
    id: "claude-code",
    label: "Claude Code",
    configLabel: "claude mcp add",
    note: "Use Claude Code's MCP CLI to add a local stdio server."
  },
  {
    id: "chatgpt",
    label: "ChatGPT / remote MCP note",
    configLabel: "Remote MCP note",
    note: "ChatGPT custom connectors use remote MCP. Doorframe's first MCP path is local stdio."
  },
  {
    id: "internal",
    label: "Internal AI client",
    configLabel: "Internal client JSON",
    note: "Use this as a starting point for an approved internal MCP-compatible client."
  }
];

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
    auditLogPath: settings.auditLogEnabled ? settings.auditLogPath?.trim() : undefined
  };
}

export function buildMcpCommand(settings: McpSetupSettings): { command: string; args: string[] } {
  const normalized = normalizeMcpSettings(settings);
  const args = [
    "-y",
    "doorframe",
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

  return {
    command: "npx",
    args
  };
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

function commandToText(command: string, args: string[]): string {
  return [command, ...args].map(quoteShellArg).join(" ");
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
  const commandText = commandToText(command, args);

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
      note: "ChatGPT remote MCP is not the same as a desktop client launching a local stdio process."
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
      note: "Add this to a workspace or user VS Code mcp.json file."
    };
  }

  if (normalized.clientId === "claude-code") {
    return {
      clientId: normalized.clientId,
      command,
      args,
      commandText,
      configText: `claude mcp add --transport stdio doorframe -- ${commandText}`,
      note: "Run this in the project where Claude Code should use Doorframe MCP."
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
      note: "Add this to Cursor's project or user MCP configuration."
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
        ? "Add this to Claude Desktop's local MCP configuration and restart the client."
        : "Use this as a standard local stdio MCP server configuration."
  };
}

export function dockerMcpLimitationText(projectPath: string): string {
  const normalizedPath = projectPath.replaceAll("\\", "/");

  if (normalizedPath.startsWith("/data/")) {
    return "Doorframe appears to be using the Docker data path. A desktop AI client cannot usually launch a stdio MCP server from inside that container. Use a host-visible Doorframe database path and local MCP command, or wait for a future approved remote/internal MCP deployment.";
  }

  return "If Doorframe is running in Docker, confirm the generated project path is visible to the AI client on the host. Container-only paths such as /data/doorframe.sqlite will not work for a desktop stdio client unless the client can launch an equivalent local process.";
}
