# doorframe-mcp

Read-only MCP server for a local Doorframe project database.

```bash
npm run --silent dev -w apps/mcp-server -- --project ../../examples/demo-project/doorframe.sqlite
```

Installed binary form:

```bash
doorframe-mcp --project ./doorframe.sqlite --mode standard --max-results 25
```

This package uses stdio transport only. It never writes diagnostics to stdout because stdout is reserved for MCP protocol messages.

Doorframe MCP does not include an AI model and does not call OpenAI, Anthropic, or any other AI provider. It only exposes read-only local Doorframe project context to an MCP-compatible client.

Use `--mode summary`, `--mode standard`, `--mode detailed`, `--max-results`, `--hide-raw-text`, and optional `--audit-log ./doorframe-mcp-audit.jsonl` to control result scope and local audit logging.

See [docs/mcp-server.md](../../docs/mcp-server.md) for tools, resources, prompts, client configuration, and security notes.
