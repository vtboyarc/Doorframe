# ChatGPT / Remote MCP Note

Doorframe's first MCP server is local stdio. Some ChatGPT and OpenAI workflows use remote MCP servers that are reachable by URL.

1. Run Doorframe.
2. Open Doorframe in your browser.
3. Open or create a project.
4. Go to MCP Setup.
5. Pick ChatGPT / remote MCP note.
6. Optionally adjust data & privacy options (data mode, max results, audit log).
7. Read the generated note.
8. Do not paste a local stdio command into ChatGPT as a remote MCP server URL.
9. Use Doorframe reports directly or use a local stdio MCP-capable client.
10. Ask a starter question in the approved local client, or use the Doorframe report in ChatGPT only if your organization approves that workflow.

If your organization wants Doorframe inside ChatGPT, you may need a future internal remote MCP deployment with authentication and approval controls. That is not part of the first local stdio MCP setup.

Doorframe does not include an AI model and does not call OpenAI or any other AI provider directly.

Reference: [OpenAI remote MCP docs](https://platform.openai.com/docs/guides/tools-remote-mcp).
