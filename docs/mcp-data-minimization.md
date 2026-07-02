# MCP Data Minimization

Doorframe MCP supports result minimization so a connected AI client can receive scoped project facts instead of broad raw text.

## Startup Flags

```bash
npx -y doorframe@0.1.15 mcp \
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

Doorframe MCP still does not expose arbitrary SQL, arbitrary file reads, mutation tools, imported source files, environment variables, or secrets.

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”
