# Publishing The npm Package

Doorframe's public npm package is `doorframe`. It exposes the `doorframe` binary and includes the local web app server, demo command, report generation, baseline diff, connector commands, and optional read-only MCP support.

The GitHub release workflow publishes from `main` after a PR merge. npm package versions are immutable, so a PR that should publish a new npm package must update `apps/cli/package.json` to a version that has not already been published.

## One-Time Setup

1. Create or verify an npm account that can publish the `doorframe` package.
2. Reserve or verify the package name `doorframe`.
3. Confirm the package exposes the command:

   ```bash
   doorframe --help
   ```

4. Confirm package metadata in `apps/cli/package.json`:
   - `name` is `doorframe`
   - `version` is the next unpublished semantic version
   - `license` is present
   - `repository`, `homepage`, and `bugs` point to the GitHub repo
   - `bin.doorframe` points to the built command entrypoint
   - `files` is an allowlist
   - `publishConfig.access` is `public`
5. Configure npm Trusted Publishing:
   - Publisher: GitHub Actions
   - GitHub owner or organization: `vtboyarc`
   - Repository: `Doorframe`
   - Workflow filename: `release.yml`
   - Allowed action: `npm publish`
6. Optional fallback: create a GitHub repository secret named `NPM_TOKEN` only if Trusted Publishing is not ready.
   - Location: `vtboyarc/Doorframe` -> Settings -> Secrets and variables -> Actions -> Repository secrets.
   - Secret name: `NPM_TOKEN`
   - Secret value: an npm automation or publish token for the `doorframe` package.
   - Do not commit npm tokens to the repository.

## Local Dry Run

```bash
npm install
npm pack --dry-run -w apps/cli
```

Review the file list. It should contain built command code, README, license, selected docs, the packaged local web app, and fictional sample data. It should not contain `.env` files, local databases, `node_modules`, coverage output, temp files, or unrelated build artifacts.

## Main Branch Publishing

When a PR merges to `main`, `.github/workflows/release.yml`:

1. Reads the package name and version from `apps/cli/package.json`.
2. Checks whether `doorframe@<version>` already exists on npm.
3. Runs install, typecheck, lint, tests, build, and `npm pack --dry-run`.
4. Publishes `doorframe@<version>` with the `latest` npm dist-tag when the version is unpublished. If `NPM_TOKEN` is present, the workflow uses that repository secret; otherwise it uses npm Trusted Publishing.
5. Builds and pushes the GHCR Docker image.

If the npm version already exists from a different commit on a main-branch run, the workflow skips npm publishing and continues to the Docker image. Bump `apps/cli/package.json` in a PR that should publish a new npm package version. If a rerun sees the same version already published from the same commit, it skips npm publishing and continues to the Docker image.

## Manual First Publish

Use a manual publish for the first release if the package has not been connected to npm Trusted Publishing yet.

```bash
npm publish -w apps/cli --access public
```

Verify:

```bash
npx doorframe@0.1.14 --help
npx doorframe@0.1.14 demo
npx doorframe@0.1.14 serve
```

## Publishing Authentication

npm Trusted Publishing lets GitHub Actions publish through OIDC instead of long-lived npm tokens. This is the preferred automated release path for Doorframe.

The release workflow already has `id-token: write`. npm Trusted Publishing currently requires an npm CLI version that supports OIDC publishing and a compatible Node runtime, so the workflow updates npm before the publish step.

If Trusted Publishing cannot be used yet, store a token only as the GitHub Actions repository secret `NPM_TOKEN`. The workflow masks the secret and passes it to `npm publish` as `NODE_AUTH_TOKEN`.

Avoid long-lived `NPM_TOKEN` publishing once Trusted Publishing is configured.
