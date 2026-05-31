# Internal Demo Script

This is a five-minute Doorframe demo using fictional data.

## Setup

Run the local web app:

```bash
npm run dev
```

Open the local URL printed by Next.js.

## Demo

1. Open Doorframe.
2. Create a project named `Falcon Telemetry Gateway Demo`.
3. Click **Load Demo Project**.
4. Show the dashboard totals for requirements, work items, tests, trace links, and findings.
5. Open the requirements table.
6. Open `REQ-003`.
7. Show that the word `quickly` is flagged as vague requirement language.
8. Show that `REQ-003` has no passing linked test.
9. Open the trace graph and show Requirement to Work Item to Test Case relationships.
10. Open Reports and generate the HTML report.
11. Explain that real teams would use exports from requirements tools, Jira, and CI instead of the fake sample files.

## Talk Track

Doorframe is not replacing DOORS, Jira, CI, or the official review process. It is a local-first review-prep tool that turns exports into a traceability gap report.

It helps answer practical questions before the meeting:

- Which requirements have no linked work?
- Which requirements have no verification evidence?
- Which closed work items still have no passing test?
- Which requirements contain vague wording?
- Which requirements look duplicated or stale?

## Safety Note

Doorframe runs locally by default and does not send imported project data to any external service. Do not use Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.
