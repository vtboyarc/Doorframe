# Cursor MCP Setup

Cursor documents custom MCP servers with `.cursor/mcp.json` for project configuration or `~/.cursor/mcp.json` for global configuration. Stdio servers use `type`, `command`, and `args`.

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick Cursor.
6. Pick data mode.
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
        "--mode",
        "standard",
        "--max-results",
        "25"
      ]
    }
  }
}
```

Reference: [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol).
