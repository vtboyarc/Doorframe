# LinkedIn Launch Draft

I built Doorframe, an open-source local-first tool for requirements traceability review prep.

Doorframe turns requirements exports, Jira work items, and JUnit test results into a local HTML traceability gap report. The goal is to catch boring but costly problems before the meeting:

- requirements without linked work
- requirements without passing verification evidence
- closed work without passing tests
- weak or vague requirement wording
- duplicate requirement candidates
- changed requirements between baselines

It is not a SaaS. It does not require AI. It runs locally, and the main artifact is a report someone can actually read before a review.

There is also an optional read-only MCP server for local project databases, but Doorframe is useful without it.
