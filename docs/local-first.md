# Local-First Design

Doorframe is not SaaS-first. The normal workflow runs on a local machine, in Docker, or inside an organization-controlled internal environment.

## What Local-First Means

- Imported files stay in the local environment running Doorframe.
- Doorframe uses SQLite for local project storage.
- There is no telemetry.
- There are no external API calls by default.
- No cloud account is required.
- AI is not required for core parsing, trace linking, analysis, or reporting.

## Web App

The web app is a local user interface for systems engineers, scrum masters, requirements analysts, and test leads. It is intended to run on a workstation or inside an internal container.

## CLI

The CLI is for developers, CI jobs, and repeatable review-prep workflows. It uses the same parser, analyzer, and reporting packages as the web app.

## Optional AI Later

AI features may be added later, but they must be optional and off by default. If external AI providers are supported later, users must explicitly configure the provider and explicitly choose what data is sent.

Rule-based findings must keep working without AI.
