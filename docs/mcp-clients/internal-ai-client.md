# Internal AI Client MCP Setup

Use this guide for an organization-approved internal MCP-compatible client.

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick Internal AI client.
6. Pick data mode.
7. Copy the generated config.
8. Paste it into the internal client according to your platform's MCP setup process.
9. Restart or reload the internal client.
10. Ask a starter question.

The internal client is responsible for model access, chat UI, authentication, provider policy, logging, and data handling. Doorframe MCP only exposes scoped local project facts through read-only tools.

Use summary mode or `--hide-raw-text` when the client should receive IDs, titles, counts, categories, and summaries without raw requirement text.

Only connect Doorframe MCP to project data if your organization has approved the AI client and model for that data.
