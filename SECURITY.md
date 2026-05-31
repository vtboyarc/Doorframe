# Security Policy

Doorframe is local-first MVP software. It is not approved for classified data, controlled data, regulated data, or any other sensitive use unless your organization approves that use in your own environment.

## Supported Versions

Security fixes are handled on the current `main` branch until the first tagged release.

## Reporting Issues

Use GitHub issues for non-sensitive security concerns. Do not include sensitive requirements, proprietary exports, credentials, project databases, or real customer data in public issues.

For anything sensitive, share only a minimal sanitized reproduction.

## Security Model

- Doorframe runs locally by default.
- Doorframe has no telemetry in the MVP.
- Doorframe does not phone home.
- Doorframe does not call AI providers by default.
- Generated reports are offline HTML with no external scripts, fonts, images, or CDNs.
- The MCP server is optional and read-only, but data returned by MCP may enter the connected AI client's context.

See `docs/security-model.md`, `docs/threat-model.md`, `docs/no-telemetry.md`, and `docs/data-handling.md`.
