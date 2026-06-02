# No Telemetry

Doorframe does not collect usage analytics.

- Doorframe does not phone home.
- Doorframe does not require accounts.
- Doorframe does not send imported project data to external services by default.
- Doorframe does not call OpenAI, Anthropic, or other AI providers unless a future optional feature is explicitly configured.
- Generated reports do not load external assets.

Connector commands are explicit user actions. If a user runs a connector command for Jira, GitHub, GitLab, or Jenkins, that command contacts the configured service using local credentials.
