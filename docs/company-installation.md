# Company Installation

Doorframe is designed for local or internal use. Companies should be able to mirror npm packages and Docker images, pin versions, scan dependencies, and run Doorframe with organization-approved data only.

Companies and restricted environments can use Doorframe by mirroring the npm package or Docker image into an internal registry, scanning it, pinning a version, and running it inside an approved environment. Doorframe can operate without internet access once dependencies/images are available internally. MCP can also run locally/internal, but any connected AI client and model must be separately approved for the project data.

## Individual Technical Users

Use npx or a global npm install:

```bash
npx doorframe demo
npx doorframe serve
npm install -g doorframe
doorframe --help
```

For CI or automation:

```bash
npx doorframe analyze \
  --requirements requirements.csv \
  --jira jira.csv \
  --junit test-results.xml \
  --out doorframe-report.html
```

## Internal Teams

Use the Docker image from GHCR, then mirror it internally if required:

```bash
docker pull ghcr.io/vtboyarc/doorframe:0.1.5
docker tag ghcr.io/vtboyarc/doorframe:0.1.5 internal-registry.example.com/tools/doorframe:0.1.5
docker push internal-registry.example.com/tools/doorframe:0.1.5
```

Run the mirrored image inside the approved environment:

```bash
docker run -p 3000:3000 -v doorframe-data:/data internal-registry.example.com/tools/doorframe:0.1.5
```

## Locked-Down Environments

Recommended controls:

- Mirror Docker images internally.
- Mirror `doorframe` internally.
- Pin versions.
- Scan npm dependencies and Docker images.
- Run with approved data only.
- Keep Doorframe local or internal.
- Do not connect MCP to unapproved AI clients.
- Do not import classified, controlled, proprietary, or sensitive data unless your organization has approved that use.

## Example Internal Docker Workflow

1. Security or tools team reviews the release.
2. Team pulls the pinned Docker image.
3. Team scans the image.
4. Team mirrors the image to the internal registry.
5. Team deploys it on an internal VM or container platform.
6. Users access the internal Doorframe URL.
7. Users import approved exports and generate reports.

## Example npm Mirror Workflow

1. Mirror `doorframe` into the internal npm registry.
2. Developers run:

   ```bash
   npx doorframe analyze \
     --requirements requirements.csv \
     --jira jira.csv \
     --junit test-results.xml \
     --out doorframe-report.html
   ```

3. CI jobs store Doorframe reports as build artifacts.

Doorframe does not add telemetry or direct AI-provider calls. MCP is optional and read-only.
