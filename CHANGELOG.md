# Changelog

## v0.1.17 - Draft

Web app usability and correctness pass. The layout, navigation, and dark theme are unchanged.

- Home: explain the three steps and accepted formats, open the existing demo project instead of creating a copy on every click, and show requirement, finding, and last-updated counts on project cards.
- Projects can be renamed and deleted from Settings. Unknown project, finding, and requirement URLs show a not-found page with a way back.
- Dashboard: a "Get started" checklist for empty projects, a "Fully traced" percentage with its denominator, findings split by severity, and a direct link to the report.
- Requirements, Matrix, and Findings: filters and sorting are kept in the URL, IDs sort naturally (REQ-2 before REQ-10), detail pages have back and previous/next links, and duplicate-wording findings show both requirements side by side with the flagged terms highlighted.
- Imports: detect UTF-8 BOM, UTF-16, and Latin-1 files and warn when the encoding was guessed; warn when a CSV uses semicolons or tabs; re-importing requirements removes parent links that are no longer in the file.
- Imports, record removal, ruleset saves, and the demo load commit their records, import history, findings, and audit events together, so a failure or double submit cannot leave a project half-written.
- Baselines: show what changed per requirement, swap the compared baselines, and reject duplicate labels. The web demo now loads baselines A and B.
- Trace graph: work items on the left, requirements in the middle, tests on the right; focus and view are kept in the URL; requirements missing work or tests and unlinked work items or tests are marked; large projects open on "Needs attention".
- Reports: full-width preview with print and download buttons; opening the preview is no longer recorded in the audit log; download filenames use the local date. The HTML report header shows the Doorframe version that generated it.
- MCP setup: pick the AI client and operating system, see warnings when the database path cannot be opened by the client (container or wrong-platform paths), copy a `mcp doctor` command, and see when the check results are out of date.
- Settings: the ruleset editor validates ID patterns and custom rules before saving and reports how the finding count changed.
- Audit: readable action labels, event details, and "Show older events".
- API: consistent 404s for unknown projects, 400s with plain messages for invalid input, and a health check that reports when the database cannot be opened.
- Analyzer: cap duplicate-wording candidates per requirement so very large imports cannot exhaust memory.
- Accessibility: visible keyboard focus, higher-contrast form borders and primary buttons, and reduced-motion support.

## v0.1.15 - Draft

- Consolidate the web app's repeated panel styling classes into a single shared constant; no visual changes.

## v0.1.14 - Draft

- Restore readable print colors for warning (`warn`) and failed (`bad`) status pills in printed or PDF reports, completing the passed-pill fix from v0.1.13.
- Give passed test statuses in the web app a distinct green (`--success`) so they no longer blend into regular text on the dark theme.
- Replace the global `bg-white` CSS overrides with theme variables at each call site so the dark theme no longer depends on remapping Tailwind utility classes.

## v0.1.13 - Draft

- Restore readable print colors for passed (`ok`) status pills so traceability matrix results stay visible when reports are printed or saved to PDF.

## v0.1.12 - Draft

- Apply a dark theme to the web app and generated HTML reports.
- Add a linked-requirements hero metric (requirements traced to both work items and tests) to the project dashboard.

## v0.1.11 - Draft

- Keep matrix finding counts aligned with the related findings shown on requirement detail pages.
- Count unique requirements with failed or errored linked tests in both the dashboard metric and its drilldown.

## v0.1.10 - Draft

- Add finding detail pages with affected-entity context, recommendations, and related requirement links.
- Make dashboard metrics, priority findings, audit events, matrix rows, and requirement finding counts actionable.
- Add filtered requirement views for missing work, missing tests, and failed linked tests.
- Highlight the active project section and order findings by severity.

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
