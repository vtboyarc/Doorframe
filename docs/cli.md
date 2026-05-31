# CLI

The `doorframe` CLI is for developers, CI pipelines, and repeatable local review-prep workflows.

The first useful command is `analyze`.

```bash
npm run doorframe -- analyze \
  --requirements ./examples/sample-requirements.csv \
  --jira ./examples/sample-jira.csv \
  --junit ./examples/sample-junit.xml \
  --out ./doorframe-report.html
```

The command:

1. Parses requirements CSV.
2. Parses Jira CSV.
3. Parses JUnit XML.
4. Extracts requirement IDs from Jira descriptions and test names.
5. Creates trace links.
6. Runs analyzer rules.
7. Writes an HTML traceability report.
8. Prints a short terminal summary.

## Future Commands

```bash
doorframe init
doorframe import requirements ./requirements.csv
doorframe import jira ./jira.csv
doorframe import junit ./test-results.xml
doorframe analyze
doorframe report ./doorframe-report.html
doorframe demo
```

These commands are roadmap items. The current implementation focuses on `doorframe analyze` with explicit file paths.
