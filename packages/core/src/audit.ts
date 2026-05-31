/** Categories of auditable actions recorded against a project. */
export type AuditAction =
  | "project.created"
  | "import.completed"
  | "analysis.rerun"
  | "baseline.created"
  | "ruleset.updated"
  | "report.generated";

export interface AuditEvent {
  id: string;
  projectId: string;
  timestamp: string;
  action: AuditAction;
  actor: string;
  summary: string;
  details?: Record<string, unknown>;
}

export type AuditEventInput = Omit<AuditEvent, "id" | "timestamp">;
