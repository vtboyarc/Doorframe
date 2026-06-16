# Claude Code MCP Setup

Claude Code can add local stdio MCP servers with `claude mcp add --transport stdio`.

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick Claude Code.
6. Optionally adjust data & privacy options (data mode, max results, audit log).
7. Copy the generated command.
8. Run it in the Claude Code project where Doorframe MCP should be available.
9. Restart or reload Claude Code if needed.
10. Ask a starter question.

Example shape:

```bash
claude mcp add --transport stdio doorframe -- npx -y doorframe@0.1.9 mcp \
  --project /absolute/path/to/doorframe.sqlite \
  --project-id project_123 \
  --mode standard \
  --max-results 25
```

On Windows, the MCP Setup page generates the command with npx launched through `cmd /c` so the spawned server starts correctly. See [Windows: spawn npx ENOENT](../mcp-troubleshooting.md#windows-spawn-npx-enoent).

Claude Code also supports JSON-based MCP setup. Use the MCP Setup page to avoid path and option mistakes.

Reference: [Claude Code MCP docs](https://code.claude.com/docs/en/mcp).
