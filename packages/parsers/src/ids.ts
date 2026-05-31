import {
  DEFAULT_REQUIREMENT_ID_PATTERNS,
  normalizeRequirementId,
  uniqueStrings,
  type RequirementIdPattern
} from "@doorframe/core";

/**
 * Compile a serialized {@link RequirementIdPattern} into a global,
 * case-insensitive RegExp. Invalid patterns are skipped rather than throwing so
 * a single bad project-configured pattern cannot break an import.
 */
function compilePattern(pattern: RequirementIdPattern): RegExp | null {
  try {
    return new RegExp(pattern.regex, "gi");
  } catch {
    return null;
  }
}

/**
 * Extract normalized requirement IDs from free text. When `patterns` is omitted
 * the built-in defaults (REQ/SYS/SRS/DOORS and SHALL) are used, preserving the
 * original behavior. Each pattern's first capture group is treated as the ID.
 */
export function extractRequirementIds(
  input: string | null | undefined,
  patterns: RequirementIdPattern[] = DEFAULT_REQUIREMENT_ID_PATTERNS
): string[] {
  if (!input) {
    return [];
  }

  const matches: string[] = [];
  patterns.forEach((pattern) => {
    const regex = compilePattern(pattern);
    if (!regex) {
      return;
    }

    for (const match of input.matchAll(regex)) {
      const captured = match[1] ?? match[0];
      if (captured) {
        matches.push(captured);
      }
    }
  });

  return uniqueStrings(matches.map(normalizeRequirementId));
}
