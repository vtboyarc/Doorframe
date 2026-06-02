# MCP For Regulated Teams

Doorframe MCP can help regulated engineering teams use approved AI clients with more control over project context. It exposes narrow, read-only tools for requirements, work items, tests, findings, baselines, stale trace candidates, and review-brief facts.

Doorframe MCP is not another chatbot for requirements. Doorframe builds a local traceability graph from requirements exports, work items, and test results. It runs repeatable checks before the review. The optional MCP server lets an approved AI assistant query that graph through narrow, read-only tools instead of asking users to upload entire exports into a chat window.

## What Doorframe Controls

- Local Doorframe project database access.
- Read-only tool and resource scope.
- Result caps and data-minimization mode.
- Deterministic findings and baseline comparisons.
- Optional sanitized MCP audit logging.

## What The Organization Controls

- Whether the project data is approved for this workflow.
- Which AI client, model, network, and deployment are approved.
- Whether the connected AI client logs prompts, tool results, or responses.
- Whether Doorframe should run on a workstation, internal server, container, or mirrored package.

## No Approval Claims

Doorframe is not DoD-approved, approved for classified data, CUI-approved, FedRAMP-approved, CMMC-compliant, NIST-compliant, IL4/IL5 approved, or a compliance certification tool.

Warning: “Doorframe does not determine whether a project, AI client, model, network, or deployment is approved for your data. Your organization is responsible for approving tools and workflows before use.”
