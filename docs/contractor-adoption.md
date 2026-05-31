# Contractor Adoption Workflow

Doorframe is intended to fit into existing regulated engineering workflows without requiring cloud accounts or direct enterprise integrations.

A systems engineer, scrum master, test lead, or requirements analyst exports requirements from DOORS, DOORS Next, Jama, Polarion, or a similar requirements tool as CSV or ReqIF. They export Jira issues as CSV. They export test results from Jenkins, GitLab, GitHub Actions, or another CI system as JUnit XML.

They run Doorframe locally or inside an internal container. Doorframe generates a traceability gap report before a requirements review, sprint review, PI planning event, test readiness review, or audit.

## What Doorframe Helps Find

- Requirements with no linked work
- Requirements with no verification evidence
- Closed work with no passing test
- Weak or vague requirement language
- Duplicate or suspiciously similar requirements
- Possible stale trace links

## Adoption Paths

1. Local CLI for developers and CI pipelines.
2. Local web app for systems engineers, scrum masters, requirements analysts, and test leads.
3. Docker container for internal team deployment.
4. Desktop app later.
5. MCP server later.

## Review Prep Pattern

1. Export data from existing systems.
2. Run Doorframe in an approved local or internal environment.
3. Review dashboard counts and finding categories.
4. Open high-priority gaps.
5. Generate the HTML report.
6. Bring the report to the review as a prep artifact.

Doorframe does not replace official review gates or official requirements tools. It helps teams see gaps earlier.
