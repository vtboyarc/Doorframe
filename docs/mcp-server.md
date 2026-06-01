# Doorframe MCP Server

Doorframe MCP exposes a local Doorframe project database to MCP-compatible clients through read-only tools, resources, and prompts. It is meant for traceability and review-prep questions such as:

- What are the top traceability gaps in this project?
- Which requirements have no verification evidence?
- Which requirements have weak wording?
- Which closed Jira items lack passing tests?
- Prepare a requirements review brief.
- Show me REQ-003 and its linked work and tests.
- Which requirements should we discuss before test readiness review?

Doorframe MCP does not include an AI model and does not call OpenAI, Anthropic, or any other AI provider directly. It exposes read-only Doorframe project context to an MCP-compatible client. The connected client is responsible for model access, chat UI, authentication, and AI-provider data handling.

Doorframe can run without AI. The local web app, CLI, analyzers, and report generator do not require an AI provider. MCP is optional and only useful when connected to an MCP-compatible AI client.

## What It Does

- Opens one Doorframe SQLite project database path explicitly passed at startup.
- Serves stdio MCP tools, resources, and prompts.
- Answers from local Doorframe project data only.
- Returns concise results by default and caps larger result sets.
- Uses shared Doorframe project types, storage loading, and analyzer/reporting data shapes.

## What It Does Not Do

- It does not include an AI model.
- It does not call OpenAI, Anthropic, or any other AI provider.
- It does not mutate requirements, work items, tests, trace links, findings, imports, reports, project settings, or local files.
- It does not expose a generic SQL query tool.
- It does not accept file paths in MCP tool calls.
- It does not read arbitrary files or imported source files through MCP.
- It does not add telemetry or make external API calls.
- It does not claim approval for classified, CUI, proprietary, sensitive, or regulated data.

## Do I Need An AI Connection?

Doorframe itself does not need an AI connection.

The Doorframe web app, CLI, analyzers, and report generator all work without OpenAI, Anthropic, or any other AI provider.

Doorframe MCP is different. MCP is useful when an MCP-compatible AI client connects to Doorframe and calls its read-only tools. In that setup, the AI client supplies the model and chat interface. Doorframe MCP only supplies structured local project context.

In other words:

Doorframe = local requirements traceability tool.
Doorframe MCP = local read-only bridge to Doorframe data.
AI client = the assistant that uses Doorframe MCP to answer questions.

Only connect Doorframe MCP to project data if your organization has approved that AI client and model for that data.

Any information returned by Doorframe MCP may be included in the context of the AI client you connect it to. Do not connect Doorframe MCP to project data unless your organization has approved that use.

## Flow

User asks an MCP-compatible AI client:

```text
Which requirements are risky before test readiness review?
```

The AI client calls Doorframe MCP tools:

- `get_project_summary`
- `get_traceability_gaps`
- `list_findings`
- `get_requirement_detail`

Doorframe MCP returns local Doorframe project data.

The AI client uses that returned data to answer the user.

Doorframe MCP itself does not generate the AI answer and does not send data to an AI provider directly.

## Install And Run

Normal users should run MCP through the `@doorframe/cli` package:

```bash
npx @doorframe/cli mcp --project ./doorframe.sqlite
```

From the repo:

```bash
npm install
npm run --silent doorframe -- mcp --project ./.doorframe/doorframe.sqlite
```

For a global install:

```bash
doorframe mcp --project ./doorframe.sqlite
```

The server uses stdio transport only. stdout is reserved for MCP protocol messages; diagnostics and startup errors go to stderr.

The project path must point to an existing Doorframe SQLite database. In the local web app, Doorframe stores its database under the configured `DOORFRAME_DATA_DIR` or under `.doorframe/doorframe.sqlite` relative to the web app process working directory.

## Generic MCP Client Configuration

Exact configuration format varies by client. A generic MCP server entry looks like:

```json
{
  "mcpServers": {
    "doorframe": {
      "command": "doorframe",
      "args": ["mcp", "--project", "/absolute/path/to/doorframe.sqlite"]
    }
  }
}
```

Use `npx @doorframe/cli` as the command if the client supports launching through `npx`. Avoid claiming support for a specific client until you have verified that client's current MCP configuration format.

## Resources

- `doorframe://project/summary` - compact project summary with counts, findings by severity, and findings by category.
- `doorframe://project/findings` - concise findings summary grouped by severity and category, capped at 50 findings.
- `doorframe://project/traceability-matrix` - compact matrix with requirement ID, title, linked work count, linked test count, test status summary, and finding count.
- `doorframe://project/review-prep` - review-prep summary with important gaps, missing verification, missing work, failed tests, weak wording count, and suggested discussion topics.

## Tools

- `get_project_summary` - counts requirements, work items, tests, trace links, and findings.
- `search_requirements` - searches requirements by text, status, verification method, findings, missing work, missing tests, or weak wording.
- `get_requirement_detail` - returns one requirement with linked work, tests, trace links, and findings.
- `list_findings` - lists findings by severity, category, entity type, and limit.
- `get_traceability_gaps` - returns missing work, missing tests, closed work without verification, failed tests, and weak requirement language gaps.
- `get_review_risk_summary` - summarizes review risk from Doorframe findings and traceability data only.
- `get_trace_links_for_requirement` - returns trace links for one requirement.
- `find_orphan_items` - finds unlinked requirements, work items, and test cases.

All tools are read-only. They do not expose raw imported data unless the specific tool result includes the relevant Doorframe entity fields.

## Prompts

- `review_prep` - prepare a concise engineering review brief.
- `requirement_quality_review` - review weak, vague, duplicate, non-verifiable, or multi-shall requirements.
- `verification_gap_review` - review missing verification evidence.

## Security Notes

- Read-only first.
- Local-first.
- No telemetry.
- No external API calls.
- No AI provider API calls from the MCP server.
- No generic SQL tool.
- No arbitrary file access.
- No environment variable exposure.
- No write or mutation tools.
- Result sets are capped by default.
- Any information returned by Doorframe MCP may become part of the connected AI client's context, depending on the client.

Only connect Doorframe MCP to project data if your organization has approved that AI client and model for that data.

## Future Roadmap

Streamable HTTP is intentionally not implemented yet. If HTTP is added later, it should bind to localhost by default, validate Origin headers, and require explicit opt-in.

Possible later MCP work:

- Optional Streamable HTTP transport for internal deployments.
- Authentication for HTTP mode.
- Configurable redaction.
- Configurable result limits.
- Project ruleset resource.
- Report generation tool.
- Baseline comparison tools.
- Optional write actions behind explicit user approval.

Write actions should remain disabled until the read-only MCP server is stable.
