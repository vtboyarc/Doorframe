# Releasing Doorframe

Doorframe uses semantic versioning. The first public preview is `v0.1.0`.

Do not publish a release until the package contents, Docker image, release notes, and GitHub Actions workflow have been reviewed.

## v0.1.0 Scope

- Local web app
- `doorframe` package with `doorframe` binary
- `doorframe demo`
- `doorframe serve`
- `doorframe analyze`
- `doorframe diff`
- `doorframe report` alias for report generation
- `doorframe mcp` read-only MCP launcher
- Docker image for the local web app
- Offline HTML traceability report
- Baseline diff report
- Fictional Falcon Telemetry Gateway demo project

## Release Process

1. Update versions in `package.json`, `apps/cli/package.json`, app packages, and shared packages if needed.
2. Update `CHANGELOG.md`.
3. Run the release checklist in `docs/release-checklist.md`.
4. Create and push the version tag:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

5. GitHub Actions runs checks, builds packages, builds the Docker image, creates release artifacts, and creates the GitHub Release.
6. Verify the npm package if publishing was enabled.
7. Verify the Docker image in GHCR.
8. Verify GitHub Release notes and uploaded assets.
9. Run an npx smoke test:

   ```bash
npx doorframe@0.1.0 demo
npx doorframe@0.1.0 serve
```

10. Run a Docker smoke test:

    ```bash
    docker run --rm -p 3000:3000 -v doorframe-data:/data ghcr.io/vtboyarc/doorframe:0.1.0
    ```

## Version Bumping

Use semantic versioning:

- Patch: fixes that do not change intended behavior.
- Minor: new backwards-compatible commands, report sections, imports, or web app features.
- Major: breaking command, report, data, or API changes.

For now, version bumping is manual. Keep root, command, app, and package versions aligned for a release.

## Release Workflow

`.github/workflows/release.yml` runs on tags matching:

```yaml
v*.*.*
```

The workflow:

1. Checks out the repo.
2. Sets up Node.
3. Installs dependencies.
4. Runs typecheck.
5. Runs lint.
6. Runs tests.
7. Builds the npm package.
8. Runs `npm pack --dry-run`.
9. Builds the web app.
10. Generates release artifacts.
11. Publishes npm only when `NPM_PUBLISH_ENABLED=true`.
12. Builds and pushes the Docker image to GHCR.
13. Creates a GitHub Release.
14. Uploads generated HTML reports, checksums, and the npm tarball.

## GitHub Release Contents

Each release should include:

- Release notes
- npm package name: `doorframe`
- Docker image name: `ghcr.io/vtboyarc/doorframe:<version>`
- Install commands
- MCP command
- Known limitations
- Security and privacy warning
- Link to docs
- `checksums.txt` when assets are uploaded

Generated assets should be safe and intentional:

- `doorframe-falcon-traceability-report.html`
- `doorframe-falcon-baseline-diff.html`
- `checksums.txt`
- npm package tarball

Do not upload local SQLite databases. Prefer sample CSV/XML files and generated reports from fictional data.

## Manual Setup Still Required

- Create or verify npm access for the `doorframe` package.
- Publish or reserve `doorframe`.
- Configure npm Trusted Publishing for `.github/workflows/release.yml`.
- Set GitHub repository variable `NPM_PUBLISH_ENABLED=true` only after the workflow is reviewed.
- Confirm GHCR package visibility and permissions after the first image push.
