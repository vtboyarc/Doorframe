# Doorframe Architecture

Doorframe is local-first. The MVP stores imported data in a SQLite database created under the web app's `.doorframe` directory unless `DOORFRAME_DATA_DIR` is set.

## Packages

- `packages/core`: shared TypeScript types, Zod schemas, normalization utilities, and the ruleset/baseline/audit models (`Ruleset`, `DEFAULT_RULESET`, `diffBaselines`, `AuditEvent`).
- `packages/parsers`: CSV, JUnit XML, type-aware ReqIF/ReqIFZ, configurable requirement ID extraction, and CSV mapping inference.
- `packages/analyzers`: deterministic rule-based findings with ruleset-driven thresholds and custom-rule evaluation. No AI is required.
- `packages/reporting`: HTML, Markdown, JSON, and CSV report generation (shared matrix logic in `shared.ts`).
- `packages/integrations`: Jira/GitHub/GitLab/Jenkins connectors over an injectable `HttpClient` (unit-tested with mocks; no network in CI), plus a DOORS Next scaffold.
- `packages/storage`: in-memory project-data assembly and trace-link rules.
- `apps/web`: Next.js UI and API routes (imports, ruleset settings, baselines + diff, matrix, audit, multi-format reports).
- `apps/cli`: command-line analyzer (`analyze`, `diff`, `import-*`).

## Rulesets, baselines, and audit

- Each project has a `Ruleset` (ID patterns, analyzer config, custom rules) in the `rulesets` table; analysis falls back to `DEFAULT_RULESET`.
- Baselines persist a serialized `ProjectSnapshot`; `diffBaselines` compares two snapshots by `externalId`.
- Mutating actions append to the `audit_log` table, attributed to the OS user (no accounts in the MVP).

## Import Flow

1. The user creates a local project.
2. The user uploads a local export file.
3. CSV imports require manual column mapping and show a preview before saving.
4. Parsed records are normalized into SQLite.
5. Jira and JUnit imports detect requirement IDs such as `REQ-123`, `SYS-123`, `SRS-123`, `DOORS-123`, and `SHALL-123`.
6. Doorframe creates trace links where the referenced requirement already exists.
7. Analyzer rules regenerate findings after each import.

## Connectors

Connectors (`packages/integrations`) are pure functions that take an injectable `HttpClient`, so they are unit-tested with mocked responses and never call the network during CI. Credentials are read from `DOORFRAME_*` environment variables only; nothing is persisted unless the user saves a report or imports into a project.

## Non-Goals

The MVP does not use cloud storage, telemetry, or external AI services, and it does not claim to replace official requirements management tools. Optional outbound connectors (Jira/GitHub/GitLab/Jenkins) only run when the user explicitly configures credentials.
