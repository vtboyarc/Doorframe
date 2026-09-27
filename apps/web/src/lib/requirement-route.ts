import type { Requirement } from "@doorframe/core";
import { getRequirement } from "./db";
import { routeIdCandidates } from "./params";

/** Look up a requirement from a route segment, trying the ID as given and then a decoded copy. */
export function findRequirementByRouteParam(projectId: string, param: string): Requirement | null {
  for (const candidate of routeIdCandidates(param)) {
    const requirement = getRequirement(projectId, candidate);
    if (requirement) {
      return requirement;
    }
  }
  return null;
}
