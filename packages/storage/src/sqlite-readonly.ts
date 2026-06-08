import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  safeJsonParse,
  type Baseline,
  type Finding,
  type ImportBatch,
  type Project,
  type ProjectData,
  type ProjectSnapshot,
  type Requirement,
  type TestCase,
  type TraceLink,
  type WorkItem
} from "@doorframe/core";

type Db = Database.Database;

export type ReadOnlyProjectLoadErrorCode =
  | "MISSING_PROJECT_PATH"
  | "BAD_DATABASE"
  | "EMPTY_PROJECT"
  | "PROJECT_NOT_FOUND";

export class ReadOnlyProjectLoadError extends Error {
  constructor(
    readonly code: ReadOnlyProjectLoadErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ReadOnlyProjectLoadError";
  }
}

export interface ReadOnlyProjectDatabase {
  readonly path: string;
  readonly projectId?: string;
  loadProjectData(): ProjectData;
  listBaselines(): Baseline[];
}

interface ProjectRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface RequirementRow {
  id: string;
  project_id: string;
  external_id: string;
  title: string;
  text: string;
  source: string;
  type: string | null;
  status: string | null;
  priority: string | null;
  verification_method: string | null;
  parent_external_id: string | null;
  raw_attributes: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkItemRow {
  id: string;
  project_id: string;
  external_id: string;
  title: string;
  description: string | null;
  status: string | null;
  type: string | null;
  assignee: string | null;
  source: string;
  raw_attributes: string | null;
  created_at: string;
  updated_at: string;
}

interface TestCaseRow {
  id: string;
  project_id: string;
  external_id: string;
  name: string;
  classname: string | null;
  status: "passed" | "failed" | "skipped" | "errored";
  duration: number | null;
  failure_message: string | null;
  source: string;
  raw_attributes: string | null;
  created_at: string;
  updated_at: string;
}

interface TraceLinkRow {
  id: string;
  project_id: string;
  source_type: "requirement" | "workItem" | "testCase";
  source_id: string;
  target_type: "requirement" | "workItem" | "testCase";
  target_id: string;
  link_type: "implements" | "verifies" | "references" | "parent" | "derived";
  confidence: number;
  source: string;
  created_at: string;
  updated_at: string;
}

interface FindingRow {
  id: string;
  project_id: string;
  severity: "info" | "warning" | "error";
  category: Finding["category"];
  title: string;
  description: string;
  entity_type: "requirement" | "workItem" | "testCase";
  entity_id: string;
  recommendation: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportBatchRow {
  id: string;
  project_id: string;
  source_type: string;
  filename: string;
  imported_at: string;
  record_count: number;
  errors: string | null;
}

interface BaselineRow {
  id: string;
  project_id: string;
  label: string;
  created_at: string;
  snapshot_json: string;
}

function validateProjectPath(projectPath: string | undefined): string {
  if (!projectPath?.trim()) {
    throw new ReadOnlyProjectLoadError(
      "MISSING_PROJECT_PATH",
      "Missing required --project path. Usage: doorframe-mcp --project ./path/to/doorframe.sqlite"
    );
  }

  const resolvedPath = path.resolve(projectPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new ReadOnlyProjectLoadError("BAD_DATABASE", `Doorframe project database was not found: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new ReadOnlyProjectLoadError("BAD_DATABASE", `Doorframe project path is not a file: ${resolvedPath}`);
  }

  return resolvedPath;
}

function openReadOnlyDb(projectPath: string): Db {
  try {
    const db = new Database(projectPath, { readonly: true, fileMustExist: true });
    db.pragma("query_only = ON");
    return db;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown SQLite error";
    throw new ReadOnlyProjectLoadError("BAD_DATABASE", `Could not open Doorframe project database: ${message}`);
  }
}

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requirementFromRow(row: RequirementRow): Requirement {
  return {
    id: row.id,
    projectId: row.project_id,
    externalId: row.external_id,
    title: row.title,
    text: row.text,
    source: row.source,
    type: row.type ?? undefined,
    status: row.status ?? undefined,
    priority: row.priority ?? undefined,
    verificationMethod: row.verification_method ?? undefined,
    parentExternalId: row.parent_external_id ?? undefined,
    rawAttributes: safeJsonParse(row.raw_attributes),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function workItemFromRow(row: WorkItemRow): WorkItem {
  return {
    id: row.id,
    projectId: row.project_id,
    externalId: row.external_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status ?? undefined,
    type: row.type ?? undefined,
    assignee: row.assignee ?? undefined,
    source: row.source,
    rawAttributes: safeJsonParse(row.raw_attributes),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function testCaseFromRow(row: TestCaseRow): TestCase {
  return {
    id: row.id,
    projectId: row.project_id,
    externalId: row.external_id,
    name: row.name,
    classname: row.classname ?? undefined,
    status: row.status,
    duration: row.duration ?? undefined,
    failureMessage: row.failure_message ?? undefined,
    source: row.source,
    rawAttributes: safeJsonParse(row.raw_attributes),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function traceLinkFromRow(row: TraceLinkRow): TraceLink {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    targetType: row.target_type,
    targetId: row.target_id,
    linkType: row.link_type,
    confidence: row.confidence,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function findingFromRow(row: FindingRow): Finding {
  return {
    id: row.id,
    projectId: row.project_id,
    severity: row.severity,
    category: row.category,
    title: row.title,
    description: row.description,
    entityType: row.entity_type,
    entityId: row.entity_id,
    recommendation: row.recommendation ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function importBatchFromRow(row: ImportBatchRow): ImportBatch {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceType: row.source_type,
    filename: row.filename,
    importedAt: row.imported_at,
    recordCount: row.record_count,
    errors: JSON.parse(row.errors ?? "[]") as string[]
  };
}

function baselineFromRow(row: BaselineRow): Baseline {
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    createdAt: row.created_at,
    snapshot: JSON.parse(row.snapshot_json) as ProjectSnapshot
  };
}

function allByProject<Row>(db: Db, table: string, projectId: string, orderBy: string): Row[] {
  return db.prepare(`SELECT * FROM ${table} WHERE project_id = ? ORDER BY ${orderBy}`).all(projectId) as Row[];
}

function hasTable(db: Db, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name: string } | undefined;
  return Boolean(row);
}

function getProjectRow(db: Db, projectId: string | undefined): ProjectRow | undefined {
  const selectedProjectId = projectId?.trim();
  if (selectedProjectId) {
    return db.prepare("SELECT * FROM projects WHERE id = ?").get(selectedProjectId) as ProjectRow | undefined;
  }

  return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC LIMIT 1").get() as ProjectRow | undefined;
}

function requireProjectRow(db: Db, projectId: string | undefined): ProjectRow {
  const selectedProjectId = projectId?.trim();
  const projectRow = getProjectRow(db, projectId);

  if (projectRow) {
    return projectRow;
  }

  if (selectedProjectId) {
    throw new ReadOnlyProjectLoadError(
      "PROJECT_NOT_FOUND",
      `Doorframe project was not found in the database: ${selectedProjectId}`
    );
  }

  throw new ReadOnlyProjectLoadError(
    "EMPTY_PROJECT",
    "The Doorframe project database appears empty. Create or import a project before starting Doorframe MCP."
  );
}

export function loadProjectDataFromSqlite(projectPath: string, projectId?: string): ProjectData {
  const resolvedPath = validateProjectPath(projectPath);
  const db = openReadOnlyDb(resolvedPath);

  try {
    const project = projectFromRow(requireProjectRow(db, projectId));
    const requirements = allByProject<RequirementRow>(db, "requirements", project.id, "external_id").map(
      requirementFromRow
    );
    const workItems = allByProject<WorkItemRow>(db, "work_items", project.id, "external_id").map(workItemFromRow);
    const testCases = allByProject<TestCaseRow>(db, "test_cases", project.id, "classname, name").map(testCaseFromRow);
    const traceLinks = allByProject<TraceLinkRow>(db, "trace_links", project.id, "created_at").map(traceLinkFromRow);
    const findings = allByProject<FindingRow>(db, "findings", project.id, "severity DESC, category, title").map(
      findingFromRow
    );
    const importBatches = allByProject<ImportBatchRow>(db, "import_batches", project.id, "imported_at DESC").map(
      importBatchFromRow
    );

    return {
      project,
      requirements,
      workItems,
      testCases,
      traceLinks,
      findings,
      importBatches
    };
  } catch (error) {
    if (error instanceof ReadOnlyProjectLoadError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "unknown SQLite error";
    throw new ReadOnlyProjectLoadError("BAD_DATABASE", `Could not read Doorframe project database: ${message}`);
  } finally {
    db.close();
  }
}

export function loadProjectBaselinesFromSqlite(projectPath: string, projectId?: string): Baseline[] {
  const resolvedPath = validateProjectPath(projectPath);
  const selectedProjectId = projectId?.trim();
  const db = openReadOnlyDb(resolvedPath);

  try {
    const projectRow = getProjectRow(db, selectedProjectId);

    if (!projectRow && selectedProjectId) {
      throw new ReadOnlyProjectLoadError(
        "PROJECT_NOT_FOUND",
        `Doorframe project was not found in the database: ${selectedProjectId}`
      );
    }

    if (!projectRow || !hasTable(db, "baselines")) {
      return [];
    }

    const rows = allByProject<BaselineRow>(db, "baselines", projectRow.id, "created_at DESC");
    return rows.map(baselineFromRow);
  } catch (error) {
    if (error instanceof ReadOnlyProjectLoadError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "unknown SQLite error";
    throw new ReadOnlyProjectLoadError("BAD_DATABASE", `Could not read Doorframe baselines: ${message}`);
  } finally {
    db.close();
  }
}

export function openReadOnlyProjectDatabase(projectPath: string, projectId?: string): ReadOnlyProjectDatabase {
  const resolvedPath = validateProjectPath(projectPath);
  const selectedProjectId = projectId?.trim() || undefined;

  return {
    path: resolvedPath,
    projectId: selectedProjectId,
    loadProjectData() {
      return loadProjectDataFromSqlite(resolvedPath, selectedProjectId);
    },
    listBaselines() {
      return loadProjectBaselinesFromSqlite(resolvedPath, selectedProjectId);
    }
  };
}
