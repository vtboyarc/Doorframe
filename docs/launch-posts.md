# Launch Posts

## Short Launch Draft

I built Doorframe, an open-source local-first tool that turns requirements exports, Jira work items, and JUnit test results into a traceability gap report.

It is not a SaaS. It does not require AI. It runs locally. There is also a read-only MCP server if you want to query the project from an AI client.

The first demo is fictional: Falcon Telemetry Gateway. It shows missing trace links, missing passing verification, weak wording, duplicate candidates, closed work without passing tests, and a changed baseline requirement.

## Longer Launch Draft

Doorframe is for the boring work before a review: checking whether requirements, work items, and tests still line up.

The v0.1.0 demo takes requirements CSV, Jira-style CSV, and JUnit XML, then generates a local HTML report. The report is the product artifact. It is meant to be readable in a review, printable to PDF, and useful without AI.

Doorframe is local-first, has no telemetry, and does not require accounts. MCP is optional and read-only.
