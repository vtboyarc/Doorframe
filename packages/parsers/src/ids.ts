import { normalizeRequirementId, uniqueStrings } from "@doorframe/core";

const REQUIREMENT_ID_PATTERN =
  /\b(?:REQ|SYS|SRS|DOORS)[\s_-]?\d+[A-Z0-9._-]*\b/gi;
const SHALL_ID_PATTERN = /\bSHALL[\s_-]?\d+\b/gi;

export function extractRequirementIds(input: string | null | undefined): string[] {
  if (!input) {
    return [];
  }

  const matches = [
    ...(input.match(REQUIREMENT_ID_PATTERN) ?? []),
    ...(input.match(SHALL_ID_PATTERN) ?? [])
  ];

  return uniqueStrings(matches.map(normalizeRequirementId));
}
