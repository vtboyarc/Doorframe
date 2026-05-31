# Contributing

Doorframe is moving toward a practical v0.1.0 release. Contributions should keep the project boring, local, inspectable, and easy to explain.

## Priorities

1. Make the Falcon Telemetry Gateway demo easy to run.
2. Keep the HTML traceability report useful before a review.
3. Harden imports for real exported files.
4. Keep baseline diff understandable.
5. Preserve local-first behavior.

## Before Opening A PR

Run:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run doorframe -- analyze \
  --requirements ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv \
  --jira ./examples/falcon-telemetry-gateway/sample-jira.csv \
  --junit ./examples/falcon-telemetry-gateway/sample-junit.xml \
  --out ./doorframe-report.html
```

## Product Boundaries

- Do not add telemetry.
- Do not add direct AI-provider calls unless explicitly requested in a later phase.
- Do not make Doorframe SaaS-first.
- Do not make approval, compliance, classified-data, CUI, FedRAMP, CMMC, NIST, or DoD claims.
- Keep demo data fictional.

## Demo Data

Use fictional examples only. Do not use real program names, real weapon systems, real aircraft names, real contract numbers, government markings, classified-sounding details, or proprietary examples.
