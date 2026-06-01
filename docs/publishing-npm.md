# Publishing The npm Package

Doorframe's first public npm package is `@doorframe/cli`. It exposes the `doorframe` binary and includes the CLI, demo command, report generation, baseline diff, connector commands, and read-only MCP launcher.

Do not publish until the release workflow and package contents have been reviewed.

## One-Time Setup

1. Create an npm account or npm organization that can own the `@doorframe` scope.
2. Reserve or verify the package name `@doorframe/cli`.
3. Confirm the package exposes the command:

   ```bash
   doorframe --help
   ```

4. Confirm package metadata in `apps/cli/package.json`:
   - `name` is `@doorframe/cli`
   - `version` matches the release tag
   - `license` is present
   - `repository`, `homepage`, and `bugs` point to the GitHub repo
   - `bin.doorframe` points to the built CLI
   - `files` is an allowlist
   - `publishConfig.access` is `public`

## Local Dry Run

```bash
npm install
npm pack --dry-run -w apps/cli
```

Review the file list. It should contain built CLI code, README, license, selected docs, and fictional sample data. It should not contain `.env` files, local databases, `node_modules`, coverage output, temp files, or unrelated build artifacts.

## Manual First Publish

Use a manual publish for the first release if the package has not been connected to npm Trusted Publishing yet.

```bash
npm publish -w apps/cli --access public
```

Verify:

```bash
npx @doorframe/cli@0.1.0 --help
npx @doorframe/cli@0.1.0 demo
```

## Recommended Later Path: Trusted Publishing

npm Trusted Publishing lets GitHub Actions publish through OIDC instead of long-lived npm tokens. This is the recommended release path once the package exists and the workflow has been reviewed.

Configure the npm package trusted publisher with:

- Publisher: GitHub Actions
- GitHub owner or organization: `vtboyarc`
- Repository: `Doorframe`
- Workflow filename: `release.yml`
- Allowed action: `npm publish`

The release workflow already has `id-token: write`. npm Trusted Publishing currently requires an npm CLI version that supports OIDC publishing and a compatible Node runtime, so the workflow updates npm before the publish step.

To enable npm publishing in GitHub Actions, set repository variable:

```text
NPM_PUBLISH_ENABLED=true
```

If that variable is absent or not `true`, the release workflow skips npm publishing while still running checks, building the CLI package, building the Docker image, and creating the GitHub Release.

Do not hardcode npm tokens in the repo. If a temporary token fallback is used, store it only as a GitHub Actions secret named `NPM_TOKEN` and remove it after Trusted Publishing is working.
