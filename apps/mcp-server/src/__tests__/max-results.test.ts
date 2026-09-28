import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { openReadOnlyProjectDatabase } from "@doorframe/storage";
import { createDoorframeMcpServer } from "../server";
import { createDemoProjectDb } from "./fixtures";

async function connectedClient(maxResults: number) {
  const server = createDoorframeMcpServer(openReadOnlyProjectDatabase(createDemoProjectDb()), {
    mode: "summary",
    maxResults
  });
  const client = new Client({ name: "doorframe-test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function toolLimit(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  return (result.structuredContent as { limit: { limit: number; returned: number; total: number } }).limit;
}

describe("--max-results in registered MCP tools", () => {
  it("caps list_findings and find_orphan_items even when the client asks for more", async () => {
    const client = await connectedClient(2);

    try {
      expect(await toolLimit(client, "list_findings", {})).toMatchObject({ limit: 2, returned: 2, total: 4 });
      expect(await toolLimit(client, "list_findings", { limit: 100 })).toMatchObject({ limit: 2, returned: 2 });
      expect(await toolLimit(client, "find_orphan_items", { entityType: "all", limit: 100 })).toMatchObject({
        limit: 2,
        returned: 2,
        total: 3
      });
      expect(await toolLimit(client, "get_traceability_gaps", { limit: 100 })).toMatchObject({ limit: 2 });
    } finally {
      await client.close();
    }
  });
});
