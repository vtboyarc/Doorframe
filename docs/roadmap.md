# Roadmap

Doorframe's roadmap keeps the MVP local-first and rule-based. AI is optional later and off by default.

## Shipped

- Type-aware ReqIF support (attribute definitions, enumerations, spec hierarchy → parent links; multi-file `.reqifz`).
- CSV column mapping inference with import preview.
- Dedicated traceability matrix view with coverage.
- Baselines and baseline-to-baseline diff (web UI + `doorframe diff`).
- Multiple report formats: HTML, Markdown, JSON, CSV.
- Richer sample project exercising every finding category.
- Jira API integration and GitLab/GitHub/Jenkins test-artifact import (connector package, env-configured).
- Configurable requirement ID patterns.
- Custom analyzer rules and project-level rulesets (per-project settings).
- Audit log of imports, analysis runs, baselines, ruleset changes, and report generation.
- Read-only stdio MCP server for local project traceability and review-prep queries.

## Researched

- DOORS Next integration — see `docs/integrations/doors-next.md` (ReqIF round-trip now; OSLC client later).

## Later

- Optional AI review
- Optional local LLM support
- Optional OpenAI and Anthropic integration
- Expanded MCP features
- Internal deployment guide
- RBAC
- SSO
- Enterprise support model

## MCP Roadmap

Near-term MCP:

- read-only stdio MCP server
- project summary resource
- findings resource
- traceability matrix resource
- review prep prompt
- requirement detail tool
- traceability gap tools

Later MCP:

- optional Streamable HTTP transport for internal deployments
- authentication for HTTP mode
- configurable redaction
- configurable result limits
- project ruleset resource
- report generation tool
- baseline comparison tools
- optional write actions behind explicit user approval

Write actions should remain disabled until the read-only MCP server is stable.

Possible future write tools, not for MVP:

- create_review_note
- export_review_brief
- generate_report
- mark_finding_reviewed
- attach_local_comment

## AI Roadmap

AI should be optional and off by default.

When AI is added later:

- The user must explicitly configure a provider.
- The user must explicitly choose what data is sent.
- Doorframe must show clear warnings before sending requirement text to any external model.
- Local model usage should be supported if practical.
- Rule-based findings must keep working without AI.

Potential future AI commands:

- Suggest improved wording for a requirement.
- Summarize changes between baselines.
- Generate missing acceptance criteria ideas.
- Explain why a trace link looks weak.
- Summarize review risk.
