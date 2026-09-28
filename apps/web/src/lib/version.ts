/**
 * The Doorframe version this web app was built from. `DOORFRAME_VERSION` is
 * inlined by next.config.mjs; `DOORFRAME_CLI_VERSION` is set at runtime by
 * `doorframe serve`.
 */
export function doorframeVersion(): string | undefined {
  return process.env.DOORFRAME_VERSION?.trim() || process.env.DOORFRAME_CLI_VERSION?.trim() || undefined;
}
