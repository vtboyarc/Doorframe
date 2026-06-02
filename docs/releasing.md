# Releasing Doorframe

Doorframe uses semantic versioning. The first public preview is `v0.1.0`.

Publishing runs from the `main` branch after a PR merge. Because npm package versions are immutable, any PR intended to publish a new npm package must bump `apps/cli/package.json` to an unpublished version before it merges.

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

1. Update `apps/cli/package.json` to the next unpublished semantic version. Keep `package.json`, app packages, and shared packages aligned when their versions are release-significant.
2. Update `CHANGELOG.md`.
3. Run the release checklist in `docs/release-checklist.md`.
4. Merge the PR to `main`.
5. GitHub Actions runs checks, builds packages, runs `npm pack --dry-run`, publishes the `doorframe` npm package with the configured npm auth path, and pushes the Docker image to GHCR.
6. Verify the npm package.
7. Verify the Docker image in GHCR.
8. Optional: create and push the version tag to create the GitHub Release and uploaded release artifacts:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

9. Verify GitHub Release notes and uploaded assets.
10. Run an npx smoke test:

   ```bash
   npx doorframe@0.1.0 demo
   npx doorframe@0.1.0 serve
   ```

11. Run a Docker smoke test:

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

`.github/workflows/release.yml` runs on:

```yaml
push:
  branches:
    - main
  tags:
    - "v*.*.*"
workflow_dispatch:
```

On `main`, the workflow:

1. Checks out the repo.
2. Sets up Node.
3. Resolves the publish version from `apps/cli/package.json`.
4. Fails early if that npm version already exists from a different commit.
5. Installs dependencies.
6. Runs typecheck.
7. Runs lint.
8. Runs tests.
9. Builds the npm package.
10. Builds the web app.
11. Runs `npm pack --dry-run`.
12. Publishes npm through the `NPM_TOKEN` repository secret when present, otherwise through Trusted Publishing.
13. Builds and pushes the Docker image to GHCR with `<version>`, `main`, `main-<sha>`, and `latest` tags. Prerelease versions do not move `latest`.

On a `v*.*.*` tag, the workflow also validates that the tag matches `apps/cli/package.json`, generates release artifacts, creates the GitHub Release, and uploads generated HTML reports, checksums, and the npm tarball. If the npm version was already published from `main`, the tag run skips npm publishing and continues.

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
- Configure npm Trusted Publishing for `.github/workflows/release.yml`, or add a temporary GitHub Actions repository secret named `NPM_TOKEN`.
- Confirm GHCR package visibility and permissions after the first image push.
