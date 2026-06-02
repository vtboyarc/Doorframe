# Approved AI Client Guidance

Doorframe MCP is model-agnostic. It does not include an AI model, chat UI, AI-provider authentication, provider policy enforcement, or external API calls.

The connected AI client handles:

- The model.
- The chat interface.
- User authentication.
- AI-provider and enterprise policy controls.
- Prompt, tool-result, and response logging.
- Data retention behavior.
- Network routing.

Organizations decide which AI clients, models, networks, deployments, and project data are approved. Doorframe cannot make that decision.

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”

## Recommended Internal Checklist

- Confirm the Doorframe project database is approved for the chosen AI workflow.
- Confirm the MCP client is approved for the same data category.
- Confirm whether tool results are logged or retained by the AI client.
- Use `--mode summary` or `--hide-raw-text` when raw requirement text should not be shared.
- Use `--audit-log` when a local JSONL record of MCP tool calls is useful.
