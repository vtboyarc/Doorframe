# Release Checklist

Use this before tagging `v0.1.0`.

- Install dependencies: `npm install`
- Run typecheck: `npm run typecheck`
- Run lint: `npm run lint`
- Run tests: `npm test`
- Run dependency audit: `npm audit --audit-level=moderate`
- Run CLI demo analysis:
  `npm run doorframe -- analyze --requirements ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv --jira ./examples/falcon-telemetry-gateway/sample-jira.csv --junit ./examples/falcon-telemetry-gateway/sample-junit.xml --out ./doorframe-report.html`
- Run baseline diff demo:
  `npm run doorframe -- diff --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv --out ./doorframe-baseline-diff.html`
- Run web app: `npm run dev`
- Run Docker build: `docker compose build`
- Run MCP server smoke test against a local demo database.
- Verify generated reports have no external scripts, styles, fonts, images, or CDNs.
- Verify sample data is fictional.
- Verify security/privacy warnings are present.
- Verify no telemetry, direct AI-provider calls, or SaaS assumptions were added.
- Tag `v0.1.0`.
