export type SourceType =
  | "requirements-csv"
  | "jira-csv"
  | "junit-xml"
  | "reqif"
  | "reqifz"
  | "manual"
  | "analysis";

export type EntityType = "requirement" | "workItem" | "testCase";

export type TraceLinkType =
  | "implements"
  | "verifies"
  | "references"
  | "parent"
  | "derived";

export type FindingSeverity = "info" | "warning" | "error";

export type FindingCategory =
  | "missing_verification"
  | "missing_work_trace"
  | "weak_wording"
  | "multi_requirement"
  | "non_verifiable"
  | "duplicate_candidate"
  | "stale_link"
  | "closed_work_without_verification"
  | "custom_rule";

export type TestStatus = "passed" | "failed" | "skipped" | "errored";

export type RawAttributes = Record<string, unknown>;

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementInput {
  externalId: string;
  title: string;
  text: string;
  source: SourceType | string;
  type?: string;
  status?: string;
  priority?: string;
  verificationMethod?: string;
  parentExternalId?: string;
  rawAttributes?: RawAttributes;
}

export interface Requirement extends RequirementInput {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemInput {
  externalId: string;
  title: string;
  description?: string;
  status?: string;
  type?: string;
  assignee?: string;
  source: SourceType | string;
  rawAttributes?: RawAttributes;
}

export interface WorkItem extends WorkItemInput {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseInput {
  externalId: string;
  name: string;
  classname?: string;
  status: TestStatus;
  duration?: number;
  failureMessage?: string;
  source: SourceType | string;
  rawAttributes?: RawAttributes;
}

export interface TestCase extends TestCaseInput {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TraceLinkInput {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  linkType: TraceLinkType;
  confidence: number;
  source: SourceType | string;
}

export interface TraceLink extends TraceLinkInput {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FindingInput {
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  entityType: EntityType;
  entityId: string;
  recommendation?: string;
}

export interface Finding extends FindingInput {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportBatch {
  id: string;
  projectId: string;
  sourceType: SourceType | string;
  filename: string;
  importedAt: string;
  recordCount: number;
  errors: string[];
}

export interface ProjectData {
  project: Project;
  requirements: Requirement[];
  workItems: WorkItem[];
  testCases: TestCase[];
  traceLinks: TraceLink[];
  findings: Finding[];
  importBatches: ImportBatch[];
}

export interface ProjectSummary {
  totalRequirements: number;
  totalWorkItems: number;
  totalTests: number;
  totalTraceLinks: number;
  totalFindings: number;
  requirementsWithoutWork: number;
  requirementsWithoutTests: number;
  weakRequirements: number;
  failedTestsLinkedToRequirements: number;
}

export interface ParseResult<T> {
  records: T[];
  errors: string[];
}
