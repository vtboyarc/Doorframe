# Doorframe v0.1.0 Release Notes

Doorframe v0.1.0 is the first public release candidate for the local-first traceability gap report workflow.

## Included

- Local web app.
- CLI analysis command.
- Docker local deployment.
- Offline HTML traceability report.
- Falcon Telemetry Gateway demo project.
- Requirements baseline diff and offline diff report.
- CSV, Jira CSV, JUnit XML, ReqIF, and ReqIFZ imports.
- Read-only MCP server for local project databases.
- Trust, no-telemetry, data-handling, and threat-model docs.

## Not Included

- Doorframe is not a SaaS.
- Doorframe does not require AI.
- Doorframe does not call OpenAI, Anthropic, or other AI providers by default.
- Doorframe is not approved for classified, controlled, or regulated data.
- Doorframe is not a compliance certification.

## Quick Demo

```bash
npm install
npm run doorframe -- analyze \
  --requirements ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --jira ./examples/falcon-telemetry-gateway/sample-jira.csv \
  --junit ./examples/falcon-telemetry-gateway/sample-junit.xml \
  --out ./doorframe-report.html
```
