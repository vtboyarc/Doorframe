# Install Doorframe

Most users should run Doorframe with npm/npx or Docker. Clone the source repository only when contributing or auditing the source.

Doorframe runs locally by default. It does not send imported project data to Doorframe-hosted services, has no telemetry, and does not call AI providers by default.

Doorframe is used in the browser. Run Doorframe, open the local URL, import or open a project, then use the project pages to review findings, reports, baselines, and optional MCP setup.

## Try Without Installing

```bash
npx doorframe demo
```

This generates a local HTML traceability report and baseline diff report from the fictional Falcon Telemetry Gateway demo data.

## Run The Web App With npm

```bash
npx doorframe serve
```

Open the printed URL, normally `http://localhost:3000`. By default this stores the local SQLite database in `./.doorframe` under the directory where you run the command.

Options:

- `--port <port>` changes the port.
- `--host <host>` changes the bind host. The default is `127.0.0.1`.
- `--data-dir <path>` changes the local data directory.

## Generate A Report

```bash
npx doorframe analyze \
  --requirements requirements.csv \
  --jira jira.csv \
  --junit test-results.xml \
  --out doorframe-report.html
```

The report is offline HTML and can be reviewed locally or printed to PDF.

## Install Globally

```bash
npm install -g doorframe
doorframe --help
doorframe serve
```

Global install is useful for running the web app, local scripts, or repeated report generation.

## Run The Web App With Docker

```bash
docker run -p 3000:3000 -v doorframe-data:/data ghcr.io/vtboyarc/doorframe:0.1.8
```

Open `http://localhost:3000`. The mounted Docker volume stores the local SQLite database.

## Run With Docker Compose

```bash
docker compose up
```

Compose builds from source when used from this repository and stores data in the `doorframe-data` named volume.

## Configure MCP From The Web App

Open Doorframe in your browser, open or create a project, then go to **MCP Setup**. The page generates the local stdio MCP command and client-specific config for the current project.

Doorframe MCP is optional and read-only. It exposes local Doorframe project data to an MCP-compatible client. Data returned by MCP may become part of that client's context, so do not connect it to unapproved AI clients or unapproved data.

Advanced users can still run the generated MCP command manually. The normal path is to copy it from the MCP Setup page.

## Build From Source

Use source only when contributing, auditing, or changing Doorframe.

```bash
git clone https://github.com/vtboyarc/Doorframe.git
cd Doorframe
npm install
npm run build
npm test
```

After building from source, run:

```bash
npm run start
```

Then open `http://localhost:3000`.

Companies and restricted environments can mirror the npm package or Docker image into an internal registry, scan it, pin a version, and run Doorframe inside an approved local, internal, or air-gapped environment.
