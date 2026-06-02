# Doorframe coding instructions

Doorframe is a local-first requirements traceability and review tool.

Priorities:
1. Correct parsing and analysis over fancy UI.
2. Useful output without requiring AI.
3. Local-first behavior.
4. Clear, boring, maintainable TypeScript.
5. Small functions with tests.

Avoid:
- Cloud dependencies in MVP.
- User accounts.
- Vendor lock-in.
- Direct DOORS/Jira API integration before CSV/ReqIF imports work.
- Claims about classified or approved government use.

When adding features:
- Add or update types first.
- Add parser/analyzer unit tests.
- Keep sample data fictional.
- Preserve local-only behavior unless explicitly asked otherwise.

## Doorframe product direction

Doorframe is not SaaS-first. It is local-first.

The public website is for docs, screenshots, fake-data demos, and downloads. The actual product must be usable locally, through Docker, or inside an internal organization environment.

Never add telemetry or external API calls by default.

Never imply Doorframe is approved for classified, CUI, proprietary, or sensitive data. Use careful language: organizations must approve their own use in their own environment.

Core value:
Doorframe helps teams find traceability gaps before reviews.

The main artifact is the traceability gap report.

Build useful rule-based functionality before adding AI.

Preferred adoption paths:
1. CLI
2. Local web app
3. Docker container
4. Desktop app later
5. MCP server later

When uncertain, choose boring, local, auditable, and easy to inspect.

## MCP server direction

Doorframe MCP must be read-only until explicitly changed later.

The MCP server is a local bridge between an AI client and a Doorframe project database. It should help users ask questions about requirements, work items, tests, trace links, and findings.

For regulated-team use cases, treat Doorframe MCP as the controlled local traceability context layer. The approved AI client is the assistant. Doorframe MCP should expose narrow, read-only local project facts such as traceability gaps, changed requirements, stale trace candidates, and review-brief facts.

Do not add:
- telemetry
- external API calls
- arbitrary file access
- generic SQL query tools
- write/mutation tools
- cloud assumptions

Use stdio first.

The server should only open the project database path passed at startup.

Keep business logic outside the MCP transport layer. Tools should call testable adapter functions from shared Doorframe packages.

In stdio mode, never write logs to stdout. Use stderr only.

When in doubt, return less data by default and let the user ask for details.

Support data minimization:
- `summary` mode returns IDs, titles, counts, categories, and summaries.
- `standard` mode is the default and returns short excerpts when useful.
- `detailed` mode can return full requirement text in detail tools.
- `--hide-raw-text` should hide raw requirement text even in detail paths.
- `--max-results` should cap supported result sets.

Optional MCP audit logging must be off by default. When enabled, log sanitized JSONL metadata only: timestamp, project id/name if available, tool name, high-level parameters, result count, mode, success/failure, and duration. Do not log full requirement text, work item descriptions, test failure messages, raw imported file contents, environment variables, or secrets.

## MCP and AI-provider boundary

Doorframe MCP is not an AI client and does not include an AI model.

Do not add direct OpenAI, Anthropic, or other AI-provider calls to the MCP server.

Doorframe MCP should expose local Doorframe project data to an MCP-compatible client. The client handles the model, chat interface, authentication, and AI-provider policies.

Doorframe must remain useful without AI:
- local web app
- CLI
- parsers
- analyzers
- reports

MCP is optional. Conversational use requires a separate MCP-compatible AI client.

Always document that any data returned by Doorframe MCP may become part of the connected AI client's context.

Always document this warning:
“Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”

## Doorframe next-phase priorities

Doorframe is moving toward v0.1.0.

The priority is not more AI. The priority is making Doorframe obviously useful in under ten minutes.

Current priorities:
1. polished Falcon Telemetry Gateway demo
2. excellent HTML traceability report
3. baseline diff
4. hardened imports
5. v0.1.0 release readiness
6. trust/security docs
7. feedback docs
8. launch materials

The report is the product artifact. Optimize for a report someone could bring to a requirements review, sprint review, PI planning event, test readiness review, or audit prep meeting.

Keep Doorframe useful without AI.

Do not add direct AI provider calls unless explicitly requested in a later task.

Do not add telemetry.

Do not add SaaS assumptions.

Do not make compliance or approval claims.

When uncertain, choose boring, local, inspectable, and easy to explain.

## Demo data rules

Demo data must be fictional.

Do not use:
- real program names
- real weapon systems
- real aircraft names
- real contract numbers
- government markings
- classified-sounding details
- proprietary examples

Use fictional project names like Falcon Telemetry Gateway.

The demo should intentionally include traceability gaps, weak wording, missing verification, and changed baseline examples.

## Distribution and publishing

Doorframe should be usable without cloning the repo.

Preferred install paths:
1. npm/npx for CLI and MCP
2. Docker/GHCR for local web app or internal team deployment
3. GitHub Releases for versioned release notes and artifacts
4. source clone only for contributors

Do not make users clone the repo for normal usage.

The npm package should expose a `doorframe` binary.

The first public npm package should be `doorframe`.

Docker images should be published to GHCR using versioned tags.

PRs that should publish user-visible changes must be release-ready before merge:
- The release workflow must continue to run on `push` to `main` and publish both the `doorframe` npm package and GHCR Docker image.
- Bump `apps/cli/package.json` to the next unpublished npm version before merge, because npm package versions are immutable.
- Keep root `package.json` and root `package-lock.json` version metadata aligned with `apps/cli/package.json`.
- Update versioned install examples in README/docs when the pinned Docker or npm version changes.
- Check npm availability for the target version, for example `npm view doorframe@<version> version`; a 404 means the version is still publishable.
- If the version already exists on npm from a different commit, the main-merge workflow will skip npm publishing, so the PR is not release-ready until the version is bumped.

Do not include secrets, .env files, local databases, or unnecessary artifacts in npm packages or Docker images.

Run npm pack --dry-run before publishing.

Keep all install docs local-first and security-conscious.

Do not add telemetry, external AI-provider calls, or SaaS assumptions.

Companies should be able to mirror npm packages and Docker images into internal registries and pin versions.

## Report rules

Reports should be:
- offline
- print-friendly
- free of external assets
- HTML-escaped
- clear enough for a review
- boring and professional

No hype language in reports.
