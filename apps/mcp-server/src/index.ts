#!/usr/bin/env tsx

import { loadProjectDb, usageText } from "./project-loader";
import { runStdioServer } from "./server";

interface CliArgs {
  project?: string;
  help?: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--project") {
      parsed.project = args[index + 1];
      index += 1;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.error(usageText);
    return;
  }

  const projectDb = loadProjectDb(args.project);
  await runStdioServer(projectDb);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Doorframe MCP server failed to start.");
  process.exitCode = 1;
});
