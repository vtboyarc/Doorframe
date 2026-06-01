# Doorframe

Doorframe runs a local web app, generates local traceability reports from requirements exports, and includes the fictional Falcon Telemetry Gateway demo plus a read-only MCP launcher.

```bash
npx doorframe demo
npx doorframe serve
npx doorframe analyze --requirements requirements.csv --jira jira.csv --junit test-results.xml --out doorframe-report.html
npx doorframe mcp --project ./doorframe.sqlite
```

Doorframe runs locally by default, has no telemetry in the MVP, and does not call AI providers. Do not use it with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.

Full documentation: https://github.com/vtboyarc/Doorframe
