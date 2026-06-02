import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ReadOnlyProjectDatabase } from "@doorframe/storage";
import { registerDoorframePrompts } from "./prompts";
import { registerDoorframeResources } from "./resources";
import { registerDoorframeTools } from "./tools";
import type { DoorframeMcpOptions } from "./options";

export const doorframeMcpInstructions =
  "You are connected to a local Doorframe project. Doorframe is a read-only requirements traceability and review tool. Use the available tools to answer questions about requirements, work items, tests, trace links, findings, baselines, stale trace candidates, and review-brief facts. Do not assume missing information. If the project data does not contain an answer, say so. Do not claim compliance approval or production readiness. Doorframe MCP does not include a model and does not call AI providers directly.";

export function createDoorframeMcpServer(
  projectDb: ReadOnlyProjectDatabase,
  options: Partial<DoorframeMcpOptions> = {}
): McpServer {
  const server = new McpServer(
    {
      name: "doorframe-mcp",
      version: "0.1.0"
    },
    {
      instructions: doorframeMcpInstructions
    }
  );

  registerDoorframeResources(server, projectDb, options);
  registerDoorframeTools(server, projectDb, options);
  registerDoorframePrompts(server);

  return server;
}

export async function runStdioServer(
  projectDb: ReadOnlyProjectDatabase,
  options: Partial<DoorframeMcpOptions> = {}
): Promise<void> {
  const server = createDoorframeMcpServer(projectDb, options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
