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
