# Roadmap

Doorframe's roadmap keeps the MVP local-first and rule-based. AI is optional later and off by default.

## Near-Term

- Better ReqIF support
- Better CSV column mapping
- Better traceability matrix
- Baseline-to-baseline diff
- More report formats
- Better sample project

## Mid-Term

- Jira API integration
- GitLab and GitHub test artifact import
- Jenkins import
- DOORS Next integration research
- Configurable requirement ID patterns
- Custom analyzer rules
- Project-level rulesets

## Later

- Optional AI review
- Optional local LLM support
- Optional OpenAI and Anthropic integration
- MCP server
- Internal deployment guide
- RBAC
- Audit logs
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
