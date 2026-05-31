# Doorframe Architecture

Doorframe is local-first. The MVP stores imported data in a SQLite database created under the web app's `.doorframe` directory unless `DOORFRAME_DATA_DIR` is set.

## Packages

- `packages/core`: shared TypeScript types, Zod schemas, and normalization utilities.
- `packages/parsers`: CSV, JUnit XML, ReqIF, ReqIFZ, and requirement ID extraction.
- `packages/analyzers`: deterministic rule-based findings. No AI is required.
- `packages/reporting`: browser-printable HTML report generation.
- `apps/web`: Next.js UI and API routes.

## Import Flow

1. The user creates a local project.
2. The user uploads a local export file.
3. CSV imports require manual column mapping and show a preview before saving.
4. Parsed records are normalized into SQLite.
5. Jira and JUnit imports detect requirement IDs such as `REQ-123`, `SYS-123`, `SRS-123`, `DOORS-123`, and `SHALL-123`.
6. Doorframe creates trace links where the referenced requirement already exists.
7. Analyzer rules regenerate findings after each import.

## Non-Goals

The MVP does not call DOORS, Jira, cloud storage, telemetry, or external AI services. It does not claim to replace official requirements management tools.
