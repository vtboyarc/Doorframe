# Website Copy

## Hero

# Traceability gaps should not surprise you during a review.

Doorframe turns requirements exports, work items, and test results into local traceability reports you can review before the meeting.

Run Doorframe locally, import your requirements/work/test data, and generate review-ready reports for missing verification, stale trace links, weak requirement language, and baseline changes. Optional read-only MCP support lets approved AI clients query scoped Doorframe project context without uploading entire exports into chat.

Primary buttons:

- View on GitHub
- Run the demo
- Read the docs

## Why Doorframe Exists

Requirements reviews often depend on exports from several systems. Requirements live in one tool, work is tracked in Jira, and verification evidence lives in CI test artifacts. Gaps often appear late, when the meeting is already underway.

Doorframe gives teams a local way to inspect those exports before the review.

## How It Works

1. Export requirements from your requirements tool.
2. Export work items from Jira.
3. Export test results from CI.
4. Run Doorframe locally and open it in your browser.
5. Review gaps before the meeting.

## What It Imports

- Requirements CSV
- ReqIF and ReqIFZ
- Jira CSV
- JUnit XML

## What It Finds

- Requirements without linked work
- Requirements without verification evidence
- Closed work without passing tests
- Weak or vague requirement wording
- Duplicate requirement candidates
- Changed requirements between baselines
- Possible stale trace links

## Local-First By Default

Doorframe runs locally by default and does not send imported project data to any external service. It has no telemetry and does not require accounts.

## Web / Docker / Reports / MCP

- Web app for importing files, browsing findings, and exporting reports.
- Docker for local or internal deployment.
- Command-line report generation for scripted review prep.
- Optional read-only MCP server that lets approved AI clients query local Doorframe project context through scoped tools.

Doorframe works without AI. The optional MCP server lets approved AI clients ask for traceability gaps, changed requirements, stale trace candidates, and review-brief facts without uploading an entire requirements export into a chat window. Doorframe does not include a model and does not call OpenAI, Anthropic, or any AI provider directly.

MCP configuration is generated inside the Doorframe web app from the project MCP Setup page.

## Sample Report

Run the Falcon Telemetry Gateway demo to generate an offline HTML report that can be printed to PDF.

## Security Notes

Doorframe is not approved for classified, controlled, proprietary, or regulated data. Use it only with data your organization has approved for your environment.

Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.

## Roadmap

Near-term work focuses on import resilience, report clarity, baseline workflows, packaging, and user feedback. Doorframe must remain useful without AI.
