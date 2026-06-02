# MCP Value Case

Doorframe MCP is for teams that want an approved AI assistant to ask narrow questions about a local Doorframe project without uploading an entire requirements export into a chat window.

Doorframe remains the local traceability context layer. The AI client remains the assistant. Doorframe MCP does not include a model and does not call OpenAI, Anthropic, or any other AI provider directly.

## Why It Matters

Direct file upload can be useful when an organization approves it, but it is one-off and broad. The AI client may see the whole uploaded file, and the workflow does not create a durable traceability graph, deterministic checks, baseline history, or a standard report pipeline.

Doorframe MCP is narrower:

- Doorframe imports requirements, work items, and tests into a local project.
- Doorframe builds a structured traceability graph.
- Doorframe runs deterministic checks and baseline comparisons.
- Doorframe generates reports without AI.
- An approved AI client can ask scoped questions through read-only MCP tools.
- Tool results can be capped, summarized, or configured to hide raw text.

## Boundary

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”

Use careful language: approved AI client, approved data, organization-approved environment, local/internal deployment, read-only local context, and controlled traceability context.
