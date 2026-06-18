# Claude Desktop MCP Setup

Claude Desktop local MCP setup uses `claude_desktop_config.json` with an `mcpServers` object. The app must be restarted after configuration changes.

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick Claude Desktop.
6. Optionally adjust data & privacy options (data mode, max results, audit log).
7. Copy the generated config.
8. Paste it into `claude_desktop_config.json`.
9. Restart Claude Desktop.
10. Ask a starter question.
11. When Claude asks whether to use each Doorframe tool, choose "Allow once" during setup testing. Use persistent permission only after your organization approves that workflow.

Example shape:

```json
{
  "mcpServers": {
    "doorframe": {
      "command": "npx",
      "args": [
        "-y",
        "doorframe@0.1.10",
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

Use absolute paths. On Windows, escape backslashes or use forward slashes in JSON paths, and launch npx through `cmd` (`"command": "cmd"`, args starting with `"/c", "npx"`) — the MCP Setup page generates this automatically on Windows. See [Windows: spawn npx ENOENT](../mcp-troubleshooting.md#windows-spawn-npx-enoent).

Reference: [MCP local server quickstart](https://modelcontextprotocol.io/quickstart/user).
