# Doorframe

[![npm package](https://img.shields.io/npm/v/doorframe?label=npm%20package)](https://www.npmjs.com/package/doorframe)

Doorframe is a local-first requirements traceability tool. It runs in your browser, imports requirements/work/test data, and generates review-ready reports for gaps like missing verification, stale trace links, weak requirement language, and baseline changes.

Doorframe also includes optional read-only MCP support, so approved AI clients can query a local Doorframe project through scoped tools instead of relying on full requirements exports uploaded into chat.

Doorframe works without AI. It has no telemetry and does not call OpenAI, Anthropic, or any other AI provider directly.

## What Doorframe does

Doorframe helps engineering teams turn messy requirements data into reviewable traceability reports.

It can help identify:

- requirements without linked work items
- requirements without verification evidence
- weak or vague requirement language
- stale trace links across baselines
- changed requirements between baselines
- closed work without passing test evidence
- failed or skipped tests linked to requirements

Doorframe is not a replacement for DOORS, DOORS Next, Jama, Polarion, Jira, or your official requirements process. It is a local-first review and traceability layer that works from exported data.

## Run Doorframe

Run the local web app:

```bash
npx doorframe serve
```

Then open:

```text
http://localhost:3000
```

Load the fictional Falcon Telemetry Gateway demo:

```bash
npx doorframe demo
```

Run with Docker:

```bash
docker run -p 3000:3000 -v doorframe-data:/data ghcr.io/vtboyarc/doorframe:latest
```

Then open Doorframe in your browser and use the app from there.

Doorframe is not meant to require cloning the repository for normal use. Most users should run it with npm or Docker.

Generate a report from local exports:

```bash
npx doorframe analyze \
  --requirements requirements.csv \
  --jira jira.csv \
  --junit test-results.xml \
  --out doorframe-report.html
```

## Optional MCP support

Doorframe MCP gives an approved AI client a narrow, read-only way to query a local Doorframe project.

Instead of uploading an entire DOORS export or requirements spreadsheet into a chat window, an AI client can ask Doorframe for scoped project facts through MCP tools:

- project summary
- traceability gaps
- changed requirements
- stale trace candidates
- missing verification
- failed tests linked to requirements
- review brief data

Doorframe MCP is read-only. It does not mutate requirements, work items, tests, findings, baselines, reports, or project data.

Doorframe MCP is model-agnostic. It can be used with MCP-compatible clients your organization approves. Doorframe does not decide whether a given AI client, model, deployment, network, or dataset is approved for your environment.

Doorframe itself does not include an AI model and does not call OpenAI, Anthropic, or any other AI provider directly. The connected AI client supplies the model, chat UI, authentication, provider configuration, and data handling.

Run Doorframe, open a project in your browser, go to **MCP Setup**, pick an approved AI client, run the health check, and copy the generated local stdio config.

## Local, internal, and air-gapped use

Doorframe is designed to run locally by default. It has no telemetry and does not call external AI providers.

For restricted or air-gapped environments, organizations can mirror the npm package or Docker image into an internal registry, scan it, pin a version, and run Doorframe fully inside their approved environment.

In air-gapped use, Doorframe can still generate reports, compare baselines, run analyzers, and expose a local read-only MCP server. If AI is used, the connected AI client and model must also be approved and available inside that environment.

Doorframe does not make a system approved, compliant, or authorized by itself. Your organization is responsible for approving tools, models, networks, data handling, and deployment patterns before use.

See `docs/install.md`, `docs/docker.md`, and `docs/company-installation.md`.

## Security and data handling

Doorframe runs locally by default. It does not include telemetry and does not send project data to AI providers.

Do not use Doorframe with classified, controlled, proprietary, export-controlled, or sensitive data unless your organization has approved that use in your environment.

Doorframe does not claim to be DoD-approved, FedRAMP-approved, CMMC-compliant, NIST-compliant, IL4/IL5 approved, or approved for classified or CUI data. It is a local-first traceability and review tool. Approval decisions belong to your organization.

## Pinned Docker Version

```bash
docker run -p 3000:3000 -v doorframe-data:/data ghcr.io/vtboyarc/doorframe:0.1.14
```

## What Doorframe Is

- A local review tool for requirements exports.
- A local web app, npm package, Docker setup, command-line runner, and report generator.
- A deterministic analyzer for traceability gaps, weak wording, duplicate candidates, failed tests, stale links, and closed work without passing verification.
- A way to compare two requirements baselines before a review.
- An optional read-only MCP server for local project databases.

## What Doorframe Is Not

- Not a DOORS, Jama, Polarion, Jira, or test-management replacement.
- Not a SaaS.
- Not an AI requirement generator.
- Not approved for classified, CUI, proprietary, export-controlled, or sensitive data by Doorframe itself.
- Not a compliance certification.
- Not a substitute for official program, product, quality, security, or audit processes.

## Ten-Minute Demo

```bash
npx doorframe demo
```

Open `doorframe-report.html` in a browser. The report is offline HTML and can be printed to PDF. The demo also writes `doorframe-baseline-diff.html`.

The demo project is fictional. It intentionally includes weak wording, missing trace links, missing passing verification, closed work without passing tests, duplicate requirement candidates, and a baseline timing change.

## Baseline Diff Demo

```bash
npx doorframe diff \
  --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv \
  --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --out ./doorframe-baseline-diff.html
```

This detects `REQ-014` changing from a 5 second processing threshold to a 2 second threshold, plus one added and one deleted requirement.

## Web App

With Docker:

```bash
docker run -p 3000:3000 -v doorframe-data:/data ghcr.io/vtboyarc/doorframe:0.1.14
```

From source:

```bash
npm run dev
```

Open `http://localhost:3000`, create a project, and click **Load Demo Project**. Doorframe loads the fictional Falcon Telemetry Gateway sample and generates findings, trace links, and reports from local data.

## Docker

```bash
docker compose up
```

Open `http://localhost:3000`. Docker stores project data in the `doorframe-data` volume mounted at `/data`.

## MCP Setup

Doorframe includes an optional read-only stdio MCP server for local Doorframe SQLite project databases.

Run Doorframe, open it in your browser, and configure MCP from the project settings. The MCP Setup page generates the exact command your AI client needs to launch the local Doorframe MCP server.

The MCP server is not an AI client and does not call AI providers. It exposes scoped local context such as traceability gaps, changed requirements, stale trace candidates, and review-brief facts. Data returned by MCP may enter the connected AI client's context.

Advanced users can still run the generated command manually, for example `npx -y doorframe@0.1.14 mcp --project /absolute/path/to/doorframe.sqlite --project-id project_123 --mode standard --max-results 25`. To validate the same stdio connection from a terminal, run `npx -y doorframe@0.1.14 mcp doctor --project /absolute/path/to/doorframe.sqlite --project-id project_123`.

The generated command includes `--project-id` so MCP opens the project shown on the setup page when the database contains multiple projects. Use `--mode summary`, `--mode standard`, `--mode detailed`, `--max-results`, `--hide-raw-text`, and optional `--audit-log ./doorframe-mcp-audit.jsonl` to control result scope. See `docs/mcp-server.md`, `docs/mcp-clients/README.md`, `docs/mcp-troubleshooting.md`, `docs/mcp-value-case.md`, `docs/mcp-vs-file-upload.md`, `docs/mcp-data-minimization.md`, `docs/mcp-approved-ai-client-guidance.md`, and `docs/mcp-audit-logging.md`.

## Inputs

- Requirements CSV
- ReqIF and ReqIFZ
- Jira CSV
- JUnit XML from common CI/test runners

CSV and Jira imports preserve raw attributes where practical. Requirement IDs are extracted from configured patterns in summaries, descriptions, labels, custom fields, test names, class names, suite names, and failure messages.

## Sample Report

Generate the demo report with the npm command above. A screenshot can be added after the first release artifact is published.

## Project Structure

```text
apps/web            Next.js UI, API routes, and SQLite persistence
apps/cli            Doorframe package command and local web app launcher
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

For more security and privacy detail, see `SECURITY.md`, `docs/security-model.md`, `docs/threat-model.md`, `docs/no-telemetry.md`, and `docs/data-handling.md`.

## Roadmap

Near-term work for v0.1.x focuses on better import resilience, clearer reports, baseline workflows, packaged demo artifacts, and user feedback from real review workflows. Optional AI review can come later, but Doorframe must remain useful without AI.

## Contributing

Clone the repo only when contributing, auditing, or changing Doorframe.

```bash
git clone https://github.com/vtboyarc/Doorframe.git
cd Doorframe
npm install
npm run build
npm test
```

See `CONTRIBUTING.md`. The repository currently uses the existing MIT license in `LICENSE`.
