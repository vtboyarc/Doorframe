# Docker

The Docker image runs the local Doorframe web app. It does not require Postgres, cloud services, telemetry, user accounts, or external APIs.

If you prefer npm instead of Docker, run:

```bash
npx doorframe serve
```

Published images use GitHub Container Registry:

```text
ghcr.io/vtboyarc/doorframe:<version>
```

After a PR merges to `main`, the release workflow publishes:

- `ghcr.io/vtboyarc/doorframe:main`
- `ghcr.io/vtboyarc/doorframe:main-<short-sha>`
- `ghcr.io/vtboyarc/doorframe:latest` for non-prerelease versions

When the package version is unpublished or the workflow is rerunning the same published commit, it also publishes `ghcr.io/vtboyarc/doorframe:<version>`.

## Run Latest Stable

```bash
docker run -p 3000:3000 -v doorframe-data:/data ghcr.io/vtboyarc/doorframe:latest
```

## Run Pinned Version

```bash
docker run -p 3000:3000 -v doorframe-data:/data ghcr.io/vtboyarc/doorframe:0.1.3
```

Open `http://localhost:3000`.

## Docker Compose

```bash
docker compose up
```

Compose builds the image from this repository and stores data in the `doorframe-data` named volume mounted at `/data`.

## Storage

The app reads `DOORFRAME_DATA_DIR=/data` in the container. The SQLite database is stored in that mounted volume.

Protect the volume like any other project data. Do not import sensitive data unless your organization has approved Doorframe for that use in your environment.

## Build Locally

```bash
docker build \
  -f docker/Dockerfile \
  --build-arg VERSION=0.1.3 \
  --build-arg SOURCE_REPOSITORY=https://github.com/vtboyarc/Doorframe \
  -t doorframe:local .
```

## Internal Company Mirror

Companies and contractors should typically scan and mirror the pinned image into an internal registry before use.

```bash
docker pull ghcr.io/vtboyarc/doorframe:0.1.3
docker tag ghcr.io/vtboyarc/doorframe:0.1.3 internal-registry.example.com/tools/doorframe:0.1.3
docker push internal-registry.example.com/tools/doorframe:0.1.3
```

Then deploy the mirrored image:

```bash
docker run -p 3000:3000 -v doorframe-data:/data internal-registry.example.com/tools/doorframe:0.1.3
```

## Image Notes

- Runtime image runs as a non-root user.
- Runtime data is stored under `/data`.
- The image exposes port `3000`.
- The image has a healthcheck at `/api/health`.
- OCI labels include source repository, version, license, title, and description.
- Main branch publishes get `main`, `main-<short-sha>`, and `latest` tags for non-prerelease versions.
- Main branch publishes also include version tags such as `0.1.3` when that version is unpublished or already belongs to the same commit.
- Tagged stable releases also get minor tags such as `0.1`.
- Prereleases should not receive the `latest` tag.
