# Getting Started

Doorframe turns requirements exports, Jira work items, and test results into a traceability gap report you can actually use before a review.

It is built for local analysis of exported engineering data. It does not replace a requirements management system, Jira, a test system, or an organization's official review process.

## What Doorframe Accepts

- Requirements CSV exports
- ReqIF and ReqIFZ exports, with limited MVP support
- Jira CSV exports
- JUnit XML test result files

Doorframe detects requirement IDs in Jira and test text with patterns such as `REQ-001`, `SYS-123`, `SRS-123`, `DOORS-123`, and `SHALL-123`.

## Run the Web Demo

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. If that port is busy, Next.js will print the actual local URL.

Create a project, then click **Load Demo Project**. Doorframe loads fictional sample data for Falcon Telemetry Gateway and generates dashboard metrics, findings, trace links, and a report.

## Run the CLI Demo

```bash
npm run doorframe -- analyze \
  --requirements ./examples/sample-requirements.csv \
  --jira ./examples/sample-jira.csv \
  --junit ./examples/sample-junit.xml \
  --out ./doorframe-report.html
```

Open `doorframe-report.html` in a browser.

## Import Your Own Files

1. Export requirements from your requirements tool as CSV or ReqIF.
2. Export Jira issues as CSV.
3. Export test results from CI as JUnit XML.
4. Run Doorframe locally with the web app or CLI.
5. Review the dashboard and findings.
6. Export the HTML traceability report.

CSV imports require column mapping. Keep the first row as headers.

## Generate a Report

The report is a local HTML file. Use browser print-to-PDF if you need a PDF artifact for review prep.

The report includes an executive summary, import summary, traceability matrix, findings by severity, requirements with missing links, failed tests by requirement, and raw ID appendices.
