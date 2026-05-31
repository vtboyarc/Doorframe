# Falcon Telemetry Gateway Demo

Falcon Telemetry Gateway is a fictional project used to demonstrate Doorframe. It is a small local telemetry review workflow with requirements, Jira-style work items, and JUnit test evidence.

All data in this folder is fictional. It does not describe a real program, aircraft, contract, government system, or proprietary project.

## Files

- `sample-requirements-baseline-a.csv`: earlier requirements baseline.
- `sample-requirements-baseline-b.csv`: changed requirements baseline used for the main demo.
- `sample-jira.csv`: Jira-style work item export.
- `sample-junit.xml`: JUnit test evidence export.
- `expected-findings.json`: expected signals to look for in the Doorframe report.

## Run The CLI Demo

```sh
npm run doorframe -- analyze \
  --requirements ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --jira ./examples/falcon-telemetry-gateway/sample-jira.csv \
  --junit ./examples/falcon-telemetry-gateway/sample-junit.xml \
  --out ./doorframe-report.html
```

## Run The Baseline Diff Demo

```sh
npm run doorframe -- diff \
  --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv \
  --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --out ./doorframe-baseline-diff.html
```

## What The Demo Proves

The demo is designed to make Doorframe's value visible quickly:

- `REQ-003` uses weak wording: "quickly".
- `REQ-003` has no work item that explicitly references `REQ-003`.
- `FG-21` mentions communication loss but does not include the requirement ID, so Doorframe does not create a high-confidence trace link.
- `REQ-003` has no passing linked test evidence.
- `FG-23`, `FG-33`, and `FG-41` are closed or resolved work items without passing verification evidence.
- `REQ-001` and `REQ-004` are similar enough to show a duplicate requirement candidate.
- `REQ-014` changes from a 5 second processing threshold to a 2 second threshold between baselines.

The report should show traceability gaps, weak requirement wording, missing verification evidence, closed work without passing tests, duplicate candidates, and changed baseline concerns.
