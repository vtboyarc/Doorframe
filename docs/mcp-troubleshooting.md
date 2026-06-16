# MCP Troubleshooting

Use the MCP Setup page inside the Doorframe web app first. It generates the local stdio command, client config, and health-check results for the current project.

## Doorframe Web App Runs, But AI Client Cannot See MCP Tools

Likely causes:

- The MCP config was pasted into the wrong client config file.
- The AI client was not restarted or the MCP server was not reloaded.
- The generated project path is not visible to the AI client.
- The client does not support local stdio MCP servers.

Fix:

1. Open Doorframe in the browser.
2. Open the project.
3. Go to MCP Setup.
4. Copy the generated config again.
5. Paste it into the client-specific config file.
6. Restart or reload the AI client.
7. Run the MCP health check from Doorframe.

## MCP Server Does Not Start

Run the generated command manually in a terminal:

```bash
npx -y doorframe@0.1.9 mcp --project /absolute/path/to/doorframe.sqlite --project-id project_123 --mode standard --max-results 25
```

Or run the built-in doctor with the same values from the MCP Setup page:

```bash
npx -y doorframe@0.1.9 mcp doctor --project /absolute/path/to/doorframe.sqlite --project-id project_123 --mode standard --max-results 25
```

`mcp doctor` starts the same local stdio server that an AI client launches, performs an MCP initialize handshake, lists tools, and calls read-only project summary and traceability-gap tools.

Common fixes:

- Install Node.js 20 or newer.
- Confirm `npx` is available.
- Use an absolute project path.
- Confirm `--project-id` matches the project shown on the MCP Setup page.
- Confirm the SQLite file exists and is readable.
- Check the client log for stderr output.

Doorframe MCP uses stdout for protocol messages. Startup errors and diagnostics go to stderr.

If your AI client only reports "Connection closed", run `mcp doctor` in a terminal with the exact generated `--project` and `--project-id`. A `PROJECT_NOT_FOUND` error usually means the project was deleted, duplicated, or re-created and the client still has a stale `--project-id`; re-copy the config from the MCP Setup page.

## Project Path Is Wrong

The `--project` value must point to the Doorframe SQLite database, not a folder.

The local web app stores the database at:

```text
<DOORFRAME_DATA_DIR>/doorframe.sqlite
```

If `DOORFRAME_DATA_DIR` is not set, it stores data under:

```text
./.doorframe/doorframe.sqlite
```

Use the absolute path shown on the MCP Setup page.

## MCP Opens The Wrong Project

A Doorframe SQLite database can contain multiple projects. Use the generated `--project-id` value to select the project shown on the MCP Setup page. Without `--project-id`, MCP falls back to the most recently updated project for backward compatibility.

If the client suddenly closes the connection after a project rename, deletion, or import reset, re-copy the MCP config. The stored `--project-id` may no longer exist in that database.

## AI Client Cannot Launch The MCP Server Process

Local stdio MCP requires the AI client to launch a local process. A browser page cannot make a desktop AI client launch MCP by itself.

Fix:

- Install or make available the `doorframe` npm package where the AI client runs.
- Use the generated `npx -y doorframe@0.1.9 mcp ...` command.
- If the client cannot run `npx`, install Doorframe globally and change the command to `doorframe` with args beginning at `mcp`.

## Tools Appear But Return Empty Results

Likely causes:

- The project has no imported requirements.
- The wrong database path was configured.
- The project ID is missing or points to another project in the same database.
- Doorframe is pointed at a different local data directory.
- Baseline tools are being used before two baselines exist.

Fix:

- Open the same project in Doorframe.
- Import requirements, work items, and test data.
- Re-run analysis.
- Create baselines before asking baseline-diff or stale-trace questions.
- Run the MCP health check.

## Summary Mode Hides More Text Than Expected

This is expected. Summary mode returns IDs, titles, counts, categories, and summaries. It hides raw requirement text.

Use standard mode for short excerpts. Use detailed mode only when your organization approves returning full requirement text through the connected AI client.

`--hide-raw-text` hides raw requirement text even in detailed paths.

## Audit Log Cannot Be Written

Audit logging is off by default. If enabled, the MCP server must be able to write to the parent directory of the JSONL file.

Fix:

- Use an absolute local path.
- Confirm the parent directory exists.
- Confirm the user running the AI client can write there.
- Do not point the audit log at a protected system directory.

Audit logs are sanitized metadata only. Do not configure audit logging to capture raw project text.

## Windows: `spawn npx ENOENT`

Many Windows MCP clients (including Claude Desktop) launch the configured command directly, without a shell. `npx` is a `.cmd` shim on Windows, so `"command": "npx"` fails with `spawn npx ENOENT`.

Fix:

- Use the config generated by the MCP Setup page on Windows. It launches npx through `cmd`:

```json
{
  "mcpServers": {
    "doorframe": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "doorframe@0.1.9", "mcp", "--project", "C:\\Users\\alice\\.doorframe\\doorframe.sqlite", "--project-id", "project_123", "--mode", "standard", "--max-results", "25"]
    }
  }
}
```

- Or install Doorframe globally (`npm install -g doorframe`) and use `doorframe` as the command with args beginning at `mcp`.

## Windows Path Escaping Issues

In JSON config, either escape backslashes:

```json
"C:\\Users\\alice\\Doorframe\\doorframe.sqlite"
```

Or use forward slashes:

```json
"C:/Users/alice/Doorframe/doorframe.sqlite"
```

## Mac/Linux Absolute Path Issues

Use absolute paths such as:

```text
/Users/alice/projects/doorframe-data/doorframe.sqlite
/home/alice/doorframe-data/doorframe.sqlite
```

Avoid relative paths in client config unless the client documents exactly what working directory it uses.

## Docker Container Path Does Not Match Host Path

Doorframe web app can run in Docker. Local stdio MCP usually requires the AI client to launch a local process on the host.

If Doorframe shows a project path like:

```text
/data/doorframe.sqlite
```

that path is inside the container. A desktop AI client on the host usually cannot read it directly.

Fix:

- Use Doorframe reports directly, or
- run the Doorframe MCP server locally with a host-visible database path, or
- build an approved internal remote MCP deployment later.

Do not overpromise Docker-based MCP. The current local stdio path requires the MCP command and database path to be available to the AI client.

## Client Needs Restart Or Reload

Many MCP clients discover tools only when the server starts. Restart or reload the client after config changes.

For VS Code, use the MCP server commands to restart or reset cached tools. For Claude Desktop, fully quit and restart the app. For Claude Code, use `/mcp` or restart the session if needed.

## Local Stdio Vs Remote MCP Confusion

Doorframe MCP currently uses local stdio.

Local stdio:

- AI client launches a local command.
- Project data remains local to the machine running the process.
- Config includes `command` and `args`.

Remote MCP:

- AI client connects to a URL.
- Requires server deployment, authentication, and network approval.
- Config includes a URL.

ChatGPT/OpenAI remote MCP flows expect remote MCP servers. Do not paste a local stdio command into ChatGPT as a remote MCP URL.
