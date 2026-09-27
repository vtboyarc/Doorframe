/** Natural order for external IDs, so REQ-2 sorts before REQ-10. */
export function compareExternalIds(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}
