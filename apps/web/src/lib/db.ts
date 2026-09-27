import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  createId,
  DEFAULT_RULESET,
  normalizeRuleset,
  nowIso,
  safeJsonParse,
  safeJsonStringify,
  snapshotFromProjectData,
  type AuditEvent,
  type AuditEventInput,
  type Baseline,
  type Finding,
  type FindingInput,
  type ImportBatch,
  type Project,
  type ProjectData,
  type ProjectSnapshot,
  type ProjectSummary,
  type Requirement,
  type RequirementInput,
  type Ruleset,
  type TestCase,
  type TestCaseInput,
  type TraceLink,
  type TraceLinkInput,
  type WorkItem,
  type WorkItemInput
} from "@doorframe/core";
import { stableFindingId } from "./finding-id";
import { compareExternalIds } from "./sort";
import type { TraceReference } from "./trace-references";
import { projectSummary } from "./view-models";

type Db = Database.Database;

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

const globalForDb = globalThis as unknown as { doorframeDb?: Db };

function databasePath(): string {
  // Resolve so a relative DOORFRAME_DATA_DIR never leaks a relative path into
  // generated MCP configs, where the AI client's working directory differs.
  // Keep the resolve on its own branch: combining it with the path.join
  // fallback in one expression makes Next's file tracing glob the whole
  // source tree into the standalone build output.
  const configuredDataDir = process.env.DOORFRAME_DATA_DIR;
  const dataDir = configuredDataDir ? path.resolve(configuredDataDir) : path.join(process.cwd(), ".doorframe");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "doorframe.sqlite");
}

export function getDoorframeDatabasePath(): string {
  return databasePath();
}

export function getDb(): Db {
  if (!globalForDb.doorframeDb) {
    const db = new Database(databasePath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    globalForDb.doorframeDb = db;
  }

  return globalForDb.doorframeDb;
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      source TEXT NOT NULL,
      type TEXT,
      status TEXT,
      priority TEXT,
      verification_method TEXT,
      parent_external_id TEXT,
      raw_attributes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT,
      type TEXT,
      assignee TEXT,
      source TEXT NOT NULL,
      raw_attributes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      name TEXT NOT NULL,
      classname TEXT,
      status TEXT NOT NULL,
      duration REAL,
      failure_message TEXT,
      source TEXT NOT NULL,
      raw_attributes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS trace_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      link_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, source_type, source_id, target_type, target_id, link_type)
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      recommendation TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      errors TEXT
    );

    CREATE TABLE IF NOT EXISTS rulesets (
      project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS baselines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements(project_id);
    CREATE INDEX IF NOT EXISTS idx_work_items_project_id ON work_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases(project_id);
    CREATE INDEX IF NOT EXISTS idx_trace_links_project_id ON trace_links(project_id);
    CREATE INDEX IF NOT EXISTS idx_findings_project_id ON findings(project_id);
    CREATE INDEX IF NOT EXISTS idx_baselines_project_id ON baselines(project_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_project_id ON audit_log(project_id);
  `);
  migrateImportSupport(db);
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

export function listProjects(): Project[] {
  const rows = getDb()
    .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
    .all() as ProjectRow[];
  return rows.map(projectFromRow);
}

export function createProject(name: string): Project {
  const now = nowIso();
  const project: Project = {
    id: createId("project"),
    name: name.trim() || "Untitled Project",
    createdAt: now,
    updatedAt: now
  };

  getDb()
    .prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(project.id, project.name, project.createdAt, project.updatedAt);

  return project;
}

export interface ProjectListItem extends Project {
  requirementCount: number;
  findingCount: number;
}

/** Projects with cheap per-project counts for the home page list. */
export function listProjectsWithCounts(): ProjectListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM requirements r WHERE r.project_id = p.id) AS requirement_count,
        (SELECT COUNT(*) FROM findings f WHERE f.project_id = p.id) AS finding_count
      FROM projects p
      ORDER BY p.updated_at DESC`
    )
    .all() as Array<ProjectRow & { requirement_count: number; finding_count: number }>;

  return rows.map((row) => ({
    ...projectFromRow(row),
    requirementCount: row.requirement_count,
    findingCount: row.finding_count
  }));
}

/** Record counts for one project without loading the records themselves. */
export function getProjectCounts(projectId: string): { requirements: number; workItems: number; testCases: number } {
  const row = getDb()
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM requirements WHERE project_id = ?) AS requirements,
        (SELECT COUNT(*) FROM work_items WHERE project_id = ?) AS work_items,
        (SELECT COUNT(*) FROM test_cases WHERE project_id = ?) AS test_cases`
    )
    .get(projectId, projectId, projectId) as { requirements: number; work_items: number; test_cases: number };

  return { requirements: row.requirements, workItems: row.work_items, testCases: row.test_cases };
}

export function renameProject(projectId: string, name: string): Project | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return getProject(projectId);
  }

  getDb().prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?").run(trimmed, nowIso(), projectId);
  return getProject(projectId);
}

/** Delete a project and, through ON DELETE CASCADE, all of its local data. */
export function deleteProject(projectId: string): boolean {
  return getDb().prepare("DELETE FROM projects WHERE id = ?").run(projectId).changes > 0;
}

export function getProject(projectId: string): Project | null {
  const row = getDb()
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(projectId) as ProjectRow | undefined;

  return row ? projectFromRow(row) : null;
}

export function touchProject(projectId: string): void {
  getDb().prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(nowIso(), projectId);
}

export function getRequirements(projectId: string): Requirement[] {
  const rows = getDb()
    .prepare("SELECT * FROM requirements WHERE project_id = ?")
    .all(projectId) as RequirementRow[];
  return rows.map(requirementFromRow).sort((left, right) => compareExternalIds(left.externalId, right.externalId));
}

export function getWorkItems(projectId: string): WorkItem[] {
  const rows = getDb()
    .prepare("SELECT * FROM work_items WHERE project_id = ?")
    .all(projectId) as WorkItemRow[];
  return rows.map(workItemFromRow).sort((left, right) => compareExternalIds(left.externalId, right.externalId));
}

export function getTestCases(projectId: string): TestCase[] {
  const rows = getDb()
    .prepare("SELECT * FROM test_cases WHERE project_id = ? ORDER BY classname, name")
    .all(projectId) as TestCaseRow[];
  return rows.map(testCaseFromRow);
}

export function getTraceLinks(projectId: string): TraceLink[] {
  const rows = getDb()
    .prepare("SELECT * FROM trace_links WHERE project_id = ? ORDER BY created_at")
    .all(projectId) as TraceLinkRow[];
  return rows.map(traceLinkFromRow);
}

export function getFindings(projectId: string): Finding[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM findings WHERE project_id = ?
      ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, category, title`
    )
    .all(projectId) as FindingRow[];
  return rows.map(findingFromRow);
}

export function getImportBatches(projectId: string): ImportBatch[] {
  const rows = getDb()
    .prepare("SELECT * FROM import_batches WHERE project_id = ? ORDER BY imported_at DESC, rowid DESC")
    .all(projectId) as ImportBatchRow[];
  return rows.map(importBatchFromRow);
}

export function getRequirement(projectId: string, requirementId: string): Requirement | null {
  const row = getDb()
    .prepare("SELECT * FROM requirements WHERE project_id = ? AND (id = ? OR external_id = ?)")
    .get(projectId, requirementId, requirementId) as RequirementRow | undefined;
  return row ? requirementFromRow(row) : null;
}

export function getProjectData(projectId: string): ProjectData | null {
  const project = getProject(projectId);
  if (!project) {
    return null;
  }

  return {
    project,
    requirements: getRequirements(projectId),
    workItems: getWorkItems(projectId),
    testCases: getTestCases(projectId),
    traceLinks: getTraceLinks(projectId),
    findings: getFindings(projectId),
    importBatches: getImportBatches(projectId)
  };
}

export function getRequirementByExternalId(projectId: string, externalId: string): Requirement | null {
  const row = getDb()
    .prepare("SELECT * FROM requirements WHERE project_id = ? AND external_id = ?")
    .get(projectId, externalId) as RequirementRow | undefined;
  return row ? requirementFromRow(row) : null;
}

export function getWorkItemByExternalId(projectId: string, externalId: string): WorkItem | null {
  const row = getDb()
    .prepare("SELECT * FROM work_items WHERE project_id = ? AND external_id = ?")
    .get(projectId, externalId) as WorkItemRow | undefined;
  return row ? workItemFromRow(row) : null;
}

export function getTestCaseByExternalId(projectId: string, externalId: string): TestCase | null {
  const row = getDb()
    .prepare("SELECT * FROM test_cases WHERE project_id = ? AND external_id = ?")
    .get(projectId, externalId) as TestCaseRow | undefined;
  return row ? testCaseFromRow(row) : null;
}

export const saveRequirements = (projectId: string, records: RequirementInput[]): Requirement[] =>
  getDb().transaction((inputs: RequirementInput[]) => {
    const saved: Requirement[] = [];

    inputs.forEach((record) => {
      const existing = getRequirementByExternalId(projectId, record.externalId);
      const id = existing?.id ?? createId("req");
      const createdAt = existing?.createdAt ?? nowIso();
      const updatedAt = nowIso();

      getDb()
        .prepare(
          `INSERT INTO requirements (
            id, project_id, external_id, title, text, source, type, status, priority,
            verification_method, parent_external_id, raw_attributes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, external_id) DO UPDATE SET
            title = excluded.title,
            text = excluded.text,
            source = excluded.source,
            type = excluded.type,
            status = excluded.status,
            priority = excluded.priority,
            verification_method = excluded.verification_method,
            parent_external_id = excluded.parent_external_id,
            raw_attributes = excluded.raw_attributes,
            updated_at = excluded.updated_at`
        )
        .run(
          id,
          projectId,
          record.externalId,
          record.title,
          record.text,
          record.source,
          record.type ?? null,
          record.status ?? null,
          record.priority ?? null,
          record.verificationMethod ?? null,
          record.parentExternalId ?? null,
          safeJsonStringify(record.rawAttributes),
          createdAt,
          updatedAt
        );

      const savedRecord = getRequirementByExternalId(projectId, record.externalId);
      if (savedRecord) {
        saved.push(savedRecord);
      }
    });

    touchProject(projectId);
    return saved;
  })(records);

export const saveWorkItems = (projectId: string, records: WorkItemInput[]): WorkItem[] =>
  getDb().transaction((inputs: WorkItemInput[]) => {
    const saved: WorkItem[] = [];

    inputs.forEach((record) => {
      const existing = getWorkItemByExternalId(projectId, record.externalId);
      const id = existing?.id ?? createId("work");
      const createdAt = existing?.createdAt ?? nowIso();
      const updatedAt = nowIso();

      getDb()
        .prepare(
          `INSERT INTO work_items (
            id, project_id, external_id, title, description, status, type, assignee,
            source, raw_attributes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, external_id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            type = excluded.type,
            assignee = excluded.assignee,
            source = excluded.source,
            raw_attributes = excluded.raw_attributes,
            updated_at = excluded.updated_at`
        )
        .run(
          id,
          projectId,
          record.externalId,
          record.title,
          record.description ?? null,
          record.status ?? null,
          record.type ?? null,
          record.assignee ?? null,
          record.source,
          safeJsonStringify(record.rawAttributes),
          createdAt,
          updatedAt
        );

      const savedRecord = getWorkItemByExternalId(projectId, record.externalId);
      if (savedRecord) {
        saved.push(savedRecord);
      }
    });

    touchProject(projectId);
    return saved;
  })(records);

export const saveTestCases = (projectId: string, records: TestCaseInput[]): TestCase[] =>
  getDb().transaction((inputs: TestCaseInput[]) => {
    const saved: TestCase[] = [];

    inputs.forEach((record) => {
      const existing = getTestCaseByExternalId(projectId, record.externalId);
      const id = existing?.id ?? createId("test");
      const createdAt = existing?.createdAt ?? nowIso();
      const updatedAt = nowIso();

      getDb()
        .prepare(
          `INSERT INTO test_cases (
            id, project_id, external_id, name, classname, status, duration, failure_message,
            source, raw_attributes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, external_id) DO UPDATE SET
            name = excluded.name,
            classname = excluded.classname,
            status = excluded.status,
            duration = excluded.duration,
            failure_message = excluded.failure_message,
            source = excluded.source,
            raw_attributes = excluded.raw_attributes,
            updated_at = excluded.updated_at`
        )
        .run(
          id,
          projectId,
          record.externalId,
          record.name,
          record.classname ?? null,
          record.status,
          record.duration ?? null,
          record.failureMessage ?? null,
          record.source,
          safeJsonStringify(record.rawAttributes),
          createdAt,
          updatedAt
        );

      const savedRecord = getTestCaseByExternalId(projectId, record.externalId);
      if (savedRecord) {
        saved.push(savedRecord);
      }
    });

    touchProject(projectId);
    return saved;
  })(records);

export function saveTraceLink(projectId: string, input: TraceLinkInput): TraceLink {
  const existing = getDb()
    .prepare(
      `SELECT * FROM trace_links
      WHERE project_id = ? AND source_type = ? AND source_id = ? AND target_type = ?
      AND target_id = ? AND link_type = ?`
    )
    .get(projectId, input.sourceType, input.sourceId, input.targetType, input.targetId, input.linkType) as
    | TraceLinkRow
    | undefined;
  const now = nowIso();
  const id = existing?.id ?? createId("trace");

  getDb()
    .prepare(
      `INSERT INTO trace_links (
        id, project_id, source_type, source_id, target_type, target_id, link_type,
        confidence, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, source_type, source_id, target_type, target_id, link_type) DO UPDATE SET
        confidence = excluded.confidence,
        source = excluded.source,
        updated_at = excluded.updated_at`
    )
    .run(
      id,
      projectId,
      input.sourceType,
      input.sourceId,
      input.targetType,
      input.targetId,
      input.linkType,
      input.confidence,
      input.source,
      existing?.created_at ?? now,
      now
    );

  const row = getDb()
    .prepare("SELECT * FROM trace_links WHERE id = ?")
    .get(id) as TraceLinkRow;
  return traceLinkFromRow(row);
}

export function replaceFindings(projectId: string, findings: FindingInput[]): Finding[] {
  return getDb().transaction((inputs: FindingInput[]) => {
    getDb().prepare("DELETE FROM findings WHERE project_id = ?").run(projectId);
    const now = nowIso();
    const seenIds = new Map<string, number>();

    inputs.forEach((finding) => {
      getDb()
        .prepare(
          `INSERT INTO findings (
            id, project_id, severity, category, title, description, entity_type,
            entity_id, recommendation, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          stableFindingId(projectId, finding, seenIds),
          projectId,
          finding.severity,
          finding.category,
          finding.title,
          finding.description,
          finding.entityType,
          finding.entityId,
          finding.recommendation ?? null,
          now,
          now
        );
    });

    touchProject(projectId);
    return getFindings(projectId);
  })(findings);
}

export function addImportBatch(
  projectId: string,
  sourceType: string,
  filename: string,
  recordCount: number,
  errors: string[]
): ImportBatch {
  const importedAt = nowIso();
  const id = createId("import");

  getDb()
    .prepare(
      `INSERT INTO import_batches (
        id, project_id, source_type, filename, imported_at, record_count, errors
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, projectId, sourceType, filename, importedAt, recordCount, JSON.stringify(errors));

  touchProject(projectId);

  const row = getDb()
    .prepare("SELECT * FROM import_batches WHERE id = ?")
    .get(id) as ImportBatchRow;
  return importBatchFromRow(row);
}

export function getProjectSummary(projectId: string): ProjectSummary | null {
  const data = getProjectData(projectId);
  if (!data) {
    return null;
  }

  return projectSummary(data);
}

interface RulesetRow {
  project_id: string;
  json: string;
  updated_at: string;
}

/** Return the project's stored ruleset, falling back to {@link DEFAULT_RULESET}. */
export function getRuleset(projectId: string): Ruleset {
  const row = getDb()
    .prepare("SELECT * FROM rulesets WHERE project_id = ?")
    .get(projectId) as RulesetRow | undefined;

  if (!row) {
    return DEFAULT_RULESET;
  }

  try {
    return normalizeRuleset(JSON.parse(row.json) as Partial<Ruleset>);
  } catch {
    return DEFAULT_RULESET;
  }
}

export function saveRuleset(projectId: string, ruleset: Ruleset): Ruleset {
  const normalized = normalizeRuleset(ruleset);
  getDb()
    .prepare(
      `INSERT INTO rulesets (project_id, json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`
    )
    .run(projectId, JSON.stringify(normalized), nowIso());
  touchProject(projectId);
  return normalized;
}

interface BaselineRow {
  id: string;
  project_id: string;
  label: string;
  created_at: string;
  snapshot_json: string;
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

/** Store an already-built snapshot as a named, immutable baseline. */
export function saveBaselineSnapshot(projectId: string, label: string, snapshot: ProjectSnapshot): Baseline {
  const baseline: Baseline = {
    id: createId("baseline"),
    projectId,
    label: label.trim() || `Baseline ${nowIso()}`,
    createdAt: nowIso(),
    snapshot
  };

  getDb()
    .prepare(
      `INSERT INTO baselines (id, project_id, label, created_at, snapshot_json) VALUES (?, ?, ?, ?, ?)`
    )
    .run(baseline.id, projectId, baseline.label, baseline.createdAt, JSON.stringify(baseline.snapshot));

  return baseline;
}

/** Capture the project's current analyzed data as a named, immutable baseline. */
export function createBaseline(projectId: string, label: string): Baseline | null {
  const data = getProjectData(projectId);
  if (!data) {
    return null;
  }

  return saveBaselineSnapshot(projectId, label, snapshotFromProjectData(data));
}

export function listBaselines(projectId: string): Baseline[] {
  // rowid breaks ties between baselines captured within the same millisecond.
  const rows = getDb()
    .prepare("SELECT * FROM baselines WHERE project_id = ? ORDER BY created_at DESC, rowid DESC")
    .all(projectId) as BaselineRow[];
  return rows.map(baselineFromRow);
}

export function getBaseline(baselineId: string): Baseline | null {
  const row = getDb()
    .prepare("SELECT * FROM baselines WHERE id = ?")
    .get(baselineId) as BaselineRow | undefined;
  return row ? baselineFromRow(row) : null;
}

interface AuditRow {
  id: string;
  project_id: string;
  timestamp: string;
  action: string;
  actor: string;
  summary: string;
  details: string | null;
}

function auditFromRow(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    timestamp: row.timestamp,
    action: row.action as AuditEvent["action"],
    actor: row.actor,
    summary: row.summary,
    details: row.details ? (JSON.parse(row.details) as Record<string, unknown>) : undefined
  };
}

/** Append an audit event. Best-effort: never throws so it cannot break a write. */
export function recordAuditEvent(event: AuditEventInput): AuditEvent | null {
  try {
    const stored: AuditEvent = { ...event, id: createId("audit"), timestamp: nowIso() };
    getDb()
      .prepare(
        `INSERT INTO audit_log (id, project_id, timestamp, action, actor, summary, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        stored.id,
        stored.projectId,
        stored.timestamp,
        stored.action,
        stored.actor,
        stored.summary,
        stored.details ? JSON.stringify(stored.details) : null
      );
    return stored;
  } catch {
    return null;
  }
}

export function countAuditEvents(projectId: string): number {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM audit_log WHERE project_id = ?").get(projectId) as {
    count: number;
  };
  return row.count;
}

export function listAuditEvents(projectId: string, limit = 200): AuditEvent[] {
  const rows = getDb()
    .prepare("SELECT * FROM audit_log WHERE project_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?")
    .all(projectId, limit) as AuditRow[];
  return rows.map(auditFromRow);
}

// Import support
//
// Trace references and record removal for the import flow. Trace references
// keep the requirement IDs a work item or test case mentioned at import time,
// so links appear whichever file is imported first (see lib/trace-references).

type RecordEntityType = TraceLink["sourceType"];
type ReferenceEntityType = TraceReference["entityType"];

interface TraceReferenceRow {
  project_id: string;
  entity_type: ReferenceEntityType;
  entity_external_id: string;
  requirement_external_id: string;
  link_type: TraceReference["linkType"];
  confidence: number;
  source: string;
}

const RECORD_TABLES: Record<RecordEntityType, string> = {
  requirement: "requirements",
  workItem: "work_items",
  testCase: "test_cases"
};

function migrateImportSupport(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trace_references (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_external_id TEXT NOT NULL,
      requirement_external_id TEXT NOT NULL,
      link_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      UNIQUE(project_id, entity_type, entity_external_id, requirement_external_id, link_type)
    );

    CREATE INDEX IF NOT EXISTS idx_trace_references_requirement
      ON trace_references(project_id, requirement_external_id);
  `);
}

const importSupportReady = new WeakSet<Db>();

/**
 * The shared connection with the import tables ensured. migrate() creates them
 * for new connections; this also covers a connection opened before they
 * existed (a long-running dev server).
 */
function importDb(): Db {
  const db = getDb();
  if (!importSupportReady.has(db)) {
    migrateImportSupport(db);
    importSupportReady.add(db);
  }

  return db;
}

/** Run several import writes atomically. Nested calls join the outer transaction. */
export function runImportTransaction<T>(work: () => T): T {
  return importDb().transaction(work)();
}

/** Internal and external IDs of one kind of record in a project. */
export function listRecordIds(projectId: string, entityType: RecordEntityType): Array<{ id: string; externalId: string }> {
  const rows = importDb()
    .prepare(`SELECT id, external_id FROM ${RECORD_TABLES[entityType]} WHERE project_id = ?`)
    .all(projectId) as Array<{ id: string; external_id: string }>;
  return rows.map((row) => ({ id: row.id, externalId: row.external_id }));
}

/** Replace the stored references of the given entities with `references`. */
export function replaceTraceReferences(
  projectId: string,
  entityType: ReferenceEntityType,
  entityExternalIds: string[],
  references: TraceReference[]
): void {
  const db = importDb();
  const remove = db.prepare(
    "DELETE FROM trace_references WHERE project_id = ? AND entity_type = ? AND entity_external_id = ?"
  );
  const insert = db.prepare(
    `INSERT OR IGNORE INTO trace_references (
      project_id, entity_type, entity_external_id, requirement_external_id, link_type, confidence, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  db.transaction(() => {
    new Set(entityExternalIds).forEach((externalId) => remove.run(projectId, entityType, externalId));
    references.forEach((reference) => {
      insert.run(
        projectId,
        reference.entityType,
        reference.entityExternalId,
        reference.requirementExternalId,
        reference.linkType,
        reference.confidence,
        reference.source
      );
    });
  })();
}

export function listTraceReferences(projectId: string): TraceReference[] {
  const rows = importDb()
    .prepare("SELECT * FROM trace_references WHERE project_id = ?")
    .all(projectId) as TraceReferenceRow[];
  return rows.map((row) => ({
    entityType: row.entity_type,
    entityExternalId: row.entity_external_id,
    requirementExternalId: row.requirement_external_id,
    linkType: row.link_type,
    confidence: row.confidence,
    source: row.source
  }));
}

export function deleteTraceLinksById(projectId: string, linkIds: string[]): number {
  const db = importDb();
  const remove = db.prepare("DELETE FROM trace_links WHERE project_id = ? AND id = ?");
  return db.transaction(() => linkIds.reduce((count, id) => count + remove.run(projectId, id).changes, 0))();
}

export interface RemovedRecords {
  removedExternalIds: string[];
  removedLinkCount: number;
}

/**
 * Delete records by external ID together with their trace links, findings, and
 * (for work items and tests) their stored trace references. References that
 * point at a removed requirement are kept: they belong to the work item or
 * test that mentions it, and relink it if the requirement is imported again.
 */
export function removeRecords(projectId: string, entityType: RecordEntityType, externalIds: string[]): RemovedRecords {
  const db = importDb();
  const table = RECORD_TABLES[entityType];
  const find = db.prepare(`SELECT id FROM ${table} WHERE project_id = ? AND external_id = ?`);
  const removeLinks = db.prepare(
    `DELETE FROM trace_links WHERE project_id = ?
      AND ((source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?))`
  );
  const removeFindings = db.prepare("DELETE FROM findings WHERE project_id = ? AND entity_type = ? AND entity_id = ?");
  const removeReferences = db.prepare(
    "DELETE FROM trace_references WHERE project_id = ? AND entity_type = ? AND entity_external_id = ?"
  );
  const removeRecord = db.prepare(`DELETE FROM ${table} WHERE project_id = ? AND id = ?`);

  return db.transaction(() => {
    const removedExternalIds: string[] = [];
    let removedLinkCount = 0;

    new Set(externalIds).forEach((externalId) => {
      const row = find.get(projectId, externalId) as { id: string } | undefined;
      if (!row) {
        return;
      }

      removedLinkCount += removeLinks.run(projectId, entityType, row.id, entityType, row.id).changes;
      removeFindings.run(projectId, entityType, row.id);
      if (entityType !== "requirement") {
        removeReferences.run(projectId, entityType, externalId);
      }
      removeRecord.run(projectId, row.id);
      removedExternalIds.push(externalId);
    });

    if (removedExternalIds.length > 0) {
      touchProject(projectId);
    }

    return { removedExternalIds, removedLinkCount };
  })();
}
