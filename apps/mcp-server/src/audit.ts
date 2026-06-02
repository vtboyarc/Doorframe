import fs from "node:fs";
import path from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Project } from "@doorframe/core";
import type { DoorframeMcpOptions } from "./options";

type AuditValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | AuditValue[]
  | { [key: string]: AuditValue };

interface AuditEntry {
  timestamp: string;
  project?: Pick<Project, "id" | "name">;
  toolName: string;
  parameters: Record<string, AuditValue>;
  resultCount?: number;
  mode: DoorframeMcpOptions["mode"];
  success: boolean;
  durationMs: number;
}

const safeStringKeys = new Set([
  "baselineAId",
  "baselineBId",
  "changeType",
  "concernLevel",
  "entityType",
  "findingCategory",
  "gapType",
  "mode",
  "requirementId",
  "reviewType",
  "severity",
  "status"
]);

function sanitizeValue(key: string, value: unknown): AuditValue {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (safeStringKeys.has(key)) {
      return value;
    }

    return {
      provided: true,
      length: value.length
    };
  }

  if (Array.isArray(value)) {
    return {
      count: value.length
    };
  }

  if (typeof value === "object") {
    return {
      keys: Object.keys(value as Record<string, unknown>).sort()
    };
  }

  return undefined;
}

export function sanitizeParameters(parameters: Record<string, unknown>): Record<string, AuditValue> {
  return Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => [key, sanitizeValue(key, value)])
  );
}

function firstNumericValue(value: unknown, keys: string[]): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function resultCountFromToolResult(result: CallToolResult): number | undefined {
  const content = result.structuredContent;
  if (!content || typeof content !== "object") {
    return undefined;
  }

  const record = content as Record<string, unknown>;
  const direct = firstNumericValue(record, ["resultCount"]);
  if (direct !== undefined) {
    return direct;
  }

  const limit = record.limit;
  const limitReturned = firstNumericValue(limit, ["returned", "total"]);
  if (limitReturned !== undefined) {
    return limitReturned;
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      return value.length;
    }
  }

  const summary = record.summary;
  return firstNumericValue(summary, ["changed", "added", "deleted", "highConcern"]);
}

export function writeAuditLogEntry(options: DoorframeMcpOptions, entry: AuditEntry): void {
  if (!options.auditLogPath) {
    return;
  }

  try {
    const resolved = path.resolve(options.auditLogPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.appendFileSync(resolved, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown audit log error";
    console.error(`Doorframe MCP audit log write failed: ${message}`);
  }
}
