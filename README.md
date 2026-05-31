# Doorframe

Doorframe is an open-source, local-first requirements traceability and review tool. It turns requirements exports, Jira work items, and test results into a traceability gap report you can use before a review.

Doorframe is useful without AI. The main product artifact is the HTML traceability gap report.

Doorframe runs locally by default and does not send imported project data to any external service. Do not use Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.

## What Doorframe Is

- A local review tool for requirements exports.
- A CLI, web app, Docker setup, and report generator.
- A deterministic analyzer for traceability gaps, weak wording, duplicate candidates, failed tests, stale links, and closed work without passing verification.
- A way to compare two requirements baselines before a review.
- An optional read-only MCP server for local project databases.

## What Doorframe Is Not

- Not a DOORS, Jama, Polarion, Jira, or test-management replacement.
- Not a SaaS.
- Not an AI requirement generator.
- Not approved for classified data.
- Not a compliance certification.
- Not a substitute for official program, product, quality, security, or audit processes.

## Ten-Minute Demo

```bash
npm install
npm run doorframe -- analyze \
  --requirements ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --jira ./examples/falcon-telemetry-gateway/sample-jira.csv \
  --junit ./examples/falcon-telemetry-gateway/sample-junit.xml \
  --out ./doorframe-report.html
```

Open `doorframe-report.html` in a browser. The report is offline HTML and can be printed to PDF.

The demo project is fictional. It intentionally includes weak wording, missing trace links, missing passing verification, closed work without passing tests, duplicate requirement candidates, and a baseline timing change.

## Baseline Diff Demo

```bash
npm run doorframe -- diff \
  --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv \
  --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --out ./doorframe-baseline-diff.html
```

This detects `REQ-014` changing from a 5 second processing threshold to a 2 second threshold, plus one added and one deleted requirement.

## Web App

```bash
npm run dev
```

Open `http://localhost:3000`, create a project, and click **Load Demo Project**. Doorframe loads the fictional Falcon Telemetry Gateway sample and generates findings, trace links, and reports from local data.

## Docker

```bash
docker compose up --build
```

Open `http://localhost:3000`. Docker stores project data in `./.doorframe-docker`.

## MCP Server

Doorframe includes an optional read-only stdio MCP server for local Doorframe SQLite project databases.

```bash
npm run start -w apps/mcp-server -- --project ./.doorframe/doorframe.sqlite
```

The MCP server is not an AI client and does not call AI providers. Data returned by MCP may enter the connected AI client's context.

## Inputs

- Requirements CSV
- ReqIF and ReqIFZ
- Jira CSV
- JUnit XML from common CI/test runners

CSV and Jira imports preserve raw attributes where practical. Requirement IDs are extracted from configured patterns in summaries, descriptions, labels, custom fields, test names, class names, suite names, and failure messages.

## Sample Report

Generate the demo report with the CLI command above. A screenshot can be added after the first release artifact is published.

## Project Structure

```text
apps/web            Next.js UI, API routes, and SQLite persistence
apps/cli            Doorframe CLI
apps/mcp-server     Read-only stdio MCP server for local project databases
packages/core       Shared types, schemas, rulesets, baselines, and utilities
packages/parsers    CSV, JUnit XML, ReqIF, ReqIFZ, and ID extraction
packages/analyzers  Deterministic traceability rules and baseline diff
packages/reporting  HTML, Markdown, JSON, CSV, and baseline diff reports
packages/storage    Shared project-data assembly and read-only SQLite loading
examples            Fictional sample data
docs                Project docs
docker              Docker image definition
```

## Security And Privacy

Doorframe has no telemetry in the MVP. It does not phone home, require accounts, or call AI providers by default. Reports are generated without external scripts, fonts, images, or CDN assets.

See `SECURITY.md`, `docs/security-model.md`, `docs/threat-model.md`, `docs/no-telemetry.md`, and `docs/data-handling.md`.

## Roadmap

Near-term work for v0.1.x focuses on better import resilience, clearer reports, baseline workflows, packaged demo artifacts, and user feedback from real review workflows. Optional AI review can come later, but Doorframe must remain useful without AI.

## Contributing

See `CONTRIBUTING.md`. The repository currently uses the existing MIT license in `LICENSE`.
