# MCP Data Minimization

Doorframe MCP supports result minimization so a connected AI client can receive scoped project facts instead of broad raw text.

## Startup Flags

```bash
npx -y doorframe@0.1.17 mcp \
  --project ./doorframe.sqlite \
  --project-id project_123 \
  --mode standard \
  --max-results 25 \
  --hide-raw-text
```

Modes:

- `summary`: returns IDs, titles, counts, categories, and summaries. It hides raw requirement text, work item descriptions, and test failure messages.
- `standard`: the default. It returns short excerpts when useful and caps results.
- `detailed`: allows full requirement text in detail tools while remaining read-only and bounded.

`--hide-raw-text` overrides the mode and hides raw requirement text in supported tools.

## Applied Tools

Data minimization applies to:

- `search_requirements`
- `get_requirement_detail`
- `list_changed_requirements`
- `get_requirement_change_detail`
- `get_stale_trace_candidates`
- `get_review_brief`

`--max-results` caps list results from 1 to 100 (larger values act as 100) in:

- `search_requirements`
- `list_findings`
- `get_traceability_gaps`
- `get_review_risk_summary`
- `find_orphan_items`
- `list_changed_requirements`
- `get_stale_trace_candidates`
- `get_review_brief`

The stale trace and review brief resources also follow `--max-results`. The findings, traceability matrix, and review prep resources keep fixed caps (50 findings, 100 matrix rows, and 20 items per gap list).

Doorframe MCP still does not expose arbitrary SQL, arbitrary file reads, mutation tools, imported source files, environment variables, or secrets.

Any data returned by Doorframe MCP may become part of the connected AI client's context.

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”
