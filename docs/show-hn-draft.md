# Show HN Draft

Title:

Show HN: Doorframe - local-first traceability gap reports for requirements reviews

Post:

I built Doorframe, an open-source local-first tool that turns requirements exports, Jira work items, and JUnit test results into a traceability gap report.

The idea is simple: before a requirements review, sprint review, test readiness review, or audit prep meeting, you should be able to see which requirements have no linked work, no passing verification evidence, weak wording, duplicate candidates, stale links, or closed work without passing tests.

It is not a SaaS. It does not require AI. It runs locally through a CLI, web app, or Docker. There is also an optional read-only MCP server if you want to query a local project from an AI client.

The demo project is fictional and can be run in a few minutes.
