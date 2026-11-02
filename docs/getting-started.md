# Getting Started

Doorframe turns requirements exports, Jira work items, and test results into a traceability gap report you can actually use before a review.

Doorframe is local-first and useful without AI. It does not replace a requirements management system, Jira, a test system, or an organization's official review process.

## Run The Demo In Under Ten Minutes

```bash
npx doorframe demo
```

Open `doorframe-report.html` in a browser. The demo also writes `doorframe-baseline-diff.html`.

## Run The Web App

With npm:

```bash
npx doorframe serve
```

Open the printed URL, normally `http://localhost:3000`.

From source:

```bash
npm run dev
```

Open `http://localhost:3000`. Create a project, then click **Load Demo Project**.

## Run Baseline Diff

```bash
npx doorframe diff \
  --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv \
  --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --out ./doorframe-baseline-diff.html
```

## Import Your Own Files

1. Export requirements from your requirements tool as CSV, ReqIF, or ReqIFZ.
2. Export Jira issues as CSV.
3. Export test results from CI as JUnit XML.
4. Run Doorframe locally with the web app.
5. Review findings and the traceability matrix.
6. Export the HTML traceability report.

Doorframe detects requirement IDs in Jira and test text with patterns such as `REQ-001`, `SYS-123`, `SRS-123`, `DOORS-123`, and `SHALL-123`. Requirement ID patterns are configurable in project rulesets.

## Manual Verification And Missing Test Evidence

The requirement's **Verification Method** describes how it will be verified (for example, test, inspection, analysis, or demonstration). It is not a pass/fail result or a waiver of the linked-test check.

Doorframe currently checks for linked JUnit test results regardless of the verification method. It has no per-requirement control to mark manual verification complete or waive the missing-test finding. Recording "inspection" or manual acceptance criteria in your requirements export therefore does not clear that finding.

To supply test evidence, import actual JUnit XML results with the requirement ID in the test name or class name (matching your project's requirement ID patterns). A linked passing result satisfies the passing-test check; failed, errored, or skipped results do not. A missing verification method is a separate finding and still needs a method in the requirements export.

For verification performed outside this workflow, retain the real evidence and review disposition in your organization's process. Doorframe's finding indicates missing linked evidence in Doorframe, not proof that the requirement has never been verified. Do not invent a passing test result merely to clear a finding.

If an existing project still shows older guidance about marking verification outside automated tests after upgrading, rerun analysis to refresh its stored findings.

## Report

The report is a local HTML file. It is designed to work offline and print cleanly to PDF from a browser.

The report includes a cover, executive summary, import summary, top risks before review, traceability matrix, missing work, missing verification, closed work without passing tests, weak wording, failed tests by requirement, duplicate candidates, and an appendix.

## Optional MCP Setup

Doorframe works without AI. If your organization has approved an MCP-compatible AI client and model for the project data, open your project in the Doorframe web app and go to **MCP Setup**.

The page generates the local stdio MCP config, shows data-minimization settings, runs a health check, and provides starter questions. Doorframe MCP remains read-only and does not call AI providers directly.
