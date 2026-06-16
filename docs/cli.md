# Doorframe CLI

The command-line runner uses the same parsers and analyzers as the web app without storing anything. Most users should run it with `npx` or install `doorframe`; contributors can also run it from source.

```bash
npx doorframe demo
```

Start the local web app with npm:

```bash
npx doorframe serve
```

From source:

```bash
npm run doorframe -- demo
```

## `demo`

Generate offline reports from the fictional Falcon Telemetry Gateway sample.

```bash
npx doorframe demo
```

Optional flags:

- `--out <path>` Traceability report output path.
- `--diff-out <path>` Baseline diff report output path.
- `--skip-diff` Generate only the traceability report.

## `serve`

Start the local Doorframe web app and open the printed URL in a browser.

```bash
npx doorframe serve
```

Options:

- `--port <port>` Port to listen on, default `3000`.
- `--host <host>` Host to bind, default `127.0.0.1`.
- `--data-dir <path>` Local data directory, default `./.doorframe` from the directory where you run the command.

The npm-served web app uses the same local-first SQLite storage model as Docker. It does not send imported project data to Doorframe-hosted services.

## `analyze`

Build a traceability report from local files.

```bash
npx doorframe analyze \
  --requirements ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --jira ./examples/falcon-telemetry-gateway/sample-jira.csv \
  --junit ./examples/falcon-telemetry-gateway/sample-junit.xml \
  --out ./doorframe-report.html
```

The command prints a summary and writes a report in your chosen format.

- `--requirements <path>` Requirements CSV export.
- `--reqif <path>` ReqIF requirements export (can be combined with or used instead of `--requirements`).
- `--jira <path>` Jira CSV export.
- `--junit <path>` JUnit XML test results.
- `--format <html|md|json|csv>` Output format (defaults to `html`).
- `--ruleset <path>` JSON ruleset file (ID patterns, analyzer thresholds, disabled categories, custom rules).
- `--out <path>` Output path (defaults to `./doorframe-report.<ext>`).

The `json` format embeds a portable snapshot used by `doorframe diff`.

`doorframe report` is an alias for `doorframe analyze`.

## `diff`

Compare two requirements baselines and generate an offline HTML diff report.

```bash
npx doorframe diff \
  --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv \
  --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --out ./doorframe-baseline-diff.html
```

Optional `--jira` and `--junit` inputs add affected work item and test context to changed requirements.

The command detects added requirements, deleted requirements, changed fields, timing/threshold changes, and review concern prompts.

You can still compare two JSON reports produced by `analyze --format json`:

```bash
npx doorframe diff --base baseline-a.json --against baseline-b.json
```

Prints added/removed/modified requirements, work-item and test changes, and finding deltas.

## Connector imports

Fetch artifacts from external systems and feed them into the standard analysis.
Credentials are read from environment variables (local-first; nothing is stored
unless you write the report). Combine with `--requirements`/`--reqif` for a full
report.

```bash
npx doorframe import-jira    --requirements req.csv --jql "project = FG"
npx doorframe import-github  --requirements req.csv --junit-xml ci-junit.xml
npx doorframe import-gitlab  --requirements req.csv --project-id 42 --job-id 1001
npx doorframe import-jenkins --requirements req.csv --job my-app --build 17
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
- Run `doorframe --version` to confirm the installed CLI version.
- Configure MCP from the web app's project MCP Setup page. Advanced users can run the generated `npx -y doorframe@0.1.9 mcp --project ...` command manually.
- Run `doorframe mcp doctor --project ... --project-id ...` to validate the same local stdio MCP path before configuring an AI client.
- MCP is optional and read-only.
