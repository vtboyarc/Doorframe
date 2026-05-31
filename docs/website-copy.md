# Website Copy

## Hero

# Traceability gaps should not surprise you during a review.

Doorframe turns requirements exports, Jira work items, and test results into a local traceability gap report.

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
4. Run Doorframe locally.
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

Doorframe runs locally by default and does not send imported project data to any external service. It has no telemetry in the MVP and does not require accounts.

## CLI / Web / Docker / MCP

- CLI for quick local reports and scripted review prep.
- Web app for importing files, browsing findings, and exporting reports.
- Docker for local or internal deployment.
- Optional read-only MCP server for local project databases.

## Sample Report

Run the Falcon Telemetry Gateway demo to generate an offline HTML report that can be printed to PDF.

## Security Notes

Doorframe is not approved for classified, controlled, proprietary, or regulated data. Use it only with data your organization has approved for your environment.

## Roadmap

Near-term work focuses on import resilience, report clarity, baseline workflows, packaging, and user feedback. Doorframe must remain useful without AI.
