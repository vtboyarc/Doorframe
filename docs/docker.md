# Docker

The Docker deployment runs the local Doorframe web app. It does not require Postgres, cloud services, telemetry, or external APIs.

## Run

```bash
docker compose up
```

Then open:

```text
http://localhost:3000
```

## Storage

The compose setup mounts local storage into the container so the SQLite database persists across container restarts.

```text
./.doorframe-docker -> /data/doorframe
```

The app reads `DOORFRAME_DATA_DIR=/data/doorframe`.

## Build Only

```bash
docker build -f docker/Dockerfile -t doorframe:local .
```

## Reminder

Do not use Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.
