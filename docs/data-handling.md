# Data Handling

Doorframe works with local project exports.

## Imported Files

- Requirements CSV, ReqIF, and ReqIFZ.
- Jira CSV.
- JUnit XML test results.

Doorframe stores parsed records, raw attributes where practical, trace links, findings, import batches, baselines, rulesets, and audit events.

## Storage

The web app stores project data in SQLite under `DOORFRAME_DATA_DIR` or `.doorframe` by default. Docker stores data in the configured mounted directory.

The CLI reads local files and writes reports to the requested output path.

## Reports

Reports contain imported project data, findings, trace links, IDs, test names, failure messages, and source filenames. Treat reports as review artifacts.

## Delete Local Data

Delete the local project database or Docker data directory if you need to remove all locally stored project data. A more granular project deletion workflow should be added after v0.1.0 if users need it.

## MCP Exposure

The MCP server exposes local Doorframe project summaries, requirements, work items, tests, trace links, and findings to the connected MCP client. Data returned by MCP may enter the connected AI client's context.
