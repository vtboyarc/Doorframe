# Doorframe

Doorframe turns requirements exports, Jira work items, and test results into a traceability gap report you can actually use before a review.

**Requirements exports are messy. Doorframe makes them reviewable.**

Doorframe is an open-source local-first requirements traceability and review tool. It is useful for teams that export requirements from IBM DOORS, DOORS Next, Jama, Polarion, or similar tools. Doorframe does not require direct integration with any enterprise system. It works from local exports only.

Doorframe runs locally by default and does not send imported project data to any external service. Do not use Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.

## What It Is

- A local-first review tool for requirements exports.
- A way to import requirements CSV, ReqIF, Jira CSV, and JUnit XML.
- A deterministic analyzer for traceability and wording issues.
- A clean HTML report generator that can be saved as PDF from the browser.

## What It Is Not

- Not a DOORS, Jama, Polarion, or Jira replacement.
- Not a direct enterprise system integration.
- Not a cloud service.
- Not a multi-tenant SaaS product.
- Not a classified-data handling environment.
- Not dependent on AI.

## Features

- Create local projects.
- Import requirements from CSV with auto-detected column mapping and a preview.
- Import Jira issues from CSV.
- Import JUnit XML test results.
- Import type-aware ReqIF and ReqIFZ files (named attributes → fields, spec hierarchy → parent links).
- Auto-detect requirement IDs in Jira descriptions and test names, with configurable ID patterns.
- Create trace links between requirements, work items, and tests.
- Detect missing verification, missing work trace, weak wording, multi-requirement smells, duplicate candidates, stale links, and closed work without passing tests — with tunable thresholds, disabled categories, and project-defined custom rules.
- Pull live data via connectors: Jira API, GitHub/GitLab test artifacts, and Jenkins test reports (credentials stay local; see `docs/cli.md`).
- Capture baselines and compare baseline-to-baseline (or against the current state).
- Show a dashboard, requirements table, traceability matrix, requirement details, findings, trace graph, audit log, and report preview.
- Generate traceability reports in HTML, Markdown, JSON, and CSV.
- Keep a local audit log of imports, analysis runs, baselines, ruleset changes, and report generation.
- Optionally expose a local project database through a read-only stdio MCP server for MCP-compatible AI clients.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## CLI Demo

```bash
npm run doorframe -- analyze \
  --requirements ./examples/sample-requirements.csv \
  --jira ./examples/sample-jira.csv \
  --junit ./examples/sample-junit.xml \
  --out ./doorframe-report.html
```

## Docker

```bash
docker compose up
```

Open `http://localhost:3000`.

## Demo Data

Use the fictional sample files in `examples/`:

- `examples/sample-requirements.csv`
- `examples/sample-jira.csv`
- `examples/sample-junit.xml`
- `examples/sample.reqif`
- `examples/expected-findings.json`

Suggested demo flow:

1. Create a project.
2. Click **Load Demo Project**.
3. Review the dashboard, findings, requirements table, trace graph, and report.

## Project Structure

```text
apps/web            Next.js UI, API routes, and SQLite persistence
apps/cli            Doorframe CLI
apps/mcp-server     Read-only stdio MCP server for local project databases
packages/core       Shared types, schemas, and utilities
packages/parsers    CSV, JUnit XML, ReqIF, ReqIFZ, and ID extraction
packages/analyzers  Deterministic traceability and review rules
packages/reporting  HTML, Markdown, JSON, and CSV report generation
packages/integrations Jira/GitHub/GitLab/Jenkins connectors (+ DOORS Next scaffold)
packages/storage    Shared project-data assembly helpers
examples            Fictional sample data
docs                Project docs
docker              Docker image definition
```

## Tests

```bash
npm test
```

The test suite covers parser behavior and analyzer rules.
