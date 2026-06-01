# Doorframe CLI

Doorframe CLI generates local traceability reports from requirements exports, Jira CSV files, JUnit XML test results, and ReqIF files. It also includes the fictional Falcon Telemetry Gateway demo and a read-only MCP launcher.

```bash
npx @doorframe/cli demo
npx @doorframe/cli serve
npx @doorframe/cli analyze --requirements requirements.csv --jira jira.csv --junit test-results.xml --out doorframe-report.html
npx @doorframe/cli mcp --project ./doorframe.sqlite
```

Doorframe runs locally by default, has no telemetry in the MVP, and does not call AI providers. Do not use it with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.

Full documentation: https://github.com/vtboyarc/Doorframe
