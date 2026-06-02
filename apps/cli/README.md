# Doorframe

Doorframe runs as a local web app in your browser. It imports requirements, work items, and test results, then generates local traceability reports for review gaps like missing verification, stale trace links, weak requirement language, and baseline changes.

```bash
npx doorframe serve
```

Open `http://localhost:3000` and use Doorframe in the browser.

You can also generate a fictional Falcon Telemetry Gateway demo report or run command-line analysis from local exports:

```bash
npx doorframe demo
npx doorframe analyze --requirements requirements.csv --jira jira.csv --junit test-results.xml --out doorframe-report.html
```

Doorframe includes optional read-only MCP support for approved AI clients. Doorframe MCP exposes scoped local project facts through read-only tools; it does not include an AI model, call AI providers, or mutate project data.

Doorframe runs locally by default, has no telemetry, and does not call OpenAI, Anthropic, or any other AI provider directly. Do not use it with classified, controlled, proprietary, export-controlled, or sensitive data unless your organization has approved that use in your environment.

Organizations can mirror the npm package or Docker image into an internal registry, scan it, pin a version, and run Doorframe inside an approved local, internal, or air-gapped environment. Doorframe does not make compliance or approval claims.

Full documentation: https://github.com/vtboyarc/Doorframe
