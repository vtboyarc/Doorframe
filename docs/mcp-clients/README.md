# MCP Client Setup

Doorframe is used in the browser first. Run Doorframe, open your project, then use the project MCP Setup page to generate the exact local stdio configuration for your approved AI client.

Standard flow:

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick your AI client.
6. Pick data mode.
7. Copy the generated config.
8. Paste it into the AI client.
9. Restart or reload the AI client.
10. Ask a starter question.

Doorframe MCP is optional. Doorframe works without AI.

Doorframe MCP gives an approved AI client a narrow, read-only way to query the local Doorframe project through structured tools. Doorframe does not include an AI model and does not call OpenAI, Anthropic, or any AI provider directly.

Only connect Doorframe MCP to project data if your organization has approved the AI client and model for that data.

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”

Client guides:

- [Generic MCP client](./generic.md)
- [Cursor](./cursor.md)
- [Claude Desktop](./claude-desktop.md)
- [VS Code](./vscode.md)
- [Claude Code](./claude-code.md)
- [ChatGPT / remote MCP note](./chatgpt.md)
- [Internal AI client](./internal-ai-client.md)

See also [MCP troubleshooting](../mcp-troubleshooting.md).
