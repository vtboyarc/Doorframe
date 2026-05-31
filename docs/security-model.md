# Security Model

Doorframe is a local-first traceability review tool. The default workflow is import local exports, analyze them locally, and generate a local report.

## Local-First Design

- Project data is stored in local SQLite storage for the web app.
- CLI analysis reads local files and writes local reports.
- Docker deployment stores data in the mounted local Docker volume.
- No account is required for the MVP.

## External Calls

Doorframe does not make external API calls by default. Generated reports do not load external scripts, fonts, images, styles, or CDN assets.

Connector commands may call Jira, GitHub, GitLab, or Jenkins only when the user explicitly runs those commands and provides local credentials.

## Telemetry

Doorframe has no telemetry in the MVP. See `docs/no-telemetry.md`.

## MCP

The MCP server is optional and read-only. It opens only the project database path passed at startup and exposes Doorframe project data through specific tools and resources.

Data returned by MCP may enter the connected AI client's context. Do not connect MCP to data your organization has not approved for that client.

## Docker

Docker is a local deployment convenience. Treat the mounted data directory as project data. Protect it with your normal workstation or internal environment controls.
