import os from "node:os";

/**
 * Best-effort identity for audit records. Doorframe is local-first with no user
 * accounts, so we attribute actions to the OS user (or "local" when unknown).
 */
export function auditActor(): string {
  try {
    return os.userInfo().username || "local";
  } catch {
    return "local";
  }
}
