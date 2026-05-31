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

## Researched

- DOORS Next integration — see `docs/integrations/doors-next.md` (ReqIF round-trip now; OSLC client later).

## Later

- Optional AI review
- Optional local LLM support
- Optional OpenAI and Anthropic integration
- MCP server
- Internal deployment guide
- RBAC
- SSO
- Enterprise support model

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
