# Release Checklist

Use this before merging a PR that should publish a new Doorframe npm package and Docker image. Run the GitHub Release checks before tagging `v0.1.0`.

- Install dependencies: `npm install`
- Run typecheck: `npm run typecheck`
- Run lint: `npm run lint`
- Run tests: `npm test`
- Run build: `npm run build`
- Run dependency audit: `npm audit --audit-level=moderate`
- Run CLI demo analysis:
  `npm run doorframe -- analyze --requirements ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv --jira ./examples/falcon-telemetry-gateway/sample-jira.csv --junit ./examples/falcon-telemetry-gateway/sample-junit.xml --out ./doorframe-report.html`
- Run baseline diff demo:
  `npm run doorframe -- diff --baseline-a ./examples/falcon-telemetry-gateway/sample-requirements-baseline-a.csv --baseline-b ./examples/falcon-telemetry-gateway/sample-requirements-baseline-b.csv --out ./doorframe-baseline-diff.html`
- Run binary smoke test: `npm run test:bin -w apps/cli`
- Review npm package dry run: `npm pack --dry-run -w apps/cli`
- Verify `apps/cli/package.json` has an unpublished npm version.
- Install the packed tarball in a clean temp project and run `npx doorframe serve`.
- Verify `http://127.0.0.1:3000/api/health` returns OK.
- Run web app: `npm run dev`
- Run Docker build: `docker compose build`
- Run Docker smoke test if practical:
  `docker run --rm -p 3000:3000 -v doorframe-data:/data doorframe:local`
- Run MCP server smoke test against a local demo database.
- Verify generated reports have no external scripts, styles, fonts, images, or CDNs.
- Verify sample data is fictional.
- Verify security/privacy warnings are present.
- Verify no telemetry, direct AI-provider calls, or SaaS assumptions were added.
- Verify MCP remains optional and read-only.
- Verify `README.md` and `docs/install.md` point normal users to npm/npx or Docker, not source clone.
- Verify `docs/publishing-npm.md`, `docs/docker.md`, `docs/releasing.md`, and `docs/company-installation.md` are current.

## Publishing Checks

### npm

- Package name is `doorframe`.
- Version is unpublished on npm before merging to `main`.
- Version matches the release tag when creating a GitHub Release.
- `bin.doorframe` points to the built command entrypoint.
- `doorframe --help` works from the built package.
- `doorframe demo --help` works from the built package.
- `doorframe serve` starts the local web app from the installed package.
- `doorframe mcp --help` still works from the installed package.
- `npm pack --dry-run -w apps/cli` includes only expected files.
- README and license are included.
- `publishConfig.access` is `public`.
- No local databases, `.env` files, secrets, `node_modules`, coverage output, or temp files are included.

### Docker

- Image builds.
- Image runs.
- Healthcheck passes if practical.
- Main branch images are tagged with `<version>`, `main`, `main-<short-sha>`, and `latest` for non-prerelease versions.
- Tagged stable releases are also tagged with the minor version such as `0.1`.
- Image is pushed to GHCR.
- No secrets or `.env` files are included.
- Runtime uses `/data` for local storage.

### GitHub Release

- `CHANGELOG.md` is updated.
- Release notes include install commands.
- Release notes include Docker image name.
- Release notes include known limitations.
- Release notes include security/privacy warning.
- `checksums.txt` is included if assets are uploaded.

- Optional after the main publish succeeds: tag `v0.1.0` to create the GitHub Release.
