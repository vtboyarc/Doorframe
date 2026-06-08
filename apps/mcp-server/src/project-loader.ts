import {
  openReadOnlyProjectDatabase,
  ReadOnlyProjectLoadError,
  type ReadOnlyProjectDatabase
} from "@doorframe/storage";

export const usageText = `Doorframe MCP server

Usage:
  doorframe-mcp --project ./path/to/doorframe.sqlite [--project-id project_123] [--mode summary|standard|detailed] [--max-results 25] [--hide-raw-text] [--audit-log ./doorframe-mcp-audit.jsonl]

The server uses stdio transport and writes only MCP protocol messages to stdout.
Logs and startup errors are written to stderr.`;

export function loadProjectDb(projectPath: string | undefined, projectId?: string): ReadOnlyProjectDatabase {
  if (!projectPath) {
    throw new ReadOnlyProjectLoadError(
      "MISSING_PROJECT_PATH",
      `Missing required --project path.\n\n${usageText}`
    );
  }

  const projectDb = openReadOnlyProjectDatabase(projectPath, projectId);
  projectDb.loadProjectData();
  return projectDb;
}
