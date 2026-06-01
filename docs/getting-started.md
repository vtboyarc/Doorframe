# Getting Started

Doorframe turns requirements exports, Jira work items, and test results into a traceability gap report you can actually use before a review.

Doorframe is local-first and useful without AI. It does not replace a requirements management system, Jira, a test system, or an organization's official review process.

## Run The Demo In Under Ten Minutes

```bash
npx @doorframe/cli demo
```

Open `doorframe-report.html` in a browser. The demo also writes `doorframe-baseline-diff.html`.

## Run The Web App

With npm:

```bash
npx @doorframe/cli serve
```

Open the printed URL, normally `http://localhost:3000`.

From source:

```bash
npm run dev
```

Open `http://localhost:3000`. Create a project, then click **Load Demo Project**.

## Run Baseline Diff

```bash
npx @doorframe/cli diff \
  --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv \
  --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --out ./doorframe-baseline-diff.html
```

## Import Your Own Files

1. Export requirements from your requirements tool as CSV, ReqIF, or ReqIFZ.
2. Export Jira issues as CSV.
3. Export test results from CI as JUnit XML.
4. Run Doorframe locally with the web app or CLI.
5. Review findings and the traceability matrix.
6. Export the HTML traceability report.

Doorframe detects requirement IDs in Jira and test text with patterns such as `REQ-001`, `SYS-123`, `SRS-123`, `DOORS-123`, and `SHALL-123`. Requirement ID patterns are configurable in project rulesets.

## Report

The report is a local HTML file. It is designed to work offline and print cleanly to PDF from a browser.

The report includes a cover, executive summary, import summary, top risks before review, traceability matrix, missing work, missing verification, closed work without passing tests, weak wording, failed tests by requirement, duplicate candidates, and an appendix.
