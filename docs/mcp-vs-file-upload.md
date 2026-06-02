# MCP Vs File Upload

Uploading a requirements export directly into an enterprise AI client may be allowed in some organizations. That is not the same workflow as Doorframe MCP.

## Direct File Upload

- One-off and ad hoc.
- The AI client may see the whole uploaded file.
- It can be hard to know whether the export is complete or current.
- There is no durable traceability graph.
- There are no deterministic Doorframe checks unless the user runs them separately.
- There is no reusable baseline history.
- There is no standard Doorframe report pipeline.
- It can be harder to audit what was queried.
- It can be easier to overshare data.

## Doorframe MCP

- Doorframe imports requirements, work items, and tests into a local project.
- Doorframe builds a structured traceability graph.
- Doorframe runs deterministic checks.
- Doorframe compares baselines and detects high-concern changes.
- Doorframe flags stale trace candidates after requirement changes.
- Doorframe generates reports without AI.
- The AI client asks narrow questions through read-only MCP tools.
- Doorframe returns scoped structured results.
- There are no mutation tools, arbitrary SQL tools, arbitrary file reads, or direct AI-provider calls.

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”
