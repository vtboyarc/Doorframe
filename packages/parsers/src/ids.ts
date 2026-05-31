import { normalizeRequirementId, uniqueStrings } from "@doorframe/core";

const REQUIREMENT_ID_PATTERN =
  /(?:^|[^A-Z0-9])((?:REQ|SYS|SRS|DOORS)[\s_-]?\d+[A-Z0-9._-]*)/gi;
const SHALL_ID_PATTERN = /(?:^|[^A-Z0-9])((?:SHALL)[\s_-]?\d+)/gi;

export function extractRequirementIds(input: string | null | undefined): string[] {
  if (!input) {
    return [];
  }

  const matches = [
    ...Array.from(input.matchAll(REQUIREMENT_ID_PATTERN), (match) => match[1]),
    ...Array.from(input.matchAll(SHALL_ID_PATTERN), (match) => match[1])
  ];

  return uniqueStrings(matches.map(normalizeRequirementId));
}
