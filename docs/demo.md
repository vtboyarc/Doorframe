# Falcon Telemetry Gateway Demo

Falcon Telemetry Gateway is Doorframe's fictional demo project. It exists so a new user can try Doorframe in under ten minutes without using real requirements, Jira issues, or test results.

All demo data is fictional. It does not represent a real program, aircraft, contract, government system, or proprietary project.

## Files

- `examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv`
- `examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv`
- `examples/falcon-telemetry-gateway/sample-jira.csv`
- `examples/falcon-telemetry-gateway/sample-junit.xml`
- `examples/falcon-telemetry-gateway/expected-findings.json`

## Web Demo

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, create a project, and click **Load Demo Project**.

## CLI Demo

```bash
npm run doorframe -- analyze \
  --requirements ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --jira ./examples/falcon-telemetry-gateway/sample-jira.csv \
  --junit ./examples/falcon-telemetry-gateway/sample-junit.xml \
  --out ./doorframe-report.html
```

## Baseline Diff Demo

```bash
npm run doorframe -- diff \
  --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv \
  --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --out ./doorframe-baseline-diff.html
```

## Expected Signals

- `REQ-003` uses weak wording: "quickly".
- `REQ-003` has no explicit Jira trace because `FG-21` mentions communication loss without referencing `REQ-003`.
- `REQ-003` has no passing linked test.
- `FG-23`, `FG-33`, and `FG-41` are closed or resolved without passing verification evidence.
- `REQ-001` and `REQ-004` are duplicate candidates.
- `REQ-014` changes from 5 seconds to 2 seconds between baselines.

The expected findings are documented in `examples/falcon-telemetry-gateway/expected-findings.json`.
