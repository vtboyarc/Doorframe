# Threat Model

This document lists practical risks for Doorframe v0.1.0. It is not a compliance claim or certification.

## Sensitive Requirements Data

Requirements, work items, tests, findings, and reports may contain sensitive project information. Doorframe does not decide whether data is approved for use. Users and organizations must decide before importing files.

## Accidental External Upload

Doorframe does not phone home or require accounts, but users can still move reports or databases outside their environment. Treat generated reports as project artifacts.

Uploading a whole requirements export into an AI chat window can overshare data and bypass Doorframe's scoped traceability graph, deterministic checks, baseline history, and report pipeline. Doorframe MCP is intended to return narrower read-only project facts, but those facts may still enter the connected AI client's context.

## Malicious Imported File Content

Imported CSV, ReqIF, ReqIFZ, and JUnit content is untrusted. Reports must HTML-escape imported values. Import parsers should fail with warnings instead of crashing.

## HTML Report Escaping

The report generator escapes imported strings and uses local CSS only. Tests cover escaping and absence of external resources.

## MCP Data Exposure

The MCP server is read-only, but returned data may become part of an AI client's context. Use MCP only with approved data and approved clients.

Doorframe MCP does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.

Use `--mode summary`, `--hide-raw-text`, and `--max-results` where a narrower context is appropriate. If `--audit-log` is enabled, protect the local JSONL log as a project artifact.

## Arbitrary File Access

The MCP server should only open the project database path provided at startup. It must not expose arbitrary file-read tools.

## Generic SQL Tool Risk

Doorframe MCP must not expose a generic SQL query tool. Tools should return bounded, typed project data.

## Dependency Risk

Dependencies should be reviewed before release. Run `npm audit` and decide whether findings affect the local MVP threat model.

## Docker Deployment Risk

Docker deployment depends on host controls, mounted volumes, and local network exposure. Bind and expose it only where intended.
