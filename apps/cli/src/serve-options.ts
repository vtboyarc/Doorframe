import { parseArgs } from "node:util";

/** Keep npm launcher flags separate from the analysis/MCP command options. */
export function parseServeOptions(
  args: string[],
  env: Record<string, string | undefined> = process.env
) {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", short: "p" },
      host: { type: "string" },
      "data-dir": { type: "string" }
    }
  });
  const port = values.port ?? env.PORT ?? "3000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Port must be an integer from 1 to 65535. Use --port <port> or -p <port>.");
  }
  return {
    port,
    host: values.host ?? env.HOSTNAME ?? "127.0.0.1",
    dataDir: values["data-dir"] ?? env.DOORFRAME_DATA_DIR
  };
}
