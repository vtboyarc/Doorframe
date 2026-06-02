# Claude Desktop MCP Setup

Claude Desktop local MCP setup uses `claude_desktop_config.json` with an `mcpServers` object. The app must be restarted after configuration changes.

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick Claude Desktop.
6. Pick data mode.
7. Copy the generated config.
8. Paste it into `claude_desktop_config.json`.
9. Restart Claude Desktop.
10. Ask a starter question.

Example shape:

```json
{
  "mcpServers": {
    "doorframe": {
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

Use absolute paths. On Windows, escape backslashes or use forward slashes in JSON paths.

Reference: [MCP local server quickstart](https://modelcontextprotocol.io/quickstart/user).
