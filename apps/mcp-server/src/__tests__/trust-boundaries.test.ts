import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("trust boundaries", () => {
  it("does not expose generic SQL or arbitrary file tools from MCP", () => {
    const tools = read("apps/mcp-server/src/tools.ts");

    expect(tools).not.toMatch(/query_sql|execute_sql|raw_sql|generic sql/i);
    expect(tools).not.toMatch(/readFile|createReadStream|readdir/i);
  });

  it("does not include common analytics libraries in app or package source", () => {
    const files = [
      "package.json",
      "apps/web/package.json",
      "apps/web/src/app/layout.tsx",
      "apps/web/src/app/page.tsx"
    ];
    const combined = files.map(read).join("\n");

    expect(combined).not.toMatch(/google-analytics|gtag|posthog|segment|mixpanel|plausible/i);
  });
});
