/** decodeURIComponent that returns the input unchanged instead of throwing on a stray "%". */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Candidate values for an ID taken from a route segment. Next usually decodes
 * params already, so try the value as given first and a decoded copy second:
 * IDs such as "REQ-50%" or "SYS%20001" then resolve instead of failing.
 */
export function routeIdCandidates(param: string): string[] {
  const decoded = safeDecode(param);
  return decoded === param ? [param] : [param, decoded];
}
