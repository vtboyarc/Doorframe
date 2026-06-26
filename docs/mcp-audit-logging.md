# MCP Audit Logging

Doorframe MCP can write an optional local JSONL audit log for MCP tool calls.

```bash
npx -y doorframe@0.1.12 mcp \
  --project ./doorframe.sqlite \
  --project-id project_123 \
  --audit-log ./doorframe-mcp-audit.jsonl
```

If no audit log path is provided, Doorframe MCP does not write an MCP audit log.

## Logged Fields

- Timestamp.
- Project ID and name when available.
- Tool name.
- Sanitized high-level parameters.
- Result count when easy to infer.
- MCP data mode.
- Success or failure.
- Duration in milliseconds.

## Not Logged

- Full requirement text.
- Full work item descriptions.
- Full test failure messages.
- Raw imported file contents.
- Environment variables.
- Secrets.

The log is a local artifact. Protect it the same way you protect other project review artifacts.

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”
