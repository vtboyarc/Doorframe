# Website Copy Draft

## Hero

# Traceability gaps should not surprise you during a review.

Doorframe turns requirements exports, Jira work items, and test results into a local traceability gap report.

Doorframe is an open-source local-first requirements traceability and review tool. It helps teams find missing work links, missing verification evidence, weak requirement language, duplicate candidates, and stale links before the meeting.

## Why Doorframe Exists

Requirements reviews often depend on exports from several systems. Requirements live in one tool, work is tracked in Jira, and verification evidence lives in CI test artifacts. By the time gaps are found, the review is already underway.

Doorframe gives teams a local way to inspect those exports before the review.

## How It Works

1. Export requirements from your requirements tool.
2. Export work items from Jira.
3. Export test results from CI.
4. Run Doorframe locally.
5. Review gaps before the meeting.

## What It Imports

- Requirements CSV
- ReqIF and ReqIFZ, with limited MVP support
- Jira CSV
- JUnit XML

## What It Finds

- Requirements without linked work
- Requirements without verification evidence
- Closed work without passing tests
- Weak or vague requirement wording
- Duplicate requirement candidates
- Possible stale trace links

## Local-First By Default

Doorframe runs locally by default and does not send imported project data to any external service. Do not use Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.

## Run The Demo

Use the fake Falcon Telemetry Gateway sample project to see a dashboard, trace graph, findings, and HTML report in under five minutes.

## Install Options

- Local CLI for developers and CI pipelines
- Local web app for review prep
- Docker container for internal deployment
- Desktop app later
- MCP server later

## Roadmap

Near-term work focuses on better ReqIF support, better CSV mapping, a stronger traceability matrix, baseline diffs, report formats, and a richer sample project. Later work may include optional AI review, local model support, enterprise controls, and an MCP server.
