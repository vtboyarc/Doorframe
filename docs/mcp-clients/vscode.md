# VS Code MCP Setup

VS Code uses `mcp.json` with a top-level `servers` object. Workspace configuration lives at `.vscode/mcp.json`; user configuration is available through the MCP commands in VS Code.

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick VS Code.
6. Optionally adjust data & privacy options (data mode, max results, audit log).
7. Copy the generated config.
8. Paste it into `.vscode/mcp.json` or your user MCP config.
9. Restart or reload the MCP server in VS Code.
10. Ask a starter question.

Example shape:

```json
{
  "servers": {
    "doorframe": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "doorframe",
        "mcp",
        "--project",
        "/absolute/path/to/doorframe.sqlite",
        "--project-id",
        "project_123",
        "--mode",
        "standard",
        "--max-results",
        "25"
      ]
    }
  }
}
```

On Windows, launch npx through `cmd` (`"command": "cmd"`, args starting with `"/c", "npx"`) — the MCP Setup page generates this automatically on Windows. See [Windows: spawn npx ENOENT](../mcp-troubleshooting.md#windows-spawn-npx-enoent).

Your organization may disable or restrict MCP servers in VS Code. Confirm local policy before connecting project data.

Reference: [VS Code MCP configuration reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration).
