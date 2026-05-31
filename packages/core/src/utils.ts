import type { RawAttributes } from "./types";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function normalizeRequirementId(value: string): string {
  const trimmed = value.trim().toUpperCase();
  const shallMatch = trimmed.match(/^SHALL[\s_-]?(\d+)$/i);

  if (shallMatch) {
    return `SHALL-${shallMatch[1]}`;
  }

  const match = trimmed.match(/^([A-Z]+)[\s_-]?(\d+[A-Z0-9._-]*)$/);
  if (!match) {
    return trimmed;
  }

  return `${match[1]}-${match[2]}`;
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeJsonParse(value: string | null | undefined): RawAttributes {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function safeJsonStringify(value: RawAttributes | unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
