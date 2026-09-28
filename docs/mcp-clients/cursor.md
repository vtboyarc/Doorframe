# Cursor MCP Setup

Cursor documents custom MCP servers with `.cursor/mcp.json` for project configuration or `~/.cursor/mcp.json` for global configuration. Stdio servers use `type`, `command`, and `args`.

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick Cursor.
6. Optionally adjust data & privacy options (data mode, max results, audit log).
7. Copy the generated config.
8. Paste it into `.cursor/mcp.json` or your global Cursor MCP config.
9. Restart or reload Cursor.
10. Ask a starter question.

Example shape:

```json
{
  "mcpServers": {
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

Any data returned by Doorframe MCP may become part of the connected AI client's context.

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”

Reference: [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol).
