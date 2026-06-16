# Changelog

## v0.1.9 - Draft

- Add `doorframe --version` and a `doorframe mcp doctor` stdio smoke check for validating MCP setup outside an AI client.
- Pin generated MCP configs to the serving Doorframe npm package version when available.
- Document Claude Desktop's first-use tool permission prompt and improve MCP troubleshooting for stale `--project-id` failures.
- Clarify that missing baseline history only limits baseline-specific MCP tools.

## v0.1.8 - Draft

- Redesign the MCP Setup page as a guided three-step flow: pick a client from labeled cards, follow per-client numbered instructions with exact config file locations and docs links, then verify the connection.
- Explain ChatGPT/OpenAI remote-MCP limitations in plain language with supported alternatives instead of a raw text block.
- Move data mode, max results, hide-raw-text, and audit log into a collapsible "Data & privacy options" section with descriptions of each data mode.
- Default the MCP Setup page to Claude Desktop and show a project-data readiness badge in the header.

## v0.1.7 - Draft

- Generate Windows-compatible MCP configs that launch npx through `cmd /c`, with Windows-safe command quoting and an OS note on the MCP Setup page.
- Resolve `DOORFRAME_DATA_DIR` to an absolute path so generated MCP configs never contain relative database paths.
- Pass the packaged CLI entrypoint to the web app so the MCP health check passes for npx and global installs.
- Warn in the MCP health check when the audit log path is relative.
- Add an end-to-end MCP stdio handshake to the packaged CLI smoke test.
- Document the Windows `spawn npx ENOENT` fix and align MCP client guides.

## v0.1.6 - Draft

- Keep generated MCP connections scoped to the project selected in the web app.
- Resolve relative `doorframe serve --data-dir` paths before launching the packaged web server.
- Preserve the MCP audit-log filename in CLI help output.

## v0.1.5

- Add a browser-first MCP Setup page with generated client configs, data-minimization controls, health checks, starter questions, and setup docs.
- Clarify Docker and local stdio MCP limitations.

## v0.1.3 - Draft

- Publish the local web app onboarding updates from PR #16 through the npm and Docker release path.

## v0.1.0 - Draft

Initial public release candidate for Doorframe.

- Local web app for importing requirements, Jira-style work items, and JUnit test evidence.
- CLI analysis command that generates an offline HTML traceability report.
- Docker local deployment path.
- Review-ready HTML traceability report with executive summary, import summary, risk sections, traceability matrix, finding sections, and appendix.
- Fictional Falcon Telemetry Gateway demo project.
- Requirements baseline diff command and offline baseline diff report.
- CSV, Jira CSV, JUnit XML, ReqIF, and ReqIFZ import support.
- Read-only MCP server for local Doorframe project databases.
- Local-first, no-telemetry, trust, and data-handling documentation.

Doorframe remains useful without AI. MCP is optional and read-only.
