import type { ParseResult, RequirementIdPattern } from "@doorframe/core";
import type { ParsedRequirement } from "@doorframe/parsers";
import type { HttpClient } from "./http";

export interface DoorsNextConfig {
  /** Jazz/DOORS Next server root, e.g. https://example.com/rm */
  baseUrl: string;
  /** OAuth or basic credentials depending on the server configuration. */
  username: string;
  password: string;
  /** OSLC project area / service provider id. */
  projectAreaId: string;
}

/**
 * Placeholder for an IBM DOORS Next (OSLC RM) connector.
 *
 * DOORS Next integration is still at the research stage — see
 * `docs/integrations/doors-next.md`. The pragmatic near-term path is to export a
 * ReqIF module from DOORS Next and import it with Doorframe's ReqIF parser. A
 * live OSLC Query client is planned for a later release; this function documents
 * the intended signature and intentionally throws until then.
 */
export async function fetchDoorsNextRequirements(
  _config: DoorsNextConfig,
  _http?: HttpClient,
  _patterns?: RequirementIdPattern[]
): Promise<ParseResult<ParsedRequirement>> {
  throw new Error(
    "DOORS Next OSLC integration is not yet implemented. Export a ReqIF module from DOORS Next and import it via the ReqIF parser. See docs/integrations/doors-next.md."
  );
}
