# Generic MCP Client

Use this for a client that supports local stdio MCP servers with `mcpServers` JSON.

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick Generic MCP client.
6. Optionally adjust data & privacy options (data mode, max results, audit log).
7. Copy the generated config.
8. Paste it into the AI client.
9. Restart or reload the AI client.
10. Ask a starter question.

Example shape:

```json
{
  "mcpServers": {
    "doorframe": {
      "command": "npx",
      "args": [
        "-y",
        "doorframe@0.1.13",
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

Use the MCP Setup page instead of hand-building this when possible. It includes the current project path and project ID, mode, result cap, hide-raw-text flag, and optional audit log flag.

Doorframe MCP is local stdio in this release. The AI client must be able to launch the local `npx -y doorframe@0.1.13 mcp ...` process.

On Windows, launch npx through `cmd` (`"command": "cmd"`, args starting with `"/c", "npx"`) — the MCP Setup page generates this automatically on Windows. See [Windows: spawn npx ENOENT](../mcp-troubleshooting.md#windows-spawn-npx-enoent).
