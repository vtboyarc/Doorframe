#!/usr/bin/env tsx

import { loadProjectDb, usageText } from "./project-loader";
import { runStdioServer } from "./server";
import { normalizeMcpMode, type DoorframeMcpOptions } from "./options";

interface CliArgs {
  project?: string;
  help?: boolean;
  mode?: DoorframeMcpOptions["mode"];
  maxResults?: number;
  hideRawText?: boolean;
  auditLogPath?: string;
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

    if (arg === "--mode") {
      parsed.mode = normalizeMcpMode(args[index + 1]);
      index += 1;
    }

    if (arg === "--max-results") {
      parsed.maxResults = Number(args[index + 1]);
      index += 1;
    }

    if (arg === "--hide-raw-text") {
      parsed.hideRawText = true;
    }

    if (arg === "--audit-log") {
      parsed.auditLogPath = args[index + 1];
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
  await runStdioServer(projectDb, {
    mode: args.mode,
    maxResults: args.maxResults,
    hideRawText: args.hideRawText,
    auditLogPath: args.auditLogPath
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Doorframe MCP server failed to start.");
  process.exitCode = 1;
});
