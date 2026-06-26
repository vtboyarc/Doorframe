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

Doorframe MCP is optional. It gives an approved MCP-compatible AI client read-only access to scoped Doorframe project context. Doorframe MCP does not include an AI model, does not call AI providers, and does not change project data.

Doorframe can run without AI. The local web app, CLI, analyzers, and report generator do not require an AI provider. MCP is optional and only useful when connected to an MCP-compatible AI client.

Doorframe MCP is not another chatbot for requirements. Doorframe builds a local traceability graph from requirements exports, work items, and test results. It runs repeatable checks before the review. The optional MCP server lets an approved AI assistant query that graph through narrow, read-only tools instead of asking users to upload entire exports into a chat window.

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”

## What It Does

- Opens one Doorframe SQLite project database path explicitly passed at startup.
- Serves stdio MCP tools, resources, and prompts.
- Answers from local Doorframe project data only.
- Returns concise results by default and caps larger result sets.
- Supports summary, standard, and detailed data-minimization modes.
- Supports optional local JSONL MCP audit logging.
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

## Standard Setup Flow

Doorframe is primarily used as a web app.

1. Run Doorframe with npm, Docker, or Docker Compose.
2. Open Doorframe in a web browser.
3. Import or open a Doorframe project.
4. Go to **MCP Setup**.
5. Pick the approved AI client.
6. Optionally adjust data & privacy options (data mode, max results, audit log).
7. Copy the generated config.
8. Paste it into the AI client.
9. Restart or reload the AI client.
10. Run the MCP health check from Doorframe and ask a starter question.

The MCP Setup page generates the exact command your AI client needs to launch the local Doorframe MCP server.

## How The AI Client Uses MCP

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

## Run Doorframe

With npm:

```bash
npx doorframe serve
```

Open the printed URL, normally `http://localhost:3000`.

With Docker:

```bash
docker run -p 3000:3000 -v doorframe-data:/data ghcr.io/vtboyarc/doorframe:0.1.13
```

With Docker Compose from this repository:

```bash
docker compose up
```

Then open `http://localhost:3000`.

## Advanced Local MCP Command

Normal users should copy the generated command from the MCP Setup page. Advanced users can run the same command manually:

```bash
npx -y doorframe@0.1.13 mcp \
  --project /absolute/path/to/doorframe.sqlite \
  --project-id project_123 \
  --mode standard \
  --max-results 25
```

Validate the same stdio path before configuring a client:

```bash
npx -y doorframe@0.1.13 mcp doctor \
  --project /absolute/path/to/doorframe.sqlite \
  --project-id project_123 \
  --mode standard \
  --max-results 25
```

The server uses stdio transport only. stdout is reserved for MCP protocol messages; diagnostics and startup errors go to stderr.

The project path must point to an existing Doorframe SQLite database. Use `--project-id` to select the intended project when that database contains more than one project. The MCP Setup page supplies both values. In the local web app, Doorframe stores its database under the configured `DOORFRAME_DATA_DIR` or under `.doorframe/doorframe.sqlite`.

## Using MCP When Doorframe Is Running In Docker

Doorframe web app can run in Docker.

Local stdio MCP usually requires the AI client to launch a local process. A browser page alone cannot make a desktop AI client launch MCP.

If Doorframe is running only inside Docker, the MCP server path and database path must be available to the AI client. A container path such as `/data/doorframe.sqlite` is not usually readable by a desktop AI client on the host.

For individual users, the easiest path may be running the Doorframe MCP server locally alongside the web app.

For teams, the future path is remote/internal MCP over HTTP with authentication and organization approval controls. That is not part of the first local stdio MCP setup.

Do not overpromise Docker-based MCP unless it has been implemented and tested in the target environment.

## Generic MCP Client Configuration

Exact configuration format varies by client. A generic MCP server entry looks like:

```json
{
  "mcpServers": {
    "doorframe": {
      "command": "npx",
      "args": ["-y", "doorframe@0.1.13", "mcp", "--project", "/absolute/path/to/doorframe.sqlite", "--project-id", "project_123", "--mode", "standard", "--max-results", "25"]
    }
  }
}
```

This matches what the MCP Setup page generates. If Doorframe is installed globally, you can use `doorframe` as the command with args beginning at `mcp`. On Windows, launch npx through `cmd` (`"command": "cmd"`, args starting with `"/c", "npx"`) — see [MCP troubleshooting](./mcp-troubleshooting.md). For client-specific setup, use the generated config from the MCP Setup page or see [MCP client setup](./mcp-clients/README.md).

## Data Minimization Flags

- `--mode summary` returns IDs, titles, counts, categories, and summaries. It hides raw requirement text, work item descriptions, and test failure messages.
- `--mode standard` is the default. It returns short excerpts when useful and caps result sets.
- `--mode detailed` allows full requirement text in detail tools while still using narrow read-only tools.
- `--max-results <number>` sets the global result cap for supported tools.
- `--hide-raw-text` hides raw requirement text even when another mode would return excerpts or detail text.

Data minimization applies to `search_requirements`, `get_requirement_detail`, `list_changed_requirements`, `get_requirement_change_detail`, `get_stale_trace_candidates`, and `get_review_brief`.

## Audit Logging

MCP audit logging is off by default. To enable a local JSONL log:

```bash
npx -y doorframe@0.1.13 mcp --project ./doorframe.sqlite --project-id project_123 --audit-log ./doorframe-mcp-audit.jsonl
```

The audit log records timestamp, project ID/name when available, tool name, sanitized high-level parameters, result count when easy to infer, mode, success/failure, and duration. It does not log full requirement text, full work item descriptions, full test failure messages, raw imported file contents, environment variables, or secrets.

## Health Check

The MCP Setup page includes a health check for the current project. It verifies that the project exists, the database path is readable, requirements exist, findings or analyzers are available, the MCP data adapters work, summary mode hides raw requirement text, baseline data is available when baseline tools are relevant, and any configured audit log path is writable.

If something fails, use the fix shown on the page or see [MCP troubleshooting](./mcp-troubleshooting.md).

## Resources

- `doorframe://project/summary` - compact project summary with counts, findings by severity, and findings by category.
- `doorframe://project/findings` - concise findings summary grouped by severity and category, capped at 50 findings.
- `doorframe://project/traceability-matrix` - compact matrix with requirement ID, title, linked work count, linked test count, test status summary, and finding count.
- `doorframe://project/review-prep` - review-prep summary with important gaps, missing verification, missing work, failed tests, weak wording count, and suggested discussion topics.
- `doorframe://project/baseline-diff` - baseline diff summary with added, deleted, changed, unchanged, and concern counts.
- `doorframe://project/stale-traces` - stale trace candidates after baseline changes.
- `doorframe://project/review-brief/test-readiness` - structured Doorframe facts for test readiness review preparation.
- `doorframe://project/review-brief/requirements-review` - structured Doorframe facts for requirements review preparation.

## Tools

- `get_project_summary` - counts requirements, work items, tests, trace links, and findings.
- `search_requirements` - searches requirements by text, status, verification method, findings, missing work, missing tests, or weak wording.
- `get_requirement_detail` - returns one requirement with linked work, tests, trace links, and findings.
- `list_findings` - lists findings by severity, category, entity type, and limit.
- `get_traceability_gaps` - returns missing work, missing tests, closed work without verification, failed tests, and weak requirement language gaps.
- `get_review_risk_summary` - summarizes review risk from Doorframe findings and traceability data only.
- `get_baseline_diff_summary` - returns added, deleted, changed, unchanged, and high-concern changed requirement counts between baselines.
- `list_changed_requirements` - lists added, deleted, or changed requirements with concern filtering.
- `get_requirement_change_detail` - returns detailed baseline change information for one requirement, including changed fields, linked work, linked tests, findings, and stale trace indicators.
- `get_stale_trace_candidates` - finds requirements whose trace links may be stale after baseline changes.
- `get_impacted_items_for_changed_requirement` - returns affected work items, tests, findings, failed or skipped tests, and suggested checks for one changed requirement.
- `get_review_brief` - returns structured Doorframe facts for review preparation. It is not an AI-generated final answer.
- `get_trace_links_for_requirement` - returns trace links for one requirement.
- `find_orphan_items` - finds unlinked requirements, work items, and test cases.

All tools are read-only. They do not expose raw imported data unless the specific tool result includes the relevant Doorframe entity fields.

## Prompts

- `review_prep` - prepare a concise engineering review brief.
- `requirement_quality_review` - review weak, vague, duplicate, non-verifiable, or multi-shall requirements.
- `verification_gap_review` - review missing verification evidence.
- `test_readiness_review_prep` - inspect baseline diff, stale traces, missing verification, failed tests, and closed work without passing tests.
- `baseline_change_review` - review added, deleted, and changed requirements between baselines.
- `stale_trace_review` - explain stale trace candidates and what a systems engineer or test lead should verify.
- `requirements_review_prep` - inspect weak wording, duplicate candidates, missing work links, missing verification methods, and changed requirements.
- `pi_planning_prep` - identify requirements with missing work items, changed requirements without updated work, and high-concern gaps.
- `audit_prep` - summarize traceability and verification gaps for audit or internal review prep without claiming compliance status.

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
- Optional audit logging is sanitized and local.
- Any information returned by Doorframe MCP may become part of the connected AI client's context, depending on the client.

Only connect Doorframe MCP to project data if your organization has approved that AI client and model for that data.

## Future Roadmap

Streamable HTTP is intentionally not implemented yet. If HTTP is added later, it should bind to localhost by default, validate Origin headers, and require explicit opt-in.

Possible later MCP work:

- Optional Streamable HTTP transport for internal deployments.
- Authentication for HTTP mode.
- Configurable redaction.
- Project ruleset resource.
- Report generation tool.
- Optional write actions behind explicit user approval.

Write actions should remain disabled until the read-only MCP server is stable.
