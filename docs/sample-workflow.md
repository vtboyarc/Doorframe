# Sample Workflow

The sample project is fictional. It uses a fake system named Falcon Telemetry Gateway.

## Files

- `examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv`
- `examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv`
- `examples/falcon-telemetry-gateway/sample-jira.csv`
- `examples/falcon-telemetry-gateway/sample-junit.xml`
- `examples/falcon-telemetry-gateway/expected-findings.json`

## Scenario

A team is preparing for a review. They want to know whether exported requirements have linked Jira work and test evidence before the meeting.

The sample includes:

- `REQ-001`: Sensor status display within 2 seconds.
- `REQ-002`: Failed authentication attempt logging.
- `REQ-003`: Communication-loss alert with vague wording.
- `REQ-004`: Duplicate-like sensor status requirement.
- `REQ-014`: Telemetry packet timing changes from 5 seconds to 2 seconds between baselines.

`REQ-003` intentionally says "quickly" and has no passing linked test. Doorframe should flag weak wording and missing verification evidence.

## Web Demo

1. Run the web app.
2. Create a project.
3. Click **Load Demo Project**.
4. Review the dashboard.
5. Open `REQ-003`.
6. Review findings and missing test evidence.
7. Open the trace graph.
8. Generate the HTML report.

## CLI Demo

```bash
npm run doorframe -- analyze \
  --requirements ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --jira ./examples/falcon-telemetry-gateway/sample-jira.csv \
  --junit ./examples/falcon-telemetry-gateway/sample-junit.xml \
  --out ./doorframe-report.html
```

Open `doorframe-report.html`.

## Baseline Diff

```bash
npm run doorframe -- diff \
  --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv \
  --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --out ./doorframe-baseline-diff.html
```
