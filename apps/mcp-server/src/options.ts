export type McpDataMode = "summary" | "standard" | "detailed";

export interface DoorframeMcpOptions {
  mode: McpDataMode;
  maxResults: number;
  hideRawText: boolean;
  auditLogPath?: string;
}

export const defaultDoorframeMcpOptions: DoorframeMcpOptions = {
  mode: "standard",
  maxResults: 25,
  hideRawText: false
};

export function normalizeMcpMode(value: string | undefined): McpDataMode {
  if (value === "summary" || value === "standard" || value === "detailed") {
    return value;
  }

  return "standard";
}

export function normalizeDoorframeMcpOptions(
  options: Partial<DoorframeMcpOptions> = {}
): DoorframeMcpOptions {
  const maxResults =
    typeof options.maxResults === "number" && Number.isFinite(options.maxResults)
      ? Math.max(1, Math.min(Math.floor(options.maxResults), 500))
      : defaultDoorframeMcpOptions.maxResults;

  return {
    mode: options.mode ?? defaultDoorframeMcpOptions.mode,
    maxResults,
    hideRawText: options.hideRawText ?? defaultDoorframeMcpOptions.hideRawText,
    auditLogPath: options.auditLogPath
  };
}

export function shouldHideRawText(options: Partial<DoorframeMcpOptions> = {}): boolean {
  const normalized = normalizeDoorframeMcpOptions(options);
  return normalized.hideRawText || normalized.mode === "summary";
}

export function canReturnFullText(options: Partial<DoorframeMcpOptions> = {}): boolean {
  const normalized = normalizeDoorframeMcpOptions(options);
  return normalized.mode === "detailed" && !shouldHideRawText(normalized);
}

export function resultLimit(
  requested: number | undefined,
  options: Partial<DoorframeMcpOptions>,
  defaultLimit: number,
  maxLimit: number
): number {
  const normalized = normalizeDoorframeMcpOptions(options);
  const effectiveMax = Math.max(1, Math.min(normalized.maxResults, maxLimit));
  const fallback = Math.max(1, Math.min(defaultLimit, effectiveMax));

  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return fallback;
  }

  return Math.max(1, Math.min(Math.floor(requested), effectiveMax));
}

export function dataPolicy(options: Partial<DoorframeMcpOptions> = {}) {
  const normalized = normalizeDoorframeMcpOptions(options);

  return {
    mode: normalized.mode,
    maxResults: normalized.maxResults,
    hideRawText: shouldHideRawText(normalized),
    rawText: shouldHideRawText(normalized)
      ? "hidden"
      : normalized.mode === "detailed"
        ? "full text allowed in detail tools"
        : "short excerpts only by default"
  };
}
