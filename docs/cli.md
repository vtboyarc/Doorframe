# Doorframe CLI

The CLI runs the same parsers and analyzers as the web app without storing anything.

```bash
npm install
npm run doorframe -- analyze \
  --requirements ./examples/sample-requirements.csv \
  --jira ./examples/sample-jira.csv \
  --junit ./examples/sample-junit.xml \
  --out ./doorframe-report.html
```

The command prints a summary and writes a report in your chosen format.

## `analyze`

Build a traceability report from local files.

- `--requirements <path>` Requirements CSV export.
- `--reqif <path>` ReqIF requirements export (can be combined with or used instead of `--requirements`).
- `--jira <path>` Jira CSV export.
- `--junit <path>` JUnit XML test results.
- `--format <html|md|json|csv>` Output format (defaults to `html`).
- `--ruleset <path>` JSON ruleset file (ID patterns, analyzer thresholds, disabled categories, custom rules).
- `--out <path>` Output path (defaults to `./doorframe-report.<ext>`).

The `json` format embeds a portable snapshot used by `doorframe diff`.

## `diff`

Compare two JSON reports (baselines) produced by `analyze --format json`.

```bash
npm run doorframe -- diff --base baseline-a.json --against baseline-b.json
```

Prints added/removed/modified requirements, work-item and test changes, and finding deltas.

## Connector imports

Fetch artifacts from external systems and feed them into the standard analysis.
Credentials are read from environment variables (local-first; nothing is stored
unless you write the report). Combine with `--requirements`/`--reqif` for a full
report.

```bash
npm run doorframe -- import-jira    --requirements req.csv --jql "project = FG"
npm run doorframe -- import-github  --requirements req.csv --junit-xml ci-junit.xml
npm run doorframe -- import-gitlab  --requirements req.csv --project-id 42 --job-id 1001
npm run doorframe -- import-jenkins --requirements req.csv --job my-app --build 17
```

Environment variables:

- Jira: `DOORFRAME_JIRA_BASE_URL`, `DOORFRAME_JIRA_EMAIL`, `DOORFRAME_JIRA_API_TOKEN`, optional `DOORFRAME_JIRA_JQL`.
- GitHub: `DOORFRAME_GITHUB_TOKEN`, `DOORFRAME_GITHUB_OWNER`, `DOORFRAME_GITHUB_REPO`.
- GitLab: `DOORFRAME_GITLAB_TOKEN`, `DOORFRAME_GITLAB_PROJECT_ID`, `DOORFRAME_GITLAB_JOB_ID`, optional `DOORFRAME_GITLAB_BASE_URL`.
- Jenkins: `DOORFRAME_JENKINS_BASE_URL`, `DOORFRAME_JENKINS_JOB`, optional `DOORFRAME_JENKINS_BUILD`, `DOORFRAME_JENKINS_USER`, `DOORFRAME_JENKINS_API_TOKEN`.

> GitHub Actions artifacts are zipped; download/extract the JUnit XML and pass it
> with `--junit-xml`. See `docs/integrations/doors-next.md` for DOORS Next.

## Notes

- All processing happens locally.
- The CLI does not write to the database used by the web app.
- Use the web app to store projects, baselines, findings, and audit history over time.
