import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { FindingSeverity } from "@doorframe/core";

export type PublicSeverity = "high" | "medium" | "low";

export interface LimitResult {
  limit: number;
  total: number;
  returned: number;
  capped: boolean;
}

export const severityOrder: Record<PublicSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2
};

export function toPublicSeverity(severity: FindingSeverity): PublicSeverity {
  if (severity === "error") {
    return "high";
  }

  if (severity === "warning") {
    return "medium";
  }

  return "low";
}

export function fromPublicSeverity(severity: PublicSeverity): FindingSeverity {
  if (severity === "high") {
    return "error";
  }

  if (severity === "medium") {
    return "warning";
  }

  return "info";
}

export function clampLimit(value: number | undefined, defaultLimit: number, maxLimit: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultLimit;
  }

  return Math.max(1, Math.min(Math.floor(value), maxLimit));
}

export function limitItems<T>(items: T[], limit: number): { items: T[]; limit: LimitResult } {
  const limited = items.slice(0, limit);

  return {
    items: limited,
    limit: {
      limit,
      total: items.length,
      returned: limited.length,
      capped: items.length > limited.length
    }
  };
}

export function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item) || "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function excerpt(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function cappedNote(limit: LimitResult): string {
  return limit.capped ? `Showing ${limit.returned} of ${limit.total} result(s); use filters or a higher limit for more.` : "";
}

export function toolResult(text: string, structuredContent: Record<string, unknown>): CallToolResult {
  return {
    structuredContent,
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

export function jsonResource(uri: string, value: unknown): ReadResourceResult {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}
